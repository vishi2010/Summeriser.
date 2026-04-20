

const STORAGE_KEYS = {
    THEME: 'summarizer-theme',
    SUMMARY_LENGTH: 'summarizer-summaryLength',
    RESPONSE_LENGTH: 'summarizer-responseLength'
  };
  
  function getStorage(key, defaultValue) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([key], (obj) => {
          resolve(obj[key] !== undefined ? obj[key] : defaultValue);
        });
      } else {
        try {
          const raw = localStorage.getItem(key);
          resolve(raw !== null ? raw : defaultValue);
        } catch (e) {
          resolve(defaultValue);
        }
      }
    });
  }
  
  function setStorage(key, value) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [key]: value }).catch(() => {});
    }
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  }
  
  function detectPageType(url) {
    if (!url) return 'unknown';
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) return 'youtube';
      if (u.pathname.toLowerCase().endsWith('.pdf') || u.searchParams.get('pdf')) return 'pdf';
    } catch (e) {}
    return 'article';
  }
  
  if (typeof window !== 'undefined') {
    window.STORAGE_KEYS = STORAGE_KEYS;
    window.getStorage = getStorage;
    window.setStorage = setStorage;
    window.detectPageType = detectPageType;
  }
