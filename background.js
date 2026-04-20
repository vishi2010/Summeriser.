const PROXY_URL = 'https://billowing-union-9187.devminds.workers.dev';
const MAX_INPUT_LENGTH = 15000;

async function getInstallToken() {
  const result = await chrome.storage.local.get('installToken');
  if (result.installToken) return result.installToken;
  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  await chrome.storage.local.set({ installToken: token });
  return token;
}

async function callProxy(action, payload) {
  const installToken = await getInstallToken();
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Install-Token': installToken },
    body: JSON.stringify({ action, ...payload })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${response.status}`);
  }
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Unknown error');
  return data;
}

async function summarize(tabId, summaryLength = 'medium') {
  const tab = await chrome.tabs.get(tabId);
  const url = tab.url;

  let content = '';

  if (url.toLowerCase().includes('.pdf') || tab.title?.toLowerCase().includes('.pdf')) {
    const result = await callProxy('extractDoc', { url, docType: 'pdf' });
    content = result.content;
  }
  else if (url.includes('docs.google.com/document')) {
    const result = await callProxy('extractDoc', { url, docType: 'gdocs' });
    content = result.content;
  }
  else {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'extract' });
    if (!response?.content) throw new Error('Could not read page. Refresh and try again.');
    content = response.content;
  }

  content = content.trim();
  if (!content) throw new Error('No text found on this page.');
  if (content.length > MAX_INPUT_LENGTH) content = content.substring(0, MAX_INPUT_LENGTH);

  const bulletCount = summaryLength === 'short' ? '3-4' : summaryLength === 'long' ? '7-9' : '4-6';
  const maxTokens   = summaryLength === 'short' ? 300   : summaryLength === 'long' ? 750   : 500;

  let prompt;
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    prompt = `Summarize this YouTube video as ${bulletCount} concise bullet points. Return ONLY bullet points starting with "• ". No intro.\n\n${content}`;
  } else if (url.includes('reddit.com')) {
    prompt = `Summarize this Reddit discussion as ${bulletCount} bullet points. Return ONLY bullet points starting with "• ". No intro.\n\n${content}`;
  } else if (url.includes('twitter.com') || url.includes('x.com')) {
    prompt = `Summarize these posts as ${bulletCount} bullet points. Return ONLY bullet points starting with "• ". No intro.\n\n${content}`;
  } else {
    prompt = `Summarize this content as ${bulletCount} concise bullet points. Return ONLY bullet points starting with "• ". No intro.\n\n${content}`;
  }

  const result = await callProxy('summarize', {
    messages: [{ role: 'user', content: `[SYSTEM] You are a helpful summarizer. Always respond with bullet points only, each starting with "• ". Never write an intro.\n\n${prompt}` }],
    max_tokens: maxTokens,
    temperature: 0.3
  });
  return result.content;
}

async function askQuestion(question, summary, responseLength = 'medium') {
  const maxTokens = responseLength === 'short' ? 150 : responseLength === 'long' ? 600 : 400;
  const lengthInstruction = responseLength === 'short' ? 'Be very concise — 2-3 bullet points max.'
    : responseLength === 'long' ? 'Provide a thorough answer using 6-8 bullet points.'
    : 'Answer using 3-5 bullet points.';

  const result = await callProxy('ask', {
    messages: [{ role: 'user', content: `[SYSTEM] You are a helpful assistant. Answer using bullet points only, each starting with "• ". Never write an intro. ${lengthInstruction}\n\nSummary:\n${summary}\n\nQuestion: ${question}` }],
    max_tokens: maxTokens,
    temperature: 0.3
  });
  return result.content;
}

async function generateQuiz(content) {
  const result = await callProxy('generateQuiz', {
    messages: [{ role: 'user', content: `[SYSTEM] You are a quiz generator. Output only valid JSON with no markdown.\n\nGenerate exactly 5 multiple choice questions that test understanding of the IDEAS, FACTS, and CONCEPTS in the content below. Questions must be about WHAT was said or explained — not about the video/article itself (never ask about order of topics, length, format, structure, or anything meta about the content). Each question should have one clearly correct answer and three plausible wrong answers. Return ONLY this JSON with no other text:\n{"questions":[{"question":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"answer":"A"}]}\n\nContent:\n${content}` }],
    max_tokens: 1500,
    temperature: 0.4
  });
  const parsed = JSON.parse(result.content.trim().replace(/```json|```/g, '').trim());
  if (!parsed.questions || !Array.isArray(parsed.questions)) throw new Error('Invalid quiz format.');
  return parsed.questions;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'summarize') {
    summarize(request.tabId, request.summaryLength || 'medium')
      .then(summary => sendResponse({ success: true, summary }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  if (request.action === 'ask') {
    askQuestion(request.question, request.summary, request.responseLength || 'medium')
      .then(answer => sendResponse({ success: true, answer }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  if (request.action === 'generateQuiz') {
    generateQuiz(request.content)
      .then(questions => sendResponse({ success: true, questions }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});