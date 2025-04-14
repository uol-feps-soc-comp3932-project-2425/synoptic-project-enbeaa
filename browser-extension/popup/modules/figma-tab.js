import figmaApi from '../figma/figma-api.js';
import { showSuccess, showError, getFromStorage, setToStorage } from './helpers.js';

let currentCommentData = null;
let currentTabId = null;

export function initializeFigmaTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs.length > 0) {
      currentTabId = tabs[0].id;
    }
  });

  setupFigmaTab();
  setupCommentModal();
  initializeCommentButtons();
}

async function setupFigmaTab() {
  await updateAuthStatus();
  await loadLinkedFiles();

  const figmaAuthBtn = document.getElementById('figma-auth-btn');
  if (figmaAuthBtn) {
    figmaAuthBtn.addEventListener('click', async () => {
      if (figmaApi.isAuthenticated()) {
        await figmaApi.logout();
      } else {
        await figmaApi.authenticate();
      }

      await updateAuthStatus();
    });
  }

  const figmaLinkBtn = document.getElementById('figma-link-btn');
  if (figmaLinkBtn) {
    figmaLinkBtn.addEventListener('click', async () => {
      const figmaFileUrl = document.getElementById('figma-file-url');
      console.log(figmaFileUrl.value);
      const url = figmaFileUrl.value;
      if (!url) {
        showError('Please enter a valid Figma file URL');
        return;
      }

      try {
        const result = await getFromStorage('designTokens');

        if (!result.designTokens) {
          showError('Please import design tokens first');
          return;
        }

        const tokensId = result.designTokens.frameName || 'default';
        await figmaApi.addFigmaFile(url, tokensId);

        figmaFileUrl.value = '';
        showSuccess('Figma file linked successfully');

        await loadLinkedFiles();
      } catch (error) {
        showError(`Failed to link Figma file: ${error.message}`);
      }
    });
  }
}

async function updateAuthStatus() {
  const isAuthenticated = figmaApi.isAuthenticated();
  const figmaAuthStatus = document.getElementById('figma-auth-status');
  const figmaFileSection = document.querySelector('.figma-file-section');

  if (figmaAuthStatus) {
    if (isAuthenticated) {
      figmaAuthStatus.innerHTML = `
        <div class="auth-indicator logged-in">
          <i class="fas fa-check-circle"></i>
          <p>Connected to Figma</p>
        </div>
        <button id="figma-auth-btn" class="secondary-btn">
          <i class="fas fa-sign-out-alt"></i> Disconnect Account
        </button>
      `;

      if (figmaFileSection) {
        figmaFileSection.style.display = 'block';
      }
    } else {
      figmaAuthStatus.innerHTML = `
        <div class="auth-indicator logged-out">
          <i class="fas fa-exclamation-circle"></i>
          <p>Not connected to Figma</p>
        </div>
        <button id="figma-auth-btn" class="primary-btn">
          <i class="fab fa-figma"></i> Connect Figma Account
        </button>
      `;

      if (figmaFileSection) {
        figmaFileSection.style.display = 'none';
      }
    }
    const newAuthBtn = document.getElementById('figma-auth-btn');
    if (newAuthBtn) {
      newAuthBtn.addEventListener('click', async () => {
        if (figmaApi.isAuthenticated()) {
          await figmaApi.logout();
        } else {
          await figmaApi.authenticate();
        }

        await updateAuthStatus();
      });
    }
  }
}

async function loadLinkedFiles() {
  const figmaLinkedFiles = document.getElementById('figma-linked-files');
  if (!figmaLinkedFiles) return;

  try {
    const result = await getFromStorage('designTokens');

    const designTokens = result.designTokens;
    if (!designTokens) {
      figmaLinkedFiles.innerHTML = '<p>Import design tokens first to link Figma files</p>';
      return;
    }

    const tokensId = designTokens.frameName || 'default';

    const fileMapResult = await getFromStorage('figmaFileMap');

    const figmaFileMap = fileMapResult.figmaFileMap || {};
    if (!figmaFileMap || !figmaFileMap[tokensId]) {
      figmaLinkedFiles.innerHTML = '<p>No Figma files linked yet</p>';
      return;
    }

    const fileInfo = figmaFileMap[tokensId];
    const dateAdded = new Date(fileInfo.addedAt).toLocaleDateString();

    figmaLinkedFiles.innerHTML = `
      <div class="linked-file-item">
        <div class="linked-file-info">
          <span class="linked-file-name">
            <i class="fab fa-figma"></i> ${fileInfo.fileKey}
          </span>
          <span class="linked-file-date">Added on ${dateAdded}</span>
        </div>
        <div class="linked-file-actions">
          <button class="file-action-btn open-file-btn" data-url="${fileInfo.fileUrl}">
            <i class="fas fa-external-link-alt"></i>
          </button>
          <button class="file-action-btn remove-file-btn" data-tokens-id="${tokensId}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;

    document.querySelectorAll('.open-file-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        chrome.tabs.create({ url: btn.dataset.url });
      });
    });

    document.querySelectorAll('.remove-file-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tokensId = btn.dataset.tokensId;

        const fileMapResult = await getFromStorage('figmaFileMap');

        const figmaFileMap = fileMapResult.figmaFileMap || {};
        if (figmaFileMap && figmaFileMap[tokensId]) {
          delete figmaFileMap[tokensId];
          await setToStorage({ figmaFileMap });

          await loadLinkedFiles();
          showSuccess('Figma file unlinked');
        }
      });
    });
  } catch (error) {
    console.error('Error loading linked files:', error);
    figmaLinkedFiles.innerHTML = '<p>Error loading linked files</p>';
  }
}

function setupCommentModal() {
  const commentModal = document.getElementById('comment-modal');
  const closeModal = document.querySelector('.close-modal');
  const cancelComment = document.getElementById('cancel-comment');
  const submitComment = document.getElementById('submit-comment');

  if (!commentModal) return;

  if (closeModal) {
    closeModal.addEventListener('click', () => {
      commentModal.style.display = 'none';
    });
  }
  if (cancelComment) {
    cancelComment.addEventListener('click', () => {
      commentModal.style.display = 'none';
    });
  }

  window.addEventListener('click', (event) => {
    if (event.target === commentModal) {
      commentModal.style.display = 'none';
    }
  });

  if (submitComment) {
    submitComment.addEventListener('click', async () => {
      if (!currentCommentData) {
        showError('No element data available');
        return;
      }

      const commentText = document.getElementById('comment-text');
      const comment = commentText.value.trim();
      if (!comment) {
        showError('Please enter a comment');
        return;
      }

      try {
        const result = await getFromStorage('designTokens');

        const designTokens = result.designTokens;
        if (!designTokens) {
          showError('No design tokens found');
          return;
        }

        const tokensId = designTokens.frameName || 'default';
        const fileKey = await figmaApi.getFileKeyForTokens(tokensId);

        if (!fileKey) {
          showError('No Figma file linked to these design tokens');
          return;
        }

        const nodeId = currentCommentData.nodeId;

        const response = await figmaApi.postComment(fileKey, comment, nodeId);

        if (response && response.id) {
          commentModal.style.display = 'none';

          showSuccess('Comment added to Figma');
        }
      } catch (error) {
        showError(`Failed to add comment: ${error.message}`);
      }
    });
  }
}

function initializeCommentButtons() {
  document.addEventListener('mismatches-rendered', async () => {
    setTimeout(async () => {
      const commentButtons = document.querySelectorAll('.comment-btn');
      commentButtons.forEach((btn) => {
        const mismatchRow = btn.closest('.mismatch-row');
        if (!mismatchRow) return;

        const property = mismatchRow.getAttribute('data-property');

        btn.addEventListener('click', () => {
          if (!figmaApi.isAuthenticated()) {
            showError('Please connect your Figma account first');

            const figmaTabBtn = document.querySelector('.tab-btn[data-tab="figma"]');
            if (figmaTabBtn) figmaTabBtn.click();

            return;
          }
          currentCommentData = {
            nodeId: mismatchRow.getAttribute('data-token-node-id'),
          };

          document.getElementById('comment-modal').style.display = 'block';
        });
      });
    }, 100);
  });
}
