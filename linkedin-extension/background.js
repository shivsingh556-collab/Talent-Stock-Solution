chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'OPEN_LINKEDIN_SEARCH') {
    const q = encodeURIComponent(message.query || 'recruiter candidates');
    chrome.tabs.create({ url: `https://www.linkedin.com/search/results/people/?keywords=${q}` });
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === 'OPEN_TODO') {
    chrome.storage.local.get(['todoAppUrl'], async res => {
      const savedUrl = res.todoAppUrl || 'https://todo-resume-intelligence.vercel.app/';
      try {
        const tabs = await chrome.tabs.query({});
        const todoTab = tabs.find(tab => {
          const url = String(tab.url || '');
          return url.includes('todo-resume-intelligence') || url.includes('todo.talent-stock.com');
        });
        if (todoTab?.id) {
          await chrome.tabs.update(todoTab.id, { active: true, url: savedUrl });
          if (todoTab.windowId != null) await chrome.windows.update(todoTab.windowId, { focused: true });
          sendResponse({ ok: true, reused: true, url: savedUrl });
          return;
        }
        await chrome.tabs.create({ url: savedUrl });
        sendResponse({ ok: true, reused: false, url: savedUrl });
      } catch (error) {
        chrome.tabs.create({ url: savedUrl });
        sendResponse({ ok: false, url: savedUrl, error: String(error?.message || error) });
      }
    });
    return true;
  }
});
