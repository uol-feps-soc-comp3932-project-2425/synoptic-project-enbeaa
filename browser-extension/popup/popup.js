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

function findMatchingTokensByHierarchy(elementData, designTokens) {
  if (!designTokens || !designTokens.tokens) {
    console.log('Missing design tokens for matching');
    return [];
  }

  const styles = elementData.styles || elementData;
  if (!styles || typeof styles !== 'object') {
    console.error('No valid styles found in data:', elementData);
    return [];
  }

  console.log('Using existing hierarchical styles data for matching');
  const elementDepth = calculateElementDepth(styles);
  console.log('Calculated element depth:', elementDepth);

  const matches = [];

  designTokens.tokens.forEach((token) => {
    const tokenDepth = token.path.length;
    let matchScore = 0;

    // check depth similarity
    const depthDifference = Math.abs(elementDepth - tokenDepth);
    if (depthDifference === 0) matchScore += 30;
    else if (depthDifference === 1) matchScore += 20;
    else if (depthDifference <= 2) matchScore += 10;
    else matchScore += 5;

    // check style matching
    matchScore += scoreStyleMatch(styles, token);

    // if score is good, add to matches
    if (matchScore > 15) {
      matches.push({
        token: token,
        score: matchScore,
      });
    }
  });

  matches.sort((a, b) => b.score - a.score);

  console.log(`Found ${matches.length} potential matches`);

  // Return top matches
  return matches.map((match) => ({
    ...match.token,
    matchScore: match.score,
  }));
}

function calculateElementDepth(styles) {
  if (!styles) return 0;
  if (!styles.children || styles.children.length === 0) return 1;

  let maxChildDepth = 0;
  styles.children.forEach((child) => {
    const childDepth = calculateElementDepth(child);
    maxChildDepth = Math.max(maxChildDepth, childDepth);
  });

  return 1 + maxChildDepth;
}

function scoreStyleMatch(styles, token) {
  let score = 0;

  score += scoreNodeStyleMatch(styles, token);

  // check children is th token is deeper in hierarchy
  if (token.path.length > 1 && styles.children && styles.children.length > 0) {
    styles.children.forEach((child) => {
      score = Math.max(score, scoreStyleMatch(child, token));
    });
  }

  return score;
}

// Helper function to score a single node's style match with a token
function scoreNodeStyleMatch(nodeStyles, token) {
  let score = 0;

  if (token.type === 'color') {
    if (token.name.includes('fill') || token.name.includes('background')) {
      const nodeBgColor = extractRgbFromCssColor(nodeStyles.backgroundColor);
      if (nodeBgColor && isColorSimilar(token.value, nodeBgColor)) {
        score += 40;
      }
    } else {
      const nodeColor = extractRgbFromCssColor(nodeStyles.color);
      if (nodeColor && isColorSimilar(token.value, nodeColor)) {
        score += 40;
      }
    }
  } else if (token.type === 'typography') {
    if (token.name.includes('fontSize')) {
      const nodeFontSize = parseInt(nodeStyles.fontSize);
      if (!isNaN(nodeFontSize) && Math.abs(nodeFontSize - token.value) <= 2) {
        score += 35;
      }
    } else if (token.name.includes('font') && token.value && token.value.family) {
      const nodeFont = nodeStyles.fontFamily || '';
      if (nodeFont.toLowerCase().includes(token.value.family.toLowerCase())) {
        score += 30;
      }
    }
  } else if (token.type === 'spacing') {
    if (token.name.includes('padding') && nodeStyles.padding) {
      let nodePadding = null;

      if (token.name.includes('Left')) {
        nodePadding = parseInt(nodeStyles.padding.left);
      } else if (token.name.includes('Right')) {
        nodePadding = parseInt(nodeStyles.padding.right);
      } else if (token.name.includes('Top')) {
        nodePadding = parseInt(nodeStyles.padding.top);
      } else if (token.name.includes('Bottom')) {
        nodePadding = parseInt(nodeStyles.padding.bottom);
      }

      if (nodePadding !== null && !isNaN(nodePadding) && Math.abs(nodePadding - token.value) <= 4) {
        score += 35;
      }
    }
  }

  return score;
}

function extractRgbFromCssColor(cssColor) {
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

function isColorSimilar(color1, color2) {
  if (!color1 || !color2) return false;

  const threshold = 25; // RGB difference tolerance

  const rDiff = Math.abs((color1.r || 0) - (color2.r || 0));
  const gDiff = Math.abs((color1.g || 0) - (color2.g || 0));
  const bDiff = Math.abs((color1.b || 0) - (color2.b || 0));

  return rDiff <= threshold && gDiff <= threshold && bDiff <= threshold;
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

  // Log the hierarchy info
  console.log('ELEMENT HIERARCHY INFO:');
  console.log('Tag:', data.tagName);
  console.log('ID:', data.id || 'None');
  console.log('Classes:', data.className || 'None');

  // Get design tokens from storage
  chrome.storage.local.get(['designTokens'], function (result) {
    if (!result.designTokens) {
      console.log('No design tokens found in storage');
      displayComparisonResults({
        error: 'No design tokens found. Please import design tokens first.',
      });
      return;
    }

    const designTokens = result.designTokens;
    console.log('Found design tokens:', designTokens.tokens.length);

    const matchingTokens = findMatchingTokensByHierarchy(data, designTokens);
    console.log('Matching tokens:', matchingTokens);

    displayComparisonResults({
      element: data,
      matchingTokens: matchingTokens,
    });
  });
}

function displayComparisonResults(results) {
  const resultsContainer = document.getElementById('comparison-results');
  if (!resultsContainer) return;

  if (results.error) {
    resultsContainer.innerHTML = `
      <div class="section">
        <p>${results.error}</p>
      </div>
    `;
    return;
  }

  const element = results.element;
  const matchingTokens = results.matchingTokens || [];

  let html = `
    <div class="section">
      <h2>Element Information</h2>
      <p>Tag: <strong>${element.tagName || 'Unknown'}</strong></p>
      ${element.id ? `<p>ID: <strong>#${element.id}</strong></p>` : ''}
      ${element.className ? `<p>Classes: <strong>${element.className}</strong></p>` : ''}
      ${element.hierarchyInfo ? `<p>Depth: <strong>${element.hierarchyInfo.depth}</strong></p>` : ''}
    </div>
    
    <div class="section">
      <h2>Comparison Summary</h2>
      <div class="token-counts">
        <div class="token-count">Total Tokens: <strong>${matchingTokens.length}</strong></div>
        <div class="token-count">Matched: <strong>${matchingTokens.length}</strong></div>
        <div class="token-count">Match Rate: <strong>100%</strong></div>
      </div>
    </div>
  `;

  if (matchingTokens.length > 0) {
    html += `
      <div class="section">
        <h2>Matching Tokens (${matchingTokens.length})</h2>
        <div class="matches-list">
    `;

    matchingTokens.forEach((token) => {
      const tokenTypeBadge = `<span class="token-type token-type-${token.type}">${token.type}</span>`;
      let colorSample = '';
      if (token.type === 'color' && token.value) {
        const { r, g, b, a = 1 } = token.value;
        colorSample = `<span class="color-sample" style="background-color: rgba(${r}, ${g}, ${b}, ${a});"></span>`;
      }

      const formattedPath = token.path
        .map(
          (p, i) =>
            `<span class="path-item">${p}</span>${
              i < token.path.length - 1 ? '<span class="path-separator">›</span>' : ''
            }`
        )
        .join('');

      const scorePercentage = token.matchScore ? Math.min(100, Math.round((token.matchScore / 100) * 100)) : 0;

      html += `
        <div class="match-item">
          <p>Token: <strong>${token.name}</strong> ${tokenTypeBadge}</p>
          <p class="element-path">${formattedPath}</p>
          <p>Value: <span style="color: #4CAF50;">${colorSample}${formatTokenValue(token)}</span></p>
          <div class="match-score">
            Match Score: <strong>${token.matchScore || 'N/A'}</strong>
            <div class="score-bar">
              <div class="score-fill" style="width: ${scorePercentage}%;"></div>
            </div>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="section">
        <p>No matching tokens found. Try selecting a different element.</p>
      </div>
    `;
  }

  resultsContainer.innerHTML = html;

  const tasksTabBtn = document.querySelector('.tab-btn[data-tab="tasks"]');
  if (tasksTabBtn) {
    tasksTabBtn.click();
  }
}

function formatTokenValue(token) {
  if (!token || !token.value) return 'N/A';

  if (token.type === 'color') {
    const { r, g, b, a = 1 } = token.value;
    return `RGB(${r}, ${g}, ${b}${a < 1 ? `, ${a}` : ''})`;
  }

  if (token.type === 'typography') {
    if (token.name.includes('fontSize')) {
      return `${token.value}px`;
    }
    if (token.value.family) {
      return `${token.value.family} ${token.value.style || ''}`;
    }
  }

  if (token.type === 'spacing') {
    return `${token.value}px`;
  }

  return JSON.stringify(token.value);
}
