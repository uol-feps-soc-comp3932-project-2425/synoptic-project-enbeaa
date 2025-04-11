import { showError, showSuccess, setToStorage } from './helpers.js';

export function initializeOverviewTab(fileInput, importBtn) {
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      importTokens(fileInput);
    });
  }

  loadStoredTokens();
}

function importTokens(fileInput) {
  if (!fileInput || !fileInput.files.length) {
    showError('Please select a JSON file first');
    return;
  }

  const file = fileInput.files[0];

  if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
    showError('Please select a valid JSON file');
    return;
  }

  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const jsonData = JSON.parse(event.target.result);

      if (!jsonData.tokens || !Array.isArray(jsonData.tokens)) {
        showError('Invalid design tokens format. Please ensure the file contains a "tokens" array.');
        return;
      }

      chrome.storage.local.set({ designTokens: jsonData }, function () {
        console.log('Design tokens saved to storage');
        showSuccess('Design tokens imported successfully!');
        displayTokenSummary(jsonData);
      });
    } catch (error) {
      console.error('Error parsing JSON:', error);
      showError('Error parsing JSON file. Please make sure it is valid.');
    }
  };

  reader.readAsText(file);
}

function loadStoredTokens() {
  chrome.storage.local.get(['designTokens'], function (result) {
    if (result.designTokens) {
      displayTokenSummary(result.designTokens);
    }
  });
}

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
      showError('Error: Could not find the active tab. Please try again.');
      return;
    }

    const activeTab = tabs[0];

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
          showError('Error: ' + errorMsg);
        }
      }
    );
  });
}
