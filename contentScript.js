// summeriser. — contentScript.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract') {
    extractContent().then(content => sendResponse({ content })).catch(() => sendResponse({ content: '' }));
    return true;
  }
  return true;
});

async function extractContent() {
  const url = window.location.href;

  // ── YOUTUBE — real transcript via ytInitialPlayerResponse ──────────────────
  if (url.includes('youtube.com/watch') || url.includes('youtu.be')) {
    const title = document.querySelector('h1.ytd-video-primary-info-renderer, h1 yt-formatted-string')?.textContent?.trim() || '';

    // ytInitialPlayerResponse is a global object YouTube loads with every page
    try {
      const playerResponse = window.ytInitialPlayerResponse;
      const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (tracks && tracks.length > 0) {
        // Prefer English captions, fall back to whatever is available
        const track = tracks.find(t => t.languageCode === 'en' || t.languageCode === 'en-US')
          || tracks.find(t => t.languageCode?.startsWith('en'))
          || tracks[0];

        const transcriptResp = await fetch(track.baseUrl + '&fmt=json3');
        const transcriptData = await transcriptResp.json();

        const transcriptText = (transcriptData.events || [])
          .filter(e => e.segs)
          .map(e => e.segs.map(s => s.utf8 || '').join(''))
          .join(' ')
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (transcriptText.length > 100) {
          return clean(`Title: ${title}\n\nTranscript:\n${transcriptText}`);
        }
      }
    } catch (e) {
      // Transcript fetch failed — fall through to description fallback
    }

    // Fallback: title + description (captions unavailable or disabled)
    let fallback = title ? `Title: ${title}\n\n` : '';
    const desc = document.querySelector('#description yt-formatted-string, #description-inline-expander');
    if (desc) fallback += `Description:\n${desc.textContent}\n\n`;
    return clean(fallback || 'Could not extract video content. The video may not have captions.');
  }

  // ── MEDIUM ──────────────────────────────────────────────────────────────────
  if (url.includes('medium.com')) {
    let content = '';
    document.querySelectorAll('article p, article h1, article h2, article h3').forEach(el => { content += el.textContent + '\n\n'; });
    return clean(content);
  }

  // ── REDDIT ──────────────────────────────────────────────────────────────────
  if (url.includes('reddit.com')) {
    let content = '';
    const title = document.querySelector('h1');
    if (title) content += title.textContent + '\n\n';
    const post = document.querySelector('[data-test-id="post-content"]');
    if (post) content += post.textContent + '\n\n';
    let cc = 0;
    document.querySelectorAll('[data-testid="comment"]').forEach(c => { if (cc < 5) { content += c.textContent + '\n\n'; cc++; } });
    return clean(content);
  }

  // ── TWITTER/X ───────────────────────────────────────────────────────────────
  if (url.includes('twitter.com') || url.includes('x.com')) {
    let content = '';
    document.querySelectorAll('[data-testid="tweetText"]').forEach(t => { content += t.textContent + '\n\n'; });
    return clean(content);
  }

  // ── SUBSTACK ────────────────────────────────────────────────────────────────
  if (url.includes('substack.com')) {
    let content = '';
    document.querySelectorAll('.available-content p, .available-content h1, .available-content h2, .available-content h3').forEach(el => { content += el.textContent + '\n\n'; });
    return clean(content);
  }

  // ── GENERAL FALLBACK ────────────────────────────────────────────────────────
  let content = '';
  const article = document.querySelector('article');
  if (article) {
    article.querySelectorAll('p, h1, h2, h3, li').forEach(el => { content += el.textContent + '\n'; });
    return clean(content);
  }
  const main = document.querySelector('main');
  if (main) {
    main.querySelectorAll('p, h1, h2, h3, li').forEach(el => { content += el.textContent + '\n'; });
    return clean(content);
  }
  document.querySelectorAll('p, h1, h2, h3').forEach(el => { content += el.textContent + '\n'; });
  return clean(content);
}

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').replace(/ \n/g, '\n').replace(/\n\s*\n/g, '\n\n').trim();
}
