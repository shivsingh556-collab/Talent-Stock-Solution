chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'OPEN_LINKEDIN_SEARCH') {
    const q = encodeURIComponent(message.query || 'recruiter candidates');
    chrome.tabs.create({ url: `https://www.linkedin.com/search/results/people/?keywords=${q}` });
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === 'OPEN_TODO') {
    chrome.storage.local.get(['todoAppOrigin'], res => {
      const url = res.todoAppOrigin || 'https://todo-resume-intelligence.vercel.app/';
      chrome.tabs.create({ url });
      sendResponse({ ok: true, url });
    });
    return true;
  }
});
