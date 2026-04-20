

(function () {
    'use strict';
  
    var root = document.documentElement;
    var themeKey = 'summarizer-theme';
    var summaryLengthKey = 'summarizer-summaryLength';
    var responseLengthKey = 'summarizer-responseLength';
  
    
    function applyTheme(theme) {
      var t = (theme === 'dark' || theme === 'light') ? theme : 'light';
      root.setAttribute('data-theme', t);
      var btn = document.getElementById('themeToggleSettings');
      if (btn) {
        var labelLight = btn.querySelector('.theme-label-light');
        var labelDark  = btn.querySelector('.theme-label-dark');
        if (labelLight) labelLight.hidden = t !== 'light';
        if (labelDark)  labelDark.hidden  = t !== 'dark';
        btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
      }
    }
  
    function saveTheme(theme) {
      try { localStorage.setItem(themeKey, theme); } catch (e) {}
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [themeKey]: theme }).catch(function () {});
      }
    }
  
    function initTheme() {
      if (typeof getStorage === 'undefined') { applyTheme('light'); return; }
      getStorage(themeKey, 'light').then(function (saved) { applyTheme(saved); });
    }
  
    try {
      var savedTheme = localStorage.getItem(themeKey);
      applyTheme((savedTheme === 'dark' || savedTheme === 'light') ? savedTheme : 'light');
    } catch (e) { applyTheme('light'); }
  
    function openSettings() {
      var backdrop = document.getElementById('settingsBackdrop');
      var panel    = document.getElementById('settingsPanel');
      if (backdrop) { backdrop.removeAttribute('hidden'); backdrop.classList.add('settings-backdrop-visible'); }
      if (panel)    { panel.removeAttribute('hidden');    panel.classList.add('settings-panel-visible'); }
    }
  
    function closeSettings() {
      var backdrop = document.getElementById('settingsBackdrop');
      var panel    = document.getElementById('settingsPanel');
      if (backdrop) { backdrop.setAttribute('hidden', ''); backdrop.classList.remove('settings-backdrop-visible'); }
      if (panel)    { panel.setAttribute('hidden', '');    panel.classList.remove('settings-panel-visible'); }
    }
  
    function setupSettingsPanel() {
      var settingsBtn = document.getElementById('settingsBtn');
      var closeBtn    = document.getElementById('settingsClose');
      var backdrop    = document.getElementById('settingsBackdrop');
      if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
      if (closeBtn)    closeBtn.addEventListener('click', closeSettings);
      if (backdrop)    backdrop.addEventListener('click', closeSettings);
    }
  
    function setupThemeToggle() {
      var btn = document.getElementById('themeToggleSettings');
      if (!btn) return;
      function currentTheme() {
        var t = root.getAttribute('data-theme');
        return (t === 'dark' || t === 'light') ? t : 'light';
      }
      btn.addEventListener('click', function () {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        saveTheme(next);
      });
      initTheme();
    }
  
    function loadSettings() {
      if (typeof getStorage === 'undefined') return;
      getStorage(summaryLengthKey, 'medium').then(function (v) {
        var el = document.getElementById('summaryLength');
        if (el && (v === 'short' || v === 'medium' || v === 'long')) el.value = v;
      });
      getStorage(responseLengthKey, 'medium').then(function (v) {
        var el = document.getElementById('responseLength');
        if (el && (v === 'short' || v === 'medium' || v === 'long')) el.value = v;
      });
    }
  
    function setupSettingsSelects() {
      function save(key, value) {
        if (typeof setStorage !== 'undefined') setStorage(key, value);
      }
      var summaryEl  = document.getElementById('summaryLength');
      var responseEl = document.getElementById('responseLength');
      if (summaryEl)  summaryEl.addEventListener('change',  function () { save(summaryLengthKey,  summaryEl.value); });
      if (responseEl) responseEl.addEventListener('change', function () { save(responseLengthKey, responseEl.value); });
      loadSettings();
    }
  
    var currentTab = 'summary';
  
    function switchTab(tab) {
      currentTab = tab;
      ['summary', 'qa', 'quiz'].forEach(function (t) {
        var btn   = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
        var panel = document.getElementById('panel' + t.charAt(0).toUpperCase() + t.slice(1));
        if (btn)   btn.classList.toggle('tab-btn-active', t === tab);
        if (panel) { if (t === tab) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', ''); }
      });
  
      var footerSummarizeWrap = document.getElementById('footerSummarizeWrap');
      var questionBarWrap     = document.getElementById('questionBarWrap');
      var footerQuizWrap      = document.getElementById('footerQuizWrap');
  
      if (footerSummarizeWrap) footerSummarizeWrap.setAttribute('hidden', '');
      if (questionBarWrap)     { questionBarWrap.setAttribute('hidden', ''); questionBarWrap.classList.remove('question-bar-visible'); }
      if (footerQuizWrap)      footerQuizWrap.setAttribute('hidden', '');
  
      if (tab === 'qa') {
        if (questionBarWrap) { questionBarWrap.removeAttribute('hidden'); questionBarWrap.classList.add('question-bar-visible'); }
      } else if (tab === 'quiz') {
        if (footerQuizWrap) footerQuizWrap.removeAttribute('hidden');
      }
    }
  
    function setupTabs() {
      var tabBar = document.getElementById('tabBar');
      if (!tabBar) return;
      tabBar.addEventListener('click', function (e) {
        var btn = e.target.closest('.tab-btn');
        if (btn) switchTab(btn.dataset.tab);
      });
    }
  
    function showTabBar() {
      var tabBar = document.getElementById('tabBar');
      if (tabBar) tabBar.removeAttribute('hidden');
    }
  
    function setupQuestionBar() {
      var form  = document.getElementById('questionForm');
      var input = document.getElementById('questionInput');
      if (!form || !input) return;
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var q = (input.value || '').trim();
        if (!q) return;
        input.value = '';
        if (typeof window.onQuestionSubmit === 'function') window.onQuestionSubmit(q);
      });
    }
  
    function setPageType(text) {
      var el = document.getElementById('pageType');
      if (el) el.textContent = text;
    }
  
    function setStatus(text, isError) {
      var el = document.getElementById('status');
      if (!el) return;
      if (!text) { el.setAttribute('hidden', ''); return; }
      el.removeAttribute('hidden');
      el.textContent = text;
      el.classList.toggle('error',   !!isError);
      el.classList.toggle('loading', !isError && text.indexOf('…') !== -1);
    }
  
    function renderBullets(text, container) {
      while (container.firstChild) container.removeChild(container.firstChild);
      var lines      = (text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      var hasBullets = lines.some(function (l) { return l.startsWith('•') || l.startsWith('-'); });
      if (hasBullets) {
        var ul = document.createElement('ul');
        ul.className = 'summary-list';
        lines.forEach(function (l) {
          var li = document.createElement('li');
          li.textContent = l.replace(/^[•\-]\s*/, '');
          ul.appendChild(li);
        });
        container.appendChild(ul);
      } else {
        lines.forEach(function (l) {
          var p = document.createElement('p');
          p.textContent = l;
          container.appendChild(p);
        });
      }
    }
  
    function showSummary(text) {
      var content = document.getElementById('summaryContent');
      var raw     = document.getElementById('summaryRaw');
      if (raw)     raw.value = text || '';
      if (content) renderBullets(text, content);
      showTabBar();
      if (currentTab !== 'qa' && currentTab !== 'quiz') switchTab('summary');
      var footerSummarizeWrap = document.getElementById('footerSummarizeWrap');
      if (footerSummarizeWrap) footerSummarizeWrap.setAttribute('hidden', '');
    }
  

    function detectAndEnableSummarize() {
      if (typeof chrome === 'undefined' || !chrome.tabs) { setPageType('Unknown'); return; }
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var tab = tabs[0];
        if (!tab || !tab.url) { setPageType('No tab'); return; }
        var url = tab.url;
        if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
          setPageType('Cannot summarize this page');
          return;
        }
        var type  = typeof detectPageType === 'function' ? detectPageType(url) : 'article';
        var label = type === 'youtube' ? 'YouTube video' : type === 'pdf' ? 'PDF' : 'Article / webpage';
        setPageType(label);
        var summarizeBtn = document.getElementById('summarizeBtn');
        if (summarizeBtn) summarizeBtn.disabled = false;
      });
    }
  
    function setupSummarize() {
      var summarizeBtn = document.getElementById('summarizeBtn');
      if (!summarizeBtn) return;
  
      summarizeBtn.addEventListener('click', function () {
        if (summarizeBtn.disabled) return;
        setStatus('Summarizing…', false);
        summarizeBtn.disabled = true;
  
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          var tab = tabs[0];
          if (!tab || !tab.id) {
            setStatus('No active tab', true);
            summarizeBtn.disabled = false;
            return;
          }
          var url = tab.url;
          if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
            setStatus('Cannot summarize this type of page.', true);
            summarizeBtn.disabled = false;
            return;
          }
  
          function doSummarize() {
            var waitMs = url.includes('docs.google.com') ? 1000 : 200;
            setTimeout(function () {
              var summaryLen = 'medium';
              var summaryEl  = document.getElementById('summaryLength');
              if (summaryEl) summaryLen = summaryEl.value || 'medium';
  
              chrome.runtime.sendMessage(
                { action: 'summarize', tabId: tab.id, summaryLength: summaryLen },
                function (response) {
                  summarizeBtn.disabled = false;
                  if (chrome.runtime.lastError) {
                    setStatus('Extension error: ' + chrome.runtime.lastError.message, true);
                    return;
                  }
                  if (!response) {
                    setStatus('No response. Try reloading the extension.', true);
                    return;
                  }
                  if (response.success) {
                    showSummary(response.summary);
                    setStatus('');
                  } else {
                    setStatus(response.error || 'Unknown error.', true);
                  }
                }
              );
            }, waitMs);
          }
  
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['contentScript.js']
          }).then(doSummarize).catch(doSummarize);
        });
      });
  
      detectAndEnableSummarize();
    }
  
    function appendBubble(text, type) {
      var messages = document.getElementById('qaMessages');
      if (!messages) return null;
      var bubble = document.createElement('div');
      bubble.className = 'qa-bubble qa-bubble-' + type;
      if (type === 'answer') {
        renderBullets(text, bubble);
        var ul = bubble.querySelector('.summary-list');
        if (ul) ul.className = 'bubble-list';
      } else {
        bubble.textContent = text;
      }
      messages.appendChild(bubble);
      messages.scrollTop = messages.scrollHeight;
      return bubble;
    }
  
    function setupQuestionSubmit() {
      window.onQuestionSubmit = function (question) {
        var summaryRaw   = document.getElementById('summaryRaw');
        var questionInput = document.getElementById('questionInput');
        var questionSend  = document.getElementById('questionSend');
        var summary = summaryRaw ? summaryRaw.value.trim() : '';
        if (!summary) { setStatus('No summary available to ask about.', true); return; }
  
        var responseLen = 'medium';
        var responseEl  = document.getElementById('responseLength');
        if (responseEl) responseLen = responseEl.value || 'medium';
  
        appendBubble(question, 'question');
        var thinkingBubble = appendBubble('Thinking…', 'thinking');
  
        if (questionInput) questionInput.disabled = true;
        if (questionSend)  questionSend.disabled  = true;
  
        chrome.runtime.sendMessage(
          { action: 'ask', question: question, summary: summary, responseLength: responseLen },
          function (response) {
            if (questionInput) { questionInput.disabled = false; questionInput.focus(); }
            if (questionSend)  questionSend.disabled = false;
            if (thinkingBubble && thinkingBubble.parentNode) thinkingBubble.parentNode.removeChild(thinkingBubble);
  
            if (chrome.runtime.lastError) { appendBubble('Error: ' + chrome.runtime.lastError.message, 'thinking'); return; }
            if (!response)               { appendBubble('No response. Try reloading the extension.', 'thinking'); return; }
            if (response.success) { setStatus(''); appendBubble(response.answer, 'answer'); }
            else                  { appendBubble(response.error || 'Unknown error.', 'thinking'); }
          }
        );
      };
    }
  
    var quizData    = [];
    var quizAnswers = {};
  
    function setupQuiz() {
      var generateBtn = document.getElementById('generateQuizBtn');
      var retakeBtn   = document.getElementById('retakeQuizBtn');
      if (generateBtn) generateBtn.addEventListener('click', startQuiz);
      if (retakeBtn)   retakeBtn.addEventListener('click', resetQuiz);
    }
  
    function startQuiz() {
      var raw     = document.getElementById('summaryRaw');
      var content = raw ? raw.value.trim() : '';
      if (!content) { setStatus('Generate a summary first.', true); return; }
  
      document.getElementById('quizIdle').setAttribute('hidden', '');
      document.getElementById('quizLoading').removeAttribute('hidden');
      document.getElementById('quizQuestions').setAttribute('hidden', '');
      document.getElementById('quizResults').setAttribute('hidden', '');
      quizAnswers = {};
  
      chrome.runtime.sendMessage({ action: 'generateQuiz', content: content }, function (response) {
        document.getElementById('quizLoading').setAttribute('hidden', '');
        if (chrome.runtime.lastError || !response) {
          document.getElementById('quizIdle').removeAttribute('hidden');
          setStatus('Failed to generate quiz.', true);
          return;
        }
        if (!response.success) {
          document.getElementById('quizIdle').removeAttribute('hidden');
          setStatus(response.error || 'Quiz generation failed.', true);
          return;
        }
        quizData = response.questions;
        renderQuiz(quizData);
      });
    }
  
    function renderQuiz(questions) {
      var container = document.getElementById('quizQuestions');
      container.innerHTML = '';
      questions.forEach(function (q, qi) {
        var card = document.createElement('div');
        card.className = 'quiz-card';
        var qp = document.createElement('p');
        qp.className = 'quiz-question';
        var qnum = document.createElement('span');
        qnum.className = 'quiz-q-num';
        qnum.textContent = (qi + 1) + '.';
        qp.appendChild(qnum);
        qp.appendChild(document.createTextNode(' ' + q.question));
        card.appendChild(qp);
        var opts = document.createElement('div');
        opts.className = 'quiz-options';
        ['A','B','C','D'].forEach(function (letter) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'quiz-option';
          btn.dataset.qi     = qi;
          btn.dataset.letter = letter;
          var lSpan = document.createElement('span');
          lSpan.className = 'quiz-option-letter';
          lSpan.textContent = letter;
          var tSpan = document.createElement('span');
          tSpan.className = 'quiz-option-text';
          tSpan.textContent = q.options[letter];
          btn.appendChild(lSpan);
          btn.appendChild(tSpan);
          btn.addEventListener('click', function () { selectOption(qi, letter, q.answer); });
          opts.appendChild(btn);
        });
        card.appendChild(opts);
        container.appendChild(card);
      });
  
      var submitRow = document.createElement('div');
      submitRow.className = 'quiz-submit-row';
      var submitBtn = document.createElement('button');
      submitBtn.type      = 'button';
      submitBtn.className = 'btn-submit-quiz';
      submitBtn.id        = 'submitQuizBtn';
      submitBtn.textContent = 'Submit Quiz';
      submitBtn.disabled  = true;
      submitBtn.addEventListener('click', submitQuiz);
      submitRow.appendChild(submitBtn);
      container.appendChild(submitRow);
      container.removeAttribute('hidden');
    }
  
    function selectOption(qi, letter, correct) {
      if (quizAnswers[qi] !== undefined) return;
      quizAnswers[qi] = letter;
      document.querySelectorAll('[data-qi="' + qi + '"]').forEach(function (btn) {
        btn.disabled = true;
        if (btn.dataset.letter === correct)                     btn.classList.add('quiz-option-correct');
        else if (btn.dataset.letter === letter && letter !== correct) btn.classList.add('quiz-option-wrong');
        else                                                    btn.classList.add('quiz-option-dim');
      });
      var submitBtn = document.getElementById('submitQuizBtn');
      if (submitBtn && Object.keys(quizAnswers).length === quizData.length) submitBtn.disabled = false;
    }
  
    function submitQuiz() {
      var correct = 0;
      quizData.forEach(function (q, qi) { if (quizAnswers[qi] === q.answer) correct++; });
      var total = quizData.length;
      var pct   = Math.round((correct / total) * 100);
  
      document.getElementById('quizQuestions').setAttribute('hidden', '');
  
      var circle = document.getElementById('quizScoreCircle');
      circle.textContent = correct + '/' + total;
      circle.className   = 'quiz-score-circle ' + (pct >= 80 ? 'score-great' : pct >= 50 ? 'score-ok' : 'score-low');
  
      var msg = document.getElementById('quizResultsMsg');
      msg.textContent = pct >= 80
        ? 'Excellent! You clearly understood the article.'
        : pct >= 50
        ? 'Good effort! Review the summary to fill in the gaps.'
        : 'Keep reading! Try again after reviewing the summary.';
  
      document.getElementById('quizResults').removeAttribute('hidden');
    }
  
    function resetQuiz() {
      quizData    = [];
      quizAnswers = {};
      document.getElementById('quizResults').setAttribute('hidden', '');
      document.getElementById('quizQuestions').setAttribute('hidden', '');
      document.getElementById('quizLoading').setAttribute('hidden', '');
      document.getElementById('quizIdle').removeAttribute('hidden');
    }
      function init() {
      setupSettingsPanel();
      setupThemeToggle();
      setupSettingsSelects();
      setupTabs();
      setupQuestionBar();
      setupSummarize();
      setupQuestionSubmit();
      setupQuiz();
    }
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();