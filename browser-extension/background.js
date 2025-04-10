console.log('SpotLight background script running');
const selectionActiveTabs = new Set();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message, 'from:', sender);

  if (message.action === 'startElementSelection') {
    const tabId = message.tabId;

    // inject element selection script
    chrome.scripting
      .executeScript({
        target: { tabId: tabId },
        files: ['content-script.js'],
      })
      .then(() => {
        console.log('Content script injected successfully in tab', tabId);

        chrome.tabs
          .sendMessage(tabId, { action: 'activateElementSelection' })
          .then((response) => {
            console.log('Selection activated, response:', response);
            selectionActiveTabs.add(tabId);
            sendResponse({ success: true });
          })
          .catch((error) => {
            console.error('Failed to activate selection:', error);
            sendResponse({ success: false, error: error.message });
          });
      })
      .catch((error) => {
        console.error('Failed to inject content script:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  if (message.action === 'elementSelected' && sender.tab) {
    console.log('Element selected in tab', sender.tab.id);

    const safeData = {
      action: message.action,
      tagName: message.tagName || 'unknown',
      id: message.id || '',
      className: message.className || '',
      styles: message.styles || {
        color: '',
        backgroundColor: '',
        fontSize: '',
        fontFamily: '',
        fontWeight: '',
        lineHeight: '',
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
        padding: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
        borderRadius: '',
      },
    };

    chrome.storage.local.set(
      {
        selectedElementData: safeData,
        selectionTabId: sender.tab.id,
      },
      () => {
        console.log('Element data saved to storage');
        selectionActiveTabs.delete(sender.tab.id);
      }
    );

    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'highlightElement') {
    console.log('Background received highlight request:', message);

    // forward to content script
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs.length > 0) {
        chrome.tabs
          .sendMessage(tabs[0].id, message)
          .then((response) => {
            console.log('Highlight response:', response);
            sendResponse(response);
          })
          .catch((error) => {
            console.error('Error sending highlight message:', error);
            sendResponse({ success: false, error: error.message });
          });
      } else {
        console.error('No active tab found');
        sendResponse({ success: false, error: 'No active tab found' });
      }
    });

    return true;
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  selectionActiveTabs.delete(tabId);
});
