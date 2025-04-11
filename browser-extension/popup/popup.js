import { initializeOverviewTab } from './modules/overview-tab.js';
import { initializeTasksTab } from './modules/tasks-tab.js';

document.addEventListener('DOMContentLoaded', function () {
  setupTabNavigation();
  const fileInput = document.getElementById('fileInput');
  const importBtn = document.getElementById('importBtn');

  initializeOverviewTab(fileInput, importBtn);
  initializeTasksTab();

  addNotificationStyles();
});

function setupTabNavigation() {
  const tabBtns = document.querySelectorAll('.tab-btn');

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
}

function addNotificationStyles() {
  if (document.getElementById('notification-styles')) return;

  const style = document.createElement('style');
  style.id = 'notification-styles';

  style.textContent = `
    .notification {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 16px;
      border-radius: 4px;
      color: white;
      font-size: 14px;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      transition: opacity 0.3s;
    }

    .notification.error {
      background-color: #FF5722;
    }

    .notification.success {
      background-color: #4CAF50;
    }
  `;

  document.head.appendChild(style);
}
