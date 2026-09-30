chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'TODO_AI_OPEN_NAUKRI') {
    chrome.tabs.create({ url: 'https://recruit.naukri.com/' }, tab => {
      sendResponse({ ok: true, tabId: tab?.id || null });
    });
    return true;
  }
});
