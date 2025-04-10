console.log('SpotLight content script loaded');

let isSelectionActive = false;
let highlightOverlay = null;
let selectionMessage = null;
let selectedRootElement = null;

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

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.marginLeft = '10px';
  cancelBtn.style.background = '#ffffff30';
  cancelBtn.style.border = 'none';
  cancelBtn.style.padding = '5px 10px';
  cancelBtn.style.borderRadius = '3px';
  cancelBtn.style.color = 'white';
  cancelBtn.style.cursor = 'pointer';

  cancelBtn.addEventListener('click', function (e) {
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
  highlightOverlay.style.top = rect.top + window.scrollY + 'px';
  highlightOverlay.style.left = rect.left + window.scrollX + 'px';
  highlightOverlay.style.width = rect.width + 'px';
  highlightOverlay.style.height = rect.height + 'px';
  highlightOverlay.style.display = 'block';
}
function handleMouseOver(e) {
  if (!isSelectionActive) return;
  if (
    e.target.id === 'spotlight-overlay' ||
    e.target.id === 'spotlight-message' ||
    e.target.closest('#spotlight-message')
  ) {
    return;
  }

  positionHighlight(e.target);
}
function handleClick(e) {
  if (!isSelectionActive) return;

  if (
    e.target.id === 'spotlight-overlay' ||
    e.target.id === 'spotlight-message' ||
    e.target.closest('#spotlight-message')
  ) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  const selectedElement = e.target;
  selectedRootElement = selectedElement;
  console.log('Selected element:', selectedElement.tagName);

  try {
    const styles = getElementStyles(selectedElement, null);
    console.log(
      'Extracted styles for',
      styles.tagName,
      'with',
      styles.children ? styles.children.length : 0,
      'children'
    );

    chrome.runtime
      .sendMessage({
        action: 'elementSelected',
        tagName: selectedElement.tagName.toLowerCase(),
        id: selectedElement.id,
        className: selectedElement.className,
        styles: styles,
      })
      .then((response) => {
        console.log('Element selection sent to background script, response:', response);
        showConfirmation();
        deactivateSelection();
      })
      .catch((error) => {
        console.error('Error sending element selection:', error);
        alert('Error sending selection data. Please try again.');
        deactivateSelection();
      });
  } catch (error) {
    console.error('Error in element selection process:', error);
    alert('Error during element selection. Please try again.');
    deactivateSelection();
  }
}

function showConfirmation() {
  const confirmation = document.createElement('div');
  confirmation.textContent = 'Element selected! Click the extension icon to see details.';
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

function getElementStyles(element, path = null) {
  try {
    console.log('Extracting styles for:', element.tagName, 'with path:', path);
    const computed = window.getComputedStyle(element);

    const styles = {
      tagName: element.tagName.toLowerCase(),
      id: element.id || '',
      classes: element.className ? element.className.split(' ').filter(Boolean) : [],
      path: path || element.tagName.toLowerCase(),
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
        left: computed.marginLeft || '0px',
      },
      padding: {
        top: computed.paddingTop || '0px',
        right: computed.paddingRight || '0px',
        bottom: computed.paddingBottom || '0px',
        left: computed.paddingLeft || '0px',
      },
      borderRadius: computed.borderRadius || '',
      children: [],
    };

    if (element.children && element.children.length > 0) {
      console.log(`Processing ${element.children.length} children for ${element.tagName}`);
      const maxChildren = 10;
      const processedChildren = Math.min(element.children.length, maxChildren);

      for (let i = 0; i < processedChildren; i++) {
        const child = element.children[i];

        const childPath = path
          ? `${path} > ${child.tagName.toLowerCase()}:nth-child(${i + 1})`
          : `${child.tagName.toLowerCase()}:nth-child(${i + 1})`;

        // get children recursively
        try {
          const childStyles = getElementStyles(child, childPath);
          if (childStyles) {
            styles.children.push(childStyles);
          }
        } catch (childError) {
          console.error(`Error processing child ${i}:`, childError);
          styles.children.push({
            tagName: child.tagName.toLowerCase(),
            error: childError.message,
          });
        }
      }

      // too many children
      if (element.children.length > maxChildren) {
        styles.children.push({
          tagName: 'note',
          info: `${element.children.length - maxChildren} more children not shown due to size limits`,
        });
      }
    }

    return styles;
  } catch (error) {
    console.error('Error getting styles for', element.tagName, error);
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || '',
      classes: element.className ? element.className.split(' ').filter(Boolean) : [],
      path: path || element.tagName.toLowerCase(),
      error: error.message,
      children: [],
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

  console.log('Activating element selection');
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

  console.log('Deactivating element selection');
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

// highlight variables
let mismatchHighlightOverlay = null;
let mismatchTooltip = null;
let highlightTimeout = null;

function createMismatchHighlightOverlay() {
  if (mismatchHighlightOverlay) return mismatchHighlightOverlay;

  const overlay = document.createElement('div');
  overlay.id = 'spotlight-mismatch-overlay';
  overlay.style.position = 'absolute';
  overlay.style.border = '3px solid #FF5722';
  overlay.style.backgroundColor = 'rgba(255, 87, 34, 0.15)';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '999999';
  overlay.style.display = 'none';
  overlay.style.boxShadow = '0 0 10px rgba(255, 87, 34, 0.5)';
  overlay.style.transition = 'opacity 0.3s';
  document.body.appendChild(overlay);

  mismatchHighlightOverlay = overlay;

  return overlay;
}

function findElementByNodePath(nodePath) {
  let element = selectedRootElement;

  if (!element) return null;

  for (const childIndex of nodePath) {
    if (element.children && childIndex < element.children.length) {
      element = element.children[childIndex];
    } else {
      return null;
    }
  }

  return element;
}

function highlightMismatchElement(element, property) {
  if (!element) return;

  const overlay = createMismatchHighlightOverlay();

  const rect = element.getBoundingClientRect();
  overlay.style.top = rect.top + window.scrollY + 'px';
  overlay.style.left = rect.left + window.scrollX + 'px';
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';

  overlay.style.display = 'block';

  let pulseCount = 0;
  const maxPulses = 3;

  const pulseAnimation = setInterval(() => {
    overlay.style.opacity = '0.4';

    setTimeout(() => {
      overlay.style.opacity = '1';
    }, 500);

    pulseCount++;
    if (pulseCount >= maxPulses) {
      clearInterval(pulseAnimation);
    }
  }, 1000);

  if (highlightTimeout) {
    clearTimeout(highlightTimeout);
  }

  highlightTimeout = setTimeout(() => {
    hideHighlight();
  }, 5000);

  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideHighlight() {
  if (mismatchHighlightOverlay) {
    mismatchHighlightOverlay.style.display = 'none';
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'highlightElement') {
    console.log('Got highlight request:', message);

    if (!selectedRootElement) {
      console.error('No root element selected');
      sendResponse({ success: false, error: 'No element was selected' });
      return true;
    }

    let element = selectedRootElement;
    const nodePath = message.nodePath || [];

    if (nodePath && nodePath.length > 0) {
      try {
        for (let i = 0; i < nodePath.length; i++) {
          const index = nodePath[i];
          if (element.children && index < element.children.length) {
            element = element.children[index];
          } else {
            console.warn(`Could not follow path at index ${i}, stopping at current element`);
            break;
          }
        }
      } catch (e) {
        console.error('Error following node path:', e);
      }
    }

    highlightMismatchElement(element, message.property);
    sendResponse({ success: true });

    return true;
  }

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
});
