/**
 * summerizer. — Cloudflare Worker API Proxy
 *
 * SETUP STEPS (takes ~60 seconds):
 *  1. Go to https://dash.cloudflare.com → Workers & Pages → Create Worker
 *  2. Paste this entire file
 *  3. Go to Settings → Variables → Add the following secrets (NOT plain text vars):
 *       GROQ_API_KEY   = your full gsk_... key
 *       EXTENSION_ID   = your Chrome extension ID (from chrome://extensions)
 *  4. Deploy. Copy the worker URL (e.g. https://summerizer.YOUR-NAME.workers.dev)
 *  5. Paste that URL into background.js as PROXY_URL
 *
 * HOW THE KEY IS PROTECTED:
 *  - GROQ_API_KEY is stored as a Cloudflare secret — encrypted at rest,
 *    never visible after you save it, never in your source code
 *  - Only requests carrying your extension's ID in the origin header are accepted
 *  - Each unique client gets max 30 requests per hour via KV rate limiting
 *  - The Groq key is NEVER sent to the client under any circumstances
 */

const MAX_REQUESTS_PER_HOUR = 30;
const ALLOWED_ACTIONS = ['summarize', 'ask', 'generateQuiz', 'extractDoc'];

export default {
  async fetch(request, env) {

    // ── CORS preflight ──────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204, env);
    }

    // ── Only POST ───────────────────────────────────────────────────────────
    if (request.method !== 'POST') {
      return corsResponse({ error: 'Method not allowed' }, 405, env);
    }

    // ── Validate the request comes from YOUR extension ──────────────────────
    // Chrome extensions send Origin: chrome-extension://EXTENSION_ID
    const origin = request.headers.get('Origin') || '';
    const expectedOrigin = `chrome-extension://${env.EXTENSION_ID}`;
    if (origin !== expectedOrigin) {
      return corsResponse({ error: 'Forbidden' }, 403, env);
    }

    // ── Rate limiting via Cloudflare KV ─────────────────────────────────────
    // Client fingerprint: hashed combo of IP + a client-supplied install token
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const installToken = request.headers.get('X-Install-Token') || 'none';
    const clientKey = `rl:${await sha256(ip + installToken)}`;

    const rateLimitResult = await checkRateLimit(env.RATE_LIMIT_KV, clientKey);
    if (!rateLimitResult.allowed) {
      return corsResponse({
        error: `Rate limit exceeded. You can make ${MAX_REQUESTS_PER_HOUR} requests per hour. Resets in ${rateLimitResult.resetInMinutes} minutes.`
      }, 429, env);
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return corsResponse({ error: 'Invalid JSON body' }, 400, env);
    }

    const { action, messages, max_tokens, temperature } = body;

    if (!ALLOWED_ACTIONS.includes(action)) {
      return corsResponse({ error: 'Unknown action' }, 400, env);
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return corsResponse({ error: 'messages array required' }, 400, env);
    }

    // ── extractDoc: fetch PDF or Google Docs content server-side ─────────────
    if (action === 'extractDoc') {
      const { url: docUrl, docType } = body;
      if (!docUrl || typeof docUrl !== 'string') {
        return corsResponse({ error: 'url required for extractDoc' }, 400, env);
      }

      let fetchUrl = docUrl;
      // For Google Docs, use the plain-text export endpoint
      if (docType === 'gdocs') {
        try {
          const u = new URL(docUrl);
          const match = u.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (match) fetchUrl = `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
        } catch {}
      }

      let docContent = '';
      try {
        const docResp = await fetch(fetchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          redirect: 'follow',
          cf: { timeout: 10000 }
        });
        if (!docResp.ok) throw new Error(`Fetch failed: ${docResp.status}`);
        docContent = await docResp.text();
        // Strip HTML tags for non-PDF content
        if (!fetchUrl.toLowerCase().endsWith('.pdf')) {
          docContent = docContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        docContent = docContent.substring(0, 20000);
      } catch (err) {
        return corsResponse({ error: `Could not fetch document: ${err.message}` }, 502, env);
      }

      return corsResponse({ success: true, content: docContent }, 200, env);
    }

    // ── Sanitize: strip any attempt to leak the system prompt ───────────────
    const sanitizedMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content).substring(0, 20000)
    }));

    // ── Forward to Groq — key NEVER leaves this worker ──────────────────────
    let groqResponse;
    try {
      groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: sanitizedMessages,
          max_tokens: Math.min(Number(max_tokens) || 500, 2000),
          temperature: Math.min(Math.max(Number(temperature) || 0.3, 0), 1)
        })
      });
    } catch (err) {
      return corsResponse({ error: 'Failed to reach Groq API' }, 502, env);
    }

    if (!groqResponse.ok) {
      const errData = await groqResponse.json().catch(() => ({}));
      if (groqResponse.status === 429) {
        return corsResponse({ error: 'Service is busy. Please wait a moment.' }, 429, env);
      }
      return corsResponse({ error: errData?.error?.message || 'Groq API error' }, groqResponse.status, env);
    }

    const data = await groqResponse.json();

    // ── Return ONLY the content — never the raw Groq response ───────────────
    return corsResponse({
      success: true,
      content: data.choices?.[0]?.message?.content || '',
      remaining: rateLimitResult.remaining
    }, 200, env);
  }
};

// ── Rate limiter using Cloudflare KV ────────────────────────────────────────
// KV key holds a JSON array of timestamps for the past hour
async function checkRateLimit(kv, clientKey) {
  if (!kv) {
    // KV not bound — fail open in dev, but log it
    console.warn('RATE_LIMIT_KV not bound. Skipping rate limit.');
    return { allowed: true, remaining: MAX_REQUESTS_PER_HOUR };
  }

  const now = Date.now();
  const oneHourAgo = now - 3_600_000;

  let timestamps = [];
  try {
    const stored = await kv.get(clientKey);
    if (stored) timestamps = JSON.parse(stored);
  } catch { timestamps = []; }

  // Purge old entries
  timestamps = timestamps.filter(t => t > oneHourAgo);

  if (timestamps.length >= MAX_REQUESTS_PER_HOUR) {
    const oldest = timestamps[0];
    const resetInMinutes = Math.ceil((oldest + 3_600_000 - now) / 60_000);
    return { allowed: false, remaining: 0, resetInMinutes };
  }

  timestamps.push(now);

  // Store with 2-hour TTL so KV doesn't fill up forever
  await kv.put(clientKey, JSON.stringify(timestamps), { expirationTtl: 7200 });

  return { allowed: true, remaining: MAX_REQUESTS_PER_HOUR - timestamps.length };
}

// ── CORS helper ─────────────────────────────────────────────────────────────
function corsResponse(body, status, env) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': `chrome-extension://${env.EXTENSION_ID}`,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Install-Token',
  };
  return new Response(
    body !== null ? JSON.stringify(body) : null,
    { status, headers }
  );
}

// ── SHA-256 fingerprint (no PII stored, just a hash) ────────────────────────
async function sha256(text) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}