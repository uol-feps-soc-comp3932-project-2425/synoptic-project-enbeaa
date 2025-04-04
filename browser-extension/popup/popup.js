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
      
      // Check if it's a JSON file
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        alert('Please select a valid JSON file');
        return;
      }
      
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          // Parse the JSON
          const jsonData = JSON.parse(event.target.result);
          
          // Basic validation of JSON structure
          if (!jsonData.tokens || !Array.isArray(jsonData.tokens)) {
            alert('Invalid design tokens format. Please ensure the file contains a "tokens" array.');
            return;
          }
          
          // Store the tokens in Chrome's local storage
          chrome.storage.local.set({ designTokens: jsonData }, function() {
            console.log('Design tokens saved to storage');
            
            // Show success message
            alert('Design tokens imported successfully!');
            
            // You could update the UI here to show token information
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
  });
  
  function displayTokenSummary(tokens) {
    let summarySection = document.getElementById('token-summary');
    
    if (!summarySection) {
      summarySection = document.createElement('div');
      summarySection.id = 'token-summary';
      summarySection.className = 'section';
      
      const importSection = document.querySelector('.section');
      importSection.parentNode.insertBefore(summarySection, importSection.nextSibling);
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
      <button class ="compare-button" id="analyzeBtn"><i class="fas fa-lightbulb"></i>Start Comparing</button>
    `;

    document.getElementById('analyzeBtn').addEventListener('click', () => {
      alert("todo");
    });
  }