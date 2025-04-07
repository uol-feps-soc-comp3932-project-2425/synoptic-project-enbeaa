// content-script.js - this runs in the context of the web page
console.log("SpotLight content script loaded");

// Global variables
let isSelectionActive = false;
let highlightOverlay = null;
let selectionMessage = null;

function createHighlightOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'spotlight-overlay';
  overlay.style.position = 'absolute';
  overlay.style.border = '2px dashed #8671FF';
  overlay.style.backgroundColor = 'rgba(134, 113, 255, 0.1)';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '999999';
  overlay.style.display = 'none';
  document.body.appendChild(overlay);
  return overlay;
}

function createSelectionMessage() {
  const message = document.createElement('div');
  message.id = 'spotlight-message';
  message.textContent = 'Click on any element to select it for comparison';
  message.style.position = 'fixed';
  message.style.top = '8px';
  message.style.left = '50%';
  message.style.transform = 'translateX(-50%)';
  message.style.backgroundColor = '#8671FF';
  message.style.color = 'white';
  message.style.padding = '10px 20px';
  message.style.borderRadius = '4px';
  message.style.zIndex = '999999';
  message.style.fontFamily = 'Arial, sans-serif';
  message.style.fontSize = '14px';
  message.style.fontWeight = 'bold';
  message.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
  message.style.display = 'none';
  
  // Add cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.marginLeft = '10px';
  cancelBtn.style.background = '#ffffff30';
  cancelBtn.style.border = 'none';
  cancelBtn.style.padding = '5px 10px';
  cancelBtn.style.borderRadius = '3px';
  cancelBtn.style.color = 'white';
  cancelBtn.style.cursor = 'pointer';
  
  cancelBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    deactivateSelection();
  });
  
  message.appendChild(cancelBtn);
  document.body.appendChild(message);
  return message;
}
function positionHighlight(element) {
  if (!highlightOverlay || !element) return;
  
  const rect = element.getBoundingClientRect();
  highlightOverlay.style.top = (rect.top + window.scrollY) + 'px';
  highlightOverlay.style.left = (rect.left + window.scrollX) + 'px';
  highlightOverlay.style.width = rect.width + 'px';
  highlightOverlay.style.height = rect.height + 'px';
  highlightOverlay.style.display = 'block';
}
function handleMouseOver(e) {
  if (!isSelectionActive) return;
  
  // Don't highlight our own UI elements
  if (e.target.id === 'spotlight-overlay' || 
      e.target.id === 'spotlight-message' ||
      e.target.closest('#spotlight-message')) {
    return;
  }
  
  positionHighlight(e.target);
}
function handleClick(e) {
  if (!isSelectionActive) return;
  
  // Don't select our own UI elements
  if (e.target.id === 'spotlight-overlay' || 
      e.target.id === 'spotlight-message' ||
      e.target.closest('#spotlight-message')) {
    return;
  }
  
  e.preventDefault();
  e.stopPropagation();
  
  const selectedElement = e.target;
  const styles = getElementStyles(selectedElement);
  
  // Send the data back to the background script
  chrome.runtime.sendMessage({
    action: 'elementSelected',
    tagName: selectedElement.tagName.toLowerCase(),
    id: selectedElement.id,
    className: selectedElement.className,
    styles: styles
  }).then(response => {
    console.log("Element selection sent to background script, response:", response);
    
    // Show confirmation
    showConfirmation();
    
    // Deactivate selection
    deactivateSelection();
  }).catch(error => {
    console.error("Error sending element selection:", error);
    alert("Error sending selection data. Please try again.");
    deactivateSelection();
  });
}

function showConfirmation() {
  const confirmation = document.createElement('div');
  confirmation.textContent = "Element selected! Click the extension icon to see details.";
  confirmation.style.position = 'fixed';
  confirmation.style.top = '10px';
  confirmation.style.left = '50%';
  confirmation.style.transform = 'translateX(-50%)';
  confirmation.style.backgroundColor = '#4CAF50';
  confirmation.style.color = 'white';
  confirmation.style.padding = '10px 20px';
  confirmation.style.borderRadius = '5px';
  confirmation.style.zIndex = '999999';
  confirmation.style.fontFamily = 'Arial, sans-serif';
  confirmation.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
  
  document.body.appendChild(confirmation);
  
  setTimeout(() => {
    confirmation.remove();
  }, 3000);
}

function getElementStyles(element) {
  try {
    const computed = window.getComputedStyle(element);
    
    return {
      color: computed.color || '',
      backgroundColor: computed.backgroundColor || '',
      fontSize: computed.fontSize || '',
      fontFamily: computed.fontFamily || '',
      fontWeight: computed.fontWeight || '',
      lineHeight: computed.lineHeight || '',
      margin: {
        top: computed.marginTop || '0px',
        right: computed.marginRight || '0px',
        bottom: computed.marginBottom || '0px',
        left: computed.marginLeft || '0px'
      },
      padding: {
        top: computed.paddingTop || '0px',
        right: computed.paddingRight || '0px',
        bottom: computed.paddingBottom || '0px',
        left: computed.paddingLeft || '0px'
      },
      borderRadius: computed.borderRadius || ''
    };
  } catch (error) {
    console.error("Error getting computed styles:", error);
    return {
      color: '',
      backgroundColor: '',
      fontSize: '',
      fontFamily: '',
      fontWeight: '',
      lineHeight: '',
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      padding: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      borderRadius: ''
    };
  }
}

function handleKeyDown(e) {
  if (e.key === 'Escape' && isSelectionActive) {
    deactivateSelection();
  }
}

function activateSelection() {
  if (isSelectionActive) return;
  
  console.log("Activating element selection");
  isSelectionActive = true;
  
  if (!highlightOverlay) {
    highlightOverlay = createHighlightOverlay();
  }
  if (!selectionMessage) {
    selectionMessage = createSelectionMessage();
  }
  
  selectionMessage.style.display = 'block';
  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  document.body.style.cursor = 'crosshair';
}

function deactivateSelection() {
  if (!isSelectionActive) return;
  
  console.log("Deactivating element selection");
  isSelectionActive = false;
  
  if (highlightOverlay) {
    highlightOverlay.style.display = 'none';
  }
  if (selectionMessage) {
    selectionMessage.style.display = 'none';
  }
  
  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  document.body.style.cursor = '';
}

// listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message);
  
  if (message.action === 'activateElementSelection') {
    activateSelection();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'deactivateElementSelection') {
    deactivateSelection();
    sendResponse({ success: true });
    return true;
  }
  
  return false;
});