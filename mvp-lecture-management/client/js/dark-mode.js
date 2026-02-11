// Dark mode toggle functionality — Settings-based (no floating button)
(function() {
  const darkModeEnabled = localStorage.getItem('darkMode') === 'true';

  if (darkModeEnabled) {
    document.body.classList.add('dark-mode');
  }

  // Create settings dropdown in navbar
  function initSettingsDropdown() {
    const navbarUser = document.querySelector('.navbar-user');
    if (!navbarUser || document.getElementById('settings-dropdown-wrapper')) return;

    // Remove old "Edit Profile" link if it exists
    const oldEditLink = navbarUser.querySelector('.edit-profile-link');
    if (oldEditLink) oldEditLink.remove();

    // Remove old floating dark mode toggle if it exists
    const oldToggle = document.querySelector('.dark-mode-toggle');
    if (oldToggle) oldToggle.remove();

    // Create settings button
    const settingsWrapper = document.createElement('div');
    settingsWrapper.id = 'settings-dropdown-wrapper';
    settingsWrapper.style.cssText = 'position:relative;';

    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'settings-btn';
    settingsBtn.className = 'btn btn-secondary btn-small';
    settingsBtn.innerHTML = '⚙️';
    settingsBtn.title = 'Settings';
    settingsBtn.style.cssText = 'font-size:18px;padding:6px 10px;line-height:1;min-width:36px;background:transparent;border:1px solid var(--border-color,#e5e7eb);border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;';

    const isDark = document.body.classList.contains('dark-mode');

    const dropdown = document.createElement('div');
    dropdown.id = 'settings-dropdown';
    dropdown.style.cssText = 'display:none;position:absolute;top:calc(100% + 8px);right:0;background:var(--card-bg,#ffffff);border:1px solid var(--border-color,#e5e7eb);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.15);min-width:220px;z-index:99999;overflow:hidden;';

    dropdown.innerHTML = `
      <div style="padding:12px 16px;border-bottom:1px solid var(--border-color,#e5e7eb);cursor:pointer;display:flex;align-items:center;gap:10px;transition:background 0.15s;" 
           id="settings-edit-profile"
           onmouseover="this.style.background='var(--bg-secondary,#f3f4f6)'" 
           onmouseout="this.style.background='transparent'">
        <span style="font-size:16px;">👤</span>
        <span style="font-size:14px;color:var(--text-color);">Edit Profile</span>
      </div>
      <div style="padding:12px 16px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;transition:background 0.15s;" 
           id="settings-dark-mode"
           onmouseover="this.style.background='var(--bg-secondary,#f3f4f6)'" 
           onmouseout="this.style.background='transparent'">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:16px;" id="settings-theme-icon">${isDark ? '☀️' : '🌙'}</span>
          <span style="font-size:14px;color:var(--text-color);" id="settings-theme-label">${isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </div>
        <div id="settings-theme-toggle" style="width:40px;height:22px;border-radius:11px;background:${isDark ? '#10b981' : '#d1d5db'};position:relative;transition:background 0.3s;">
          <div style="width:18px;height:18px;border-radius:50%;background:white;position:absolute;top:2px;${isDark ? 'right:2px;' : 'left:2px;'}transition:all 0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>
        </div>
      </div>
    `;

    settingsWrapper.appendChild(settingsBtn);
    settingsWrapper.appendChild(dropdown);

    // Insert before logout button
    const logoutBtn = navbarUser.querySelector('#logout-btn');
    if (logoutBtn) {
      navbarUser.insertBefore(settingsWrapper, logoutBtn);
    } else {
      navbarUser.appendChild(settingsWrapper);
    }

    // Stop clicks inside dropdown from bubbling to navbar-user (which opens identity dropdown)
    dropdown.addEventListener('click', function(e) {
      e.stopPropagation();
    });

    // Toggle dropdown
    settingsBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      // Close identity dropdown if open
      var identityDropdown = document.getElementById('navbar-identity-dropdown');
      if (identityDropdown) identityDropdown.style.display = 'none';
      var isOpen = dropdown.style.display === 'block';
      dropdown.style.display = isOpen ? 'none' : 'block';
    });

    // Close on outside click
    document.addEventListener('click', function(e) {
      if (!settingsWrapper.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    // Close settings when identity dropdown area is clicked
    var navbarUserArea = document.querySelector('.navbar-user .user-info');
    if (navbarUserArea) {
      navbarUserArea.addEventListener('click', function() {
        dropdown.style.display = 'none';
      });
    }
    var navbarAvatarEl = document.querySelector('.navbar-avatar');
    if (navbarAvatarEl) {
      navbarAvatarEl.addEventListener('click', function() {
        dropdown.style.display = 'none';
      });
    }

    // Edit Profile click
    document.getElementById('settings-edit-profile').addEventListener('click', function() {
      dropdown.style.display = 'none';
      if (typeof openProfileModal === 'function') {
        openProfileModal();
      }
    });

    // Dark Mode toggle
    document.getElementById('settings-dark-mode').addEventListener('click', function() {
      const nowDark = document.body.classList.toggle('dark-mode');
      localStorage.setItem('darkMode', nowDark);

      // Update toggle UI
      document.getElementById('settings-theme-icon').textContent = nowDark ? '☀️' : '🌙';
      document.getElementById('settings-theme-label').textContent = nowDark ? 'Light Mode' : 'Dark Mode';
      
      const toggleTrack = document.getElementById('settings-theme-toggle');
      toggleTrack.style.background = nowDark ? '#10b981' : '#d1d5db';
      const knob = toggleTrack.querySelector('div');
      knob.style.left = nowDark ? '' : '2px';
      knob.style.right = nowDark ? '2px' : '';

      showToast(nowDark ? 'Dark mode enabled' : 'Light mode enabled');
    });
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--primary-color, #667eea);
      color: white;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.style.opacity = '1', 10);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => { if (toast.parentNode) document.body.removeChild(toast); }, 300);
    }, 1800);
  }

  // Init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSettingsDropdown);
  } else {
    initSettingsDropdown();
  }

  // Also try after a short delay in case navbar is injected dynamically
  setTimeout(initSettingsDropdown, 500);
})();