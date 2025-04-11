import { extractRgbFromCssColor, isColorSimilar, convertRgbToHex, showError, getElementInfo } from './helpers.js';

let currentTabId = null;

export function initializeTasksTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs.length > 0) {
      currentTabId = tabs[0].id;
    }
  });

  chrome.storage.local.get(['selectedElementData'], function (result) {
    if (result.selectedElementData) {
      handleElementSelected(result.selectedElementData);
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'elementSelected') {
      handleElementSelected(message);
      return true;
    }
  });
}

export function handleElementSelected(data) {
  console.log('Raw selected element data:', data);

  if (!data || typeof data !== 'object') {
    console.error('Invalid data structure received:', data);
    showError('Error: Invalid data received. Please try selecting another element.');
    return;
  }

  const styles = data.styles || data;
  if (!styles || typeof styles !== 'object') {
    console.error('No valid styles found in data:', data);
    showError('Error: No element styles found. Please try selecting another element.');
    return;
  }

  chrome.storage.local.get(['designTokens'], function (result) {
    if (!result.designTokens) {
      console.log('No design tokens found in storage');
      displayMismatches(data, []);
      return;
    }

    const designTokens = result.designTokens;
    console.log('Found design tokens:', designTokens.tokens.length);

    const matchingTokens = findMatchingTokensByHierarchy(data, designTokens);
    console.log('Matching tokens:', matchingTokens);
    displayMismatches(data, matchingTokens);
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

  const allMatches = [];

  // track which elements have certain properties already assigned to token
  const assignedPropertyTypes = new Set();

  // track elements with typography (helps identify between color/bgcolor)
  const elementsWithTypography = new Set();

  function getSpecificPropertyType(token) {
    if (token.type === 'color') {
      return token.name.includes('fill') || token.name.includes('background') ? 'backgroundColor' : 'textColor';
    }

    if (token.type === 'typography') {
      return token.name.includes('fontSize') ? 'fontSize' : 'fontFamily';
    }

    if (token.type === 'spacing') {
      if (token.name.includes('paddingLeft')) return 'paddingLeft';
      if (token.name.includes('paddingRight')) return 'paddingRight';
      if (token.name.includes('paddingTop')) return 'paddingTop';
      if (token.name.includes('paddingBottom')) return 'paddingBottom';
      if (token.name.includes('gap')) return 'gap';
      return 'spacing';
    }
    return token.type;
  }

  //recursively finds elements at a specific depth range
  function findElementsAtDepthRange(node, currentPath, targetDepth, results) {
    // targetdepth is should b 0 based
    const adjustedTargetDepth = Math.max(0, targetDepth - 1);
    const depthDiff = adjustedTargetDepth - currentPath.length;

    // add elements at the target ±1 for flexibility
    if (depthDiff === 0 || depthDiff === 1) {
      results.push({
        node: node,
        path: [...currentPath],
        depthDiff: depthDiff,
      });
    }

    // stop at target depth or if there's no more children
    if (depthDiff <= 0 || !node.children || node.children.length === 0) {
      return;
    }
    for (let i = 0; i < node.children.length; i++) {
      findElementsAtDepthRange(node.children[i], [...currentPath, i], targetDepth, results);
    }
  }

  function scoreNodeMatch(node, token, propertyType, depthDiff) {
    let score = 0;

    // score depth
    if (depthDiff === 0) {
      score += 20;
    } else if (depthDiff === 1) {
      score += 5;
    }

    if (token.type === 'color') {
      if (propertyType === 'backgroundColor') {
        const nodeBgColor = extractRgbFromCssColor(node.backgroundColor);
        if (nodeBgColor) {
          if (isColorSimilar(token.value, nodeBgColor)) {
            score += 40;
          } else {
            score += 5;
          }
        }
      } else {
        const nodeColor = extractRgbFromCssColor(node.color);
        if (nodeColor) {
          if (isColorSimilar(token.value, nodeColor)) {
            score += 40;
          } else {
            score += 5;
          }
        }
      }
    } else if (token.type === 'typography') {
      if (propertyType === 'fontSize') {
        const nodeFontSize = parseInt(node.fontSize);
        if (!isNaN(nodeFontSize)) {
          if (Math.abs(nodeFontSize - token.value) <= 2) {
            score += 35;
          } else {
            score += 5;
          }
        }
      } else if (propertyType === 'fontFamily') {
        const nodeFont = node.fontFamily || '';
        if (nodeFont) {
          if (nodeFont.toLowerCase().includes(token.value.family.toLowerCase())) {
            score += 30;
          } else {
            score += 5;
          }
        }
      }
    } else if (token.type === 'spacing') {
      if (node.padding) {
        if (propertyType === 'paddingLeft') {
          const nodePadding = parseInt(node.padding.left);
          if (!isNaN(nodePadding)) {
            if (Math.abs(nodePadding - token.value) <= 4) {
              score += 35;
            } else {
              score += 5;
            }
          }
        } else if (propertyType === 'paddingRight') {
          const nodePadding = parseInt(node.padding.right);
          if (!isNaN(nodePadding)) {
            if (Math.abs(nodePadding - token.value) <= 4) {
              score += 35;
            } else {
              score += 5;
            }
          }
        } else if (propertyType === 'paddingTop') {
          const nodePadding = parseInt(node.padding.top);
          if (!isNaN(nodePadding)) {
            if (Math.abs(nodePadding - token.value) <= 4) {
              score += 35;
            } else {
              score += 5;
            }
          }
        } else if (propertyType === 'paddingBottom') {
          const nodePadding = parseInt(node.padding.bottom);
          if (!isNaN(nodePadding)) {
            if (Math.abs(nodePadding - token.value) <= 4) {
              score += 35;
            } else {
              score += 5;
            }
          }
        } else if (propertyType === 'gap') {
          score += 5;
        }
      }
    }

    return score;
  }

  // sort tokens - typography highest priority to determine colour vs bg colour
  const sortedTokens = [...designTokens.tokens].sort((a, b) => {
    const typeOrder = { typography: 0, color: 1, spacing: 2 };
    return typeOrder[a.type] - typeOrder[b.type];
  });

  for (const token of sortedTokens) {
    const tokenDepth = token.path.length;
    const propertyType = getSpecificPropertyType(token);

    const elementsAtDepthRange = [];
    findElementsAtDepthRange(styles, [], tokenDepth, elementsAtDepthRange);

    let bestMatch = null;
    let bestScore = 0;

    for (const element of elementsAtDepthRange) {
      const pathKey = element.path.join(',');
      const propertyKey = `${pathKey}_${propertyType}`;

      // skip if element already has token of that type assigned (unless padding)
      const isPaddingProperty = propertyType.includes('padding');
      if (assignedPropertyTypes.has(propertyKey) && !isPaddingProperty) {
        continue;
      }

      let score = scoreNodeMatch(element.node, token, propertyType, element.depthDiff);

      // bonus for fill on text
      if (token.type === 'color' && token.name.includes('fill') && elementsWithTypography.has(pathKey)) {
        if (propertyType === 'textColor') {
          score += 25;
        } else {
          score -= 10;
        }
      }

      if (score > bestScore) {
        bestMatch = element;
        bestScore = score;
      }
    }

    // add best match token
    if (bestMatch && bestScore > 5) {
      console.log(
        `Assigning token ${token.name} to element at path [${bestMatch.path.join(', ')}] with score ${bestScore}`
      );

      allMatches.push({
        token: token,
        score: bestScore,
        nodePath: bestMatch.path,
      });

      // mark property type on element to prevent duplicates
      const pathKey = bestMatch.path.join(',');
      const propertyKey = `${pathKey}_${propertyType}`;
      const isPaddingProperty = propertyType.includes('padding');
      if (!isPaddingProperty) {
        assignedPropertyTypes.add(propertyKey);
      }

      if (token.type === 'typography') {
        elementsWithTypography.add(pathKey);
      }
    } else {
      console.log(`No good match found for token ${token.name}`);
    }
  }

  allMatches.sort((a, b) => b.score - a.score);

  return allMatches.map((match) => ({
    ...match.token,
    matchScore: match.score,
    nodePath: match.nodePath,
  }));
}

function extractActualStyleValue(styles, token) {
  let nodeStyles = styles;
  const nodePath = token.nodePath || [];

  // navigate to the target node
  for (let i = 0; i < nodePath.length; i++) {
    const index = nodePath[i];
    if (nodeStyles.children && nodeStyles.children.length > index) {
      nodeStyles = nodeStyles.children[index];
    } else {
      console.warn(`Could not follow path at index ${i}, path may be invalid`);
      break;
    }
  }

  // extract value for token
  if (token.type === 'color') {
    if (token.name.includes('fill') || token.name.includes('background')) {
      return {
        property: 'Background Color',
        value: extractRgbFromCssColor(nodeStyles.backgroundColor),
        displayValue: convertRgbToHex(extractRgbFromCssColor(nodeStyles.backgroundColor)),
        nodePath: nodePath,
      };
    } else {
      return {
        property: 'Text Color',
        value: extractRgbFromCssColor(nodeStyles.color),
        displayValue: convertRgbToHex(extractRgbFromCssColor(nodeStyles.color)),
        nodePath: nodePath,
      };
    }
  } else if (token.type === 'typography') {
    if (token.name.includes('fontSize')) {
      return {
        property: 'Font Size',
        value: parseInt(nodeStyles.fontSize),
        displayValue: nodeStyles.fontSize,
        nodePath: nodePath,
      };
    } else if (token.name.includes('font')) {
      let fontWeight = nodeStyles.fontWeight || '400';

      return {
        property: 'Font Weight',
        value: parseInt(fontWeight),
        displayValue: fontWeight,
        nodePath: nodePath,
      };
    }
  } else if (token.type === 'spacing') {
    if (!nodeStyles.padding) {
      return { property: 'Spacing', value: null, displayValue: 'N/A', nodePath: nodePath };
    }

    if (token.name.includes('paddingLeft')) {
      return {
        property: 'Padding Left',
        value: parseInt(nodeStyles.padding.left),
        displayValue: nodeStyles.padding.left,
        nodePath: nodePath,
      };
    } else if (token.name.includes('paddingRight')) {
      return {
        property: 'Padding Right',
        value: parseInt(nodeStyles.padding.right),
        displayValue: nodeStyles.padding.right,
        nodePath: nodePath,
      };
    } else if (token.name.includes('paddingTop')) {
      return {
        property: 'Padding Top',
        value: parseInt(nodeStyles.padding.top),
        displayValue: nodeStyles.padding.top,
        nodePath: nodePath,
      };
    } else if (token.name.includes('paddingBottom')) {
      return {
        property: 'Padding Bottom',
        value: parseInt(nodeStyles.padding.bottom),
        displayValue: nodeStyles.padding.bottom,
        nodePath: nodePath,
      };
    } else if (token.name.includes('gap')) {
      return {
        property: 'Gap',
        value: parseInt(nodeStyles.gap),
        displayValue: nodeStyles.gap || 'N/A',
        nodePath: nodePath,
      };
    }
  }

  return { property: token.type, value: null, displayValue: 'N/A', nodePath: nodePath };
}

function formatTokenValue(token) {
  if (!token || !token.value) return 'N/A';

  if (token.type === 'color') {
    const { r, g, b } = token.value;
    return convertRgbToHex({ r, g, b });
  }

  if (token.type === 'typography') {
    if (token.name.includes('fontSize')) {
      return `${token.value}px`;
    }
    if (token.value.family) {
      let weight = 400;
      if (token.value.style) {
        if (token.value.style.includes('Bold')) weight = 700;
        else if (token.value.style.includes('Semi Bold')) weight = 600;
        else if (token.value.style.includes('Medium')) weight = 500;
        else if (token.value.style.includes('Light')) weight = 300;
      }
      return weight.toString();
    }
  }

  if (token.type === 'spacing') {
    return token.value.toString();
  }

  return token.value.toString();
}

function isExactMismatch(tokenValue, actualValue, tokenType) {
  console.log('comparing', tokenValue, actualValue);
  if (tokenType === 'color') {
    if (!tokenValue || !actualValue.value) return true;

    return (
      tokenValue.r !== actualValue.value.r ||
      tokenValue.g !== actualValue.value.g ||
      tokenValue.b !== actualValue.value.b
    );
  } else if (tokenType === 'typography') {
    if (typeof tokenValue === 'number') {
      return tokenValue !== actualValue.value;
    } else if (tokenValue && tokenValue.style) {
      let expectedWeight = 400;
      if (tokenValue.style.includes('Bold')) expectedWeight = 700;
      else if (tokenValue.style.includes('Semi Bold')) expectedWeight = 600;
      else if (tokenValue.style.includes('Medium')) expectedWeight = 500;
      else if (tokenValue.style.includes('Light')) expectedWeight = 300;

      return expectedWeight !== actualValue.value;
    }
  } else if (tokenType === 'spacing') {
    return tokenValue !== actualValue.value;
  }

  return true;
}

function displayMismatches(element, matchingTokens) {
  const resultsContainer = document.getElementById('comparison-results');
  if (!resultsContainer) return;

  const allMismatches = [];

  matchingTokens.forEach((token) => {
    const actualValue = extractActualStyleValue(element.styles, token);
    const expectedValue = token.value;

    if (isExactMismatch(expectedValue, actualValue, token.type)) {
      allMismatches.push({
        property: actualValue.property,
        token: token,
        expected: {
          value: expectedValue,
          display: formatTokenValue(token),
        },
        actual: {
          value: actualValue.value,
          display: actualValue.displayValue,
          nodePath: actualValue.nodePath,
        },
        path: token.path.join('>'),
        elementPath: JSON.stringify(actualValue.nodePath),
      });
    }
  });

  let html = `
      <div class="section">
        <div class="eye-icon-container">
          <i class="fas fa-eye"></i> Spot the difference
        </div>
    `;

  const elementGroups = {};

  allMismatches.forEach((mismatch) => {
    const elementPath = mismatch.elementPath;
    if (!elementGroups[elementPath]) {
      elementGroups[elementPath] = [];
    }
    elementGroups[elementPath].push(mismatch);
  });

  Object.keys(elementGroups).forEach((elementPathStr) => {
    const mismatches = elementGroups[elementPathStr];
    const nodePath = JSON.parse(elementPathStr);

    let elementInfo = getElementInfo(element.styles, nodePath);

    html += `
        <div class="element-group">
          <div class="element-header" data-node-path='${elementPathStr}'>
            <span class="element-tag">${elementInfo.tag || 'Unknown'}</span>
            ${elementInfo.id ? `<span class="element-id">#${elementInfo.id}</span>` : ''}
            ${elementInfo.classes ? `<span class="element-classes">.${elementInfo.classes.join('.')}</span>` : ''}
            <button class="highlight-element-btn" title="Highlight this element">
              <i class="fas fa-eye"></i>
            </button>
          </div>
          <div class="element-mismatches">
      `;

    mismatches.sort((a, b) => {
      if (a.token.type !== b.token.type) {
        const typePriority = { color: 0, typography: 1, spacing: 2 };
        return typePriority[a.token.type] - typePriority[b.token.type];
      }
      return a.property.localeCompare(b.property);
    });

    mismatches.forEach((mismatch) => {
      let expectedDisplay = mismatch.expected.display;
      let actualDisplay = mismatch.actual.display;

      if (mismatch.property.includes('Color')) {
        expectedDisplay = `
            <div class="color-value">
              <div class="color-swatch" style="background-color: ${mismatch.expected.display};"></div>
              ${mismatch.expected.display}
            </div>
          `;

        actualDisplay = `
            <div class="color-value">
              <div class="color-swatch" style="background-color: ${mismatch.actual.display};"></div>
              ${mismatch.actual.display}
            </div>
          `;
      }

      html += `
          <div class="mismatch-row" data-property="${mismatch.property}" data-node-path='${JSON.stringify(
        mismatch.actual.nodePath
      )}'>
            <div>
              <div class="mismatch-property">${mismatch.property}</div>
              <div class="mismatch-values">
                <div class="expected-value">Expected value: ${expectedDisplay}</div>
                <div class="actual-value">Implemented value: ${actualDisplay}</div>
              </div>
            </div>
            <div class="mismatch-actions">
              <button class="comment-btn" title="Add comment"><i class="fas fa-comment"></i></button>
              <button class="lightbulb-btn" title="Highlight element on page"><i class="fas fa-lightbulb"></i></button>
            </div>
          </div>
        `;
    });

    html += `
          </div>
        </div>
      `;
  });

  html += `</div>`;

  resultsContainer.innerHTML = html;

  setupLightbulbListeners();
  setupElementHeaderListeners();

  const tasksTabBtn = document.querySelector('.tab-btn[data-tab="tasks"]');
  if (tasksTabBtn) {
    tasksTabBtn.click();
  }
}

function setupLightbulbListeners() {
  const lightbulbButtons = document.querySelectorAll('.lightbulb-btn');

  lightbulbButtons.forEach((button) => {
    button.addEventListener('click', function () {
      const mismatchRow = this.closest('.mismatch-row');
      const property = mismatchRow.getAttribute('data-property');
      let nodePath = [];

      const nodePathAttr = mismatchRow.getAttribute('data-node-path');

      try {
        if (nodePathAttr && nodePathAttr !== 'undefined') {
          nodePath = JSON.parse(nodePathAttr);
        }
      } catch (e) {
        console.error('Error parsing node path:', e);
      }

      console.log('Sending highlight request with nodePath:', nodePath);

      if (currentTabId) {
        chrome.tabs
          .sendMessage(currentTabId, {
            action: 'highlightElement',
            nodePath: nodePath,
            property: property,
          })
          .then((response) => {
            console.log('Highlight response:', response);
          })
          .catch((error) => {
            console.error('Error highlighting element:', error);
            showError('Error highlighting element');
          });
      } else {
        console.error('No active tab found');
        showError('No active tab found');
      }
    });
  });
}

function setupElementHeaderListeners() {
  const headerButtons = document.querySelectorAll('.element-header .highlight-element-btn');

  headerButtons.forEach((button) => {
    button.addEventListener('click', function () {
      const header = this.closest('.element-header');
      const nodePath = JSON.parse(header.getAttribute('data-node-path'));

      if (currentTabId) {
        chrome.tabs
          .sendMessage(currentTabId, {
            action: 'highlightElement',
            nodePath: nodePath,
            property: 'Element Highlight',
          })
          .then((response) => {
            console.log('Highlight response:', response);
          })
          .catch((error) => {
            console.error('Error highlighting element:', error);
            showError('Error highlighting element');
          });
      } else {
        console.error('No active tab found');
        showError('No active tab found');
      }
    });
  });
}
