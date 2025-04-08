document.addEventListener('DOMContentLoaded', function () {
  const fileInput = document.getElementById('fileInput');
  const importBtn = document.getElementById('importBtn');
  const tabBtns = document.querySelectorAll('.tab-btn');

  // tabs
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach((content) => {
        content.style.display = 'none';
      });
      const tabId = btn.getAttribute('data-tab') + '-tab';
      document.getElementById(tabId).style.display = 'block';
    });
  });

  // import
  importBtn.addEventListener('click', () => {
    if (!fileInput.files.length) {
      alert('Please select a JSON file first');
      return;
    }

    const file = fileInput.files[0];

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      alert('Please select a valid JSON file');
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);

        if (!jsonData.tokens || !Array.isArray(jsonData.tokens)) {
          alert('Invalid design tokens format. Please ensure the file contains a "tokens" array.');
          return;
        }

        chrome.storage.local.set({ designTokens: jsonData }, function () {
          console.log('Design tokens saved to storage');

          alert('Design tokens imported successfully!');

          displayTokenSummary(jsonData);
        });
      } catch (error) {
        console.error('Error parsing JSON:', error);
        alert('Error parsing JSON file. Please make sure it is valid.');
      }
    };

    reader.readAsText(file);
  });

  // check for stored tokens
  chrome.storage.local.get(['designTokens'], function (result) {
    if (result.designTokens) {
      displayTokenSummary(result.designTokens);
    }
  });

  // check for stored element
  chrome.storage.local.get(['selectedElementData'], function (result) {
    if (result.selectedElementData) {
      handleElementSelected(result.selectedElementData);
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'elementSelected') {
      handleElementSelected(message);
    }
    return true;
  });
});

function displayTokenSummary(tokens) {
  let summarySection = document.getElementById('token-summary');

  if (!summarySection) {
    summarySection = document.createElement('div');
    summarySection.id = 'token-summary';
    summarySection.className = 'section';

    const importSection = document.querySelector('.section');
    if (importSection && importSection.parentNode) {
      importSection.parentNode.insertBefore(summarySection, importSection.nextSibling);
    } else {
      const overviewTab = document.getElementById('overview-tab');
      if (overviewTab) {
        overviewTab.appendChild(summarySection);
      }
    }
  }

  const colorTokens = tokens.tokens.filter((t) => t.type === 'color').length;
  const spacingTokens = tokens.tokens.filter((t) => t.type === 'spacing').length;
  const typographyTokens = tokens.tokens.filter((t) => t.type === 'typography').length;

  summarySection.innerHTML = `
    <h2>Imported Tokens</h2>
    <div class="token-file-header">
      <p>Frame: <strong>${tokens.frameName || 'Unknown'}</strong></p>
      <p>Total tokens: <strong>${tokens.tokens.length}</strong></p>
    </div>
    <div class="token-counts">
      <div class="token-count">Color: <strong>${colorTokens}</strong></div>
      <div class="token-count">Spacing: <strong>${spacingTokens}</strong></div>
      <div class="token-count">Typography: <strong>${typographyTokens}</strong></div>
    </div>
    <button class="compare-button" id="analyzeBtn"><i class="fas fa-lightbulb"></i>Start Comparing</button>
  `;

  const analyzeBtn = document.getElementById('analyzeBtn');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', startElementSelection);
  }
}

function startElementSelection() {
  console.log('Starting element selection process');

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs || tabs.length === 0) {
      console.error('No active tab found');
      alert('Error: Could not find the active tab. Please try again.');
      return;
    }

    const activeTab = tabs[0];

    // request content-script
    chrome.runtime.sendMessage(
      {
        action: 'startElementSelection',
        tabId: activeTab.id,
      },
      function (response) {
        console.log('Background response:', response);

        if (response && response.success) {
          window.close();
        } else {
          const errorMsg = response && response.error ? response.error : 'Could not activate element selection';
          alert('Error: ' + errorMsg);
        }
      }
    );
  });
}

function handleElementSelected(data) {
  console.log('Raw selected element data:', data);

  if (!data || typeof data !== 'object') {
    console.error('Invalid data structure received:', data);
    alert('Error: Invalid data received. Please try selecting another element.');
    return;
  }

  const styles = data.styles || data;
  if (!styles || typeof styles !== 'object') {
    console.error('No valid styles found in data:', data);
    alert('Error: No element styles found. Please try selecting another element.');
    return;
  }

  // logs for debugging
  console.log('ELEMENT HIERARCHY DATA:');
  console.log('Root element:', styles.tagName);
  console.log('ID:', styles.id || 'None');
  console.log('Classes:', styles.classes || 'None');
  console.log('Children count:', styles.children ? styles.children.length : 0);

  console.log('Full Element Data:');
  console.log(JSON.stringify(styles, null, 2));

  function logHierarchy(element, level = 0) {
    const indent = '  '.repeat(level);
    const tag = element.tagName || 'unknown';
    const id = element.id ? `#${element.id}` : '';
    const classes = element.classes && element.classes.length ? `.${element.classes.join('.')}` : '';
    const selector = `${tag}${id}${classes}`;

    console.log(`${indent}${selector}`);

    if (element.children && element.children.length > 0) {
      element.children.forEach((child) => {
        logHierarchy(child, level + 1);
      });
    }
  }

  // hierarchy
  console.log('------------------------');
  console.log('ELEMENT HIERARCHY TREE:');
  console.log('------------------------');
  logHierarchy(styles);
}
