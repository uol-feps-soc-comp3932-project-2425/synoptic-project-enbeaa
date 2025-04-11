export function extractRgbFromCssColor(cssColor) {
  if (!cssColor || cssColor === 'transparent' || cssColor === 'rgba(0, 0, 0, 0)') {
    return null;
  }
  const match = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
      a: match[4] ? parseFloat(match[4]) : 1,
    };
  }

  return null;
}

export function isColorSimilar(color1, color2, threshold = 25) {
  if (!color1 || !color2) return false;

  const rDiff = Math.abs((color1.r || 0) - (color2.r || 0));
  const gDiff = Math.abs((color1.g || 0) - (color2.g || 0));
  const bDiff = Math.abs((color1.b || 0) - (color2.b || 0));

  return rDiff <= threshold && gDiff <= threshold && bDiff <= threshold;
}

export function convertRgbToHex(rgb) {
  if (!rgb) return 'N/A';

  const toHex = (value) => {
    const hex = Math.round(value).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

export function showSuccess(message) {
  const notification = document.createElement('div');
  notification.className = 'notification success';
  notification.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

export function showError(message) {
  console.error(message);
  const notification = document.createElement('div');
  notification.className = 'notification error';
  notification.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

export function getElementInfo(styles, nodePath) {
  let currentNode = styles;

  for (const index of nodePath) {
    if (currentNode.children && currentNode.children.length > index) {
      currentNode = currentNode.children[index];
    } else {
      return { tag: 'Unknown', id: '', classes: [] };
    }
  }

  return {
    tag: currentNode.tagName || 'Unknown',
    id: currentNode.id || '',
    classes: currentNode.classes || [],
  };
}

export function addEventListenerWithCleanup(element, eventType, handler, options = false) {
  if (!element) return () => {};

  element.addEventListener(eventType, handler, options);

  return () => {
    element.removeEventListener(eventType, handler, options);
  };
}

export function getFromStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

export function setToStorage(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, resolve);
  });
}

export function switchToTab(tabName) {
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (tabBtn) {
    document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
    tabBtn.classList.add('active');

    document.querySelectorAll('.tab-content').forEach((content) => {
      content.style.display = 'none';
    });

    const tabId = `${tabName}-tab`;
    const tabContent = document.getElementById(tabId);
    if (tabContent) {
      tabContent.style.display = 'block';
    }
  }
}
