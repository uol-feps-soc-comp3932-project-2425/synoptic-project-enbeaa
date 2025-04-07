// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  const fileInput = document.getElementById('fileInput');
  const importBtn = document.getElementById('importBtn');
  const tabBtns = document.querySelectorAll('.tab-btn');
  
  // tabs
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(content => {
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
        
        chrome.storage.local.set({ designTokens: jsonData }, function() {
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
  chrome.storage.local.get(['designTokens'], function(result) {
    if (result.designTokens) {
      displayTokenSummary(result.designTokens);
    }
  });

  // check for stored element
  chrome.storage.local.get(['selectedElementData'], function(result) {
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
  
  const colorTokens = tokens.tokens.filter(t => t.type === 'color').length;
  const spacingTokens = tokens.tokens.filter(t => t.type === 'spacing').length;
  const typographyTokens = tokens.tokens.filter(t => t.type === 'typography').length;
  
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
  console.log("Starting element selection process");
  
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || tabs.length === 0) {
      console.error("No active tab found");
      alert("Error: Could not find the active tab. Please try again.");
      return;
    }
    
    const activeTab = tabs[0];
    
    // request content-script
    chrome.runtime.sendMessage({
      action: 'startElementSelection',
      tabId: activeTab.id
    }, function(response) {
      console.log("Background response:", response);
      
      if (response && response.success) {
        window.close();
      } else {
        const errorMsg = response && response.error ? response.error : "Could not activate element selection";
        alert("Error: " + errorMsg);
      }
    });
  });
}

function handleElementSelected(data) {
  console.log("selected element:", data);

  if (!data || !data.styles) {
    console.error("Invalid element data received:", data);
    alert("Error: Invalid element data received. Please try selecting another element.");
    return;
  }
  
  chrome.storage.local.set({ selectedElementData: data }, function() {
    console.log('Element data saved to storage');
    const tasksTab = document.getElementById('tasks-tab');
    if (tasksTab) {
      const styles = data.styles || {};
      const padding = styles.padding || { top: '0px', right: '0px', bottom: '0px', left: '0px' };
      const margin = styles.margin || { top: '0px', right: '0px', bottom: '0px', left: '0px' };
      
      tasksTab.innerHTML = `
        <div class="section">
          <h2>Selected Element</h2>
          <p><strong>Tag:</strong> ${data.tagName || 'Unknown'}</p>
          ${data.id ? `<p><strong>ID:</strong> ${data.id}</p>` : ''}
          ${data.className ? `<p><strong>Class:</strong> ${data.className}</p>` : ''}
          <div class="style-preview">
            <h3>Captured Styles</h3>
            <p><strong>Color:</strong> <span style="display:inline-block; width:12px; height:12px; background-color:${styles.color || 'transparent'}; border:1px solid #ccc; margin-right:5px;"></span>${styles.color || 'N/A'}</p>
            <p><strong>Background:</strong> <span style="display:inline-block; width:12px; height:12px; background-color:${styles.backgroundColor || 'transparent'}; border:1px solid #ccc; margin-right:5px;"></span>${styles.backgroundColor || 'N/A'}</p>
            <p><strong>Font Size:</strong> ${styles.fontSize || 'N/A'}</p>
            <p><strong>Font Weight:</strong> ${styles.fontWeight || 'N/A'}</p>
            <p><strong>Padding:</strong> ${padding.top || '0px'} ${padding.right || '0px'} ${padding.bottom || '0px'} ${padding.left || '0px'}</p>
            <p><strong>Margin:</strong> ${margin.top || '0px'} ${margin.right || '0px'} ${margin.bottom || '0px'} ${margin.left || '0px'}</p>
          </div>
          <button class="compare-button" id="selectAgainBtn"><i class="fas fa-crosshairs"></i>Select Another Element</button>
        </div>
      `;
      
      const selectAgainBtn = document.getElementById('selectAgainBtn');
      if (selectAgainBtn) {
        selectAgainBtn.addEventListener('click', startElementSelection);
      }
      
      const tasksTabBtn = document.querySelector('.tab-btn[data-tab="tasks"]');
      if (tasksTabBtn) {
        tasksTabBtn.click();
      }
    }
  });
}