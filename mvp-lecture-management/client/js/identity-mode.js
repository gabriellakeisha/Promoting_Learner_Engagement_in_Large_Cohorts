let currentIdentityMode = 'anonymous';
let currentMessageType = 'COMMENT';
let sessionAlias = null;

const animalEmojis = ['🦊', '🐼', '🦁', '🐯', '🐨', '🐸', '🦋', '🐙', '🦄', '🐺', '🦉', '🐢', '🦈', '🐬', '🦩', '🐝'];
const adjectives = ['Swift', 'Clever', 'Bright', 'Silent', 'Bold', 'Wise', 'Calm', 'Quick', 'Noble', 'Keen'];
const animals = ['Fox', 'Panda', 'Lion', 'Tiger', 'Koala', 'Frog', 'Butterfly', 'Octopus', 'Unicorn', 'Wolf', 'Owl', 'Turtle', 'Shark', 'Dolphin', 'Flamingo', 'Bee'];

function generateAlias() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const emoji = animalEmojis[Math.floor(Math.random() * animalEmojis.length)];
  return `${emoji} ${adj} ${animal}`;
}

function getSessionAlias() {
  if (!sessionAlias) {
    const sessionId = new URLSearchParams(window.location.search).get('sessionId');
    const storedKey = `alias_${sessionId}`;
    sessionAlias = localStorage.getItem(storedKey);
    if (!sessionAlias) {
      sessionAlias = generateAlias();
      localStorage.setItem(storedKey, sessionAlias);
    }
  }
  return sessionAlias;
}

function regenerateAlias() {
  const sessionId = new URLSearchParams(window.location.search).get('sessionId');
  const storedKey = `alias_${sessionId}`;
  sessionAlias = generateAlias();
  localStorage.setItem(storedKey, sessionAlias);
  const aliasName = document.getElementById('alias-name');
  if (aliasName) aliasName.textContent = sessionAlias;
  updateNavbarIdentityLabel();
}

function getIdentityMode() {
  return currentIdentityMode;
}

function getAlias() {
  return currentIdentityMode === 'pseudonymous' ? getSessionAlias() : null;
}

function getMessageType() {
  const typeInput = document.getElementById('message-type');
  return typeInput ? typeInput.value : 'COMMENT';
}

function setIdentityMode(mode) {
  currentIdentityMode = mode;
  document.querySelectorAll('.navbar-identity-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.mode === mode);
  });
  const icons = { anonymous: '👤', pseudonymous: '🎭', identified: '😊' };
  const labels = { anonymous: 'Anonymous', pseudonymous: 'Alias', identified: 'Real Name' };
  const label = document.getElementById('current-identity-label');
  if (label) label.textContent = `${icons[mode]} ${labels[mode]}`;
  const aliasPreview = document.getElementById('alias-preview');
  if (aliasPreview) {
    aliasPreview.style.display = mode === 'pseudonymous' ? 'flex' : 'none';
    if (mode === 'pseudonymous') {
      const aliasName = document.getElementById('alias-name');
      if (aliasName) aliasName.textContent = getSessionAlias();
    }
  }
  updateNavbarIdentityLabel();
}

function updateNavbarIdentityLabel() {
  const icons = { anonymous: '👤', pseudonymous: '🎭', identified: '😊' };
  const labels = { anonymous: 'Anonymous', pseudonymous: 'Alias', identified: 'Real Name' };
  const navLabel = document.getElementById('navbar-identity-status');
  if (navLabel) {
    navLabel.textContent = icons[currentIdentityMode] + ' ' + labels[currentIdentityMode];
  }
}

function initIdentityModeSelector(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const existingSelector = document.getElementById('identity-mode-container');
  if (existingSelector) existingSelector.remove();

  const oldInputWrapper = container.querySelector('.chat-input-wrapper');
  if (!oldInputWrapper) return;

  container.innerHTML = '';
  container.style.position = 'relative';

  const replyIndicator = document.createElement('div');
  replyIndicator.id = 'reply-indicator';
  replyIndicator.className = 'reply-indicator-container';
  replyIndicator.style.display = 'none';
  container.appendChild(replyIndicator);

  const waInputRow = document.createElement('div');
  waInputRow.className = 'other-input-row';
  waInputRow.innerHTML = `
    <button type="button" id="other-plus-btn" class="other-plus-btn">+</button>
    <div class="other-input-wrapper">
      <input type="text" id="message-input" class="other-message-input" placeholder="Type a message">
    </div>
    <button type="button" id="send-btn" class="other-send-btn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
      </svg>
    </button>
  `;
  container.appendChild(waInputRow);

  const hiddenType = document.createElement('input');
  hiddenType.type = 'hidden';
  hiddenType.id = 'message-type';
  hiddenType.value = 'COMMENT';
  container.appendChild(hiddenType);

  const plusBtn = document.getElementById('other-plus-btn');

  var studentFileInput = document.createElement('input');
  studentFileInput.type = 'file';
  studentFileInput.id = 'chat-file-input';
  studentFileInput.accept = 'image/*,.pdf,.doc,.docx,.txt,.md,.csv,.tsv,.json,.xml,.yml,.yaml,.ini,.toml,.py,.ipynb,.js,.mjs,.cjs,.ts,.tsx,.jsx,.java,.c,.cc,.cpp,.h,.hpp,.cs,.go,.rs,.rb,.php,.swift,.kt,.scala,.sql,.html,.htm,.css,.scss,.less,.sh,.bash,.zsh,.ps1,.r,.lua,.tex,.xlsx,.pptx,.zip';
  studentFileInput.style.display = 'none';
  studentFileInput.addEventListener('change', function(ev) {
    if (typeof handleFileSelected === 'function') handleFileSelected(ev);
  });
  container.appendChild(studentFileInput);

  plusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    studentFileInput.click();
  });

  initNavbarIdentityDropdown();
  injectWaStyles();
}

function initNavbarIdentityDropdown() {
  const navbarUser = document.querySelector('.navbar-user');
  if (!navbarUser || document.getElementById('navbar-identity-dropdown')) return;

  navbarUser.style.position = 'relative';
  navbarUser.style.cursor = 'pointer';

  const userInfo = navbarUser.querySelector('.user-info');
  if (userInfo) {
    const statusEl = document.createElement('div');
    statusEl.id = 'navbar-identity-status';
    statusEl.style.cssText = 'font-size:11px;color:#00a884;font-weight:500;margin-top:2px;';
    statusEl.textContent = '👤 Anonymous';
    userInfo.appendChild(statusEl);
  }

  const dropdown = document.createElement('div');
  dropdown.id = 'navbar-identity-dropdown';
  dropdown.className = 'navbar-identity-dropdown';
  dropdown.style.display = 'none';
  dropdown.innerHTML = `
    <div class="navbar-dropdown-content">
      <div class="navbar-dropdown-section">
        <div class="navbar-dropdown-label">🔒 Post as: <span id="current-identity-label">👤 Anonymous</span></div>
        <div class="navbar-identity-grid">
          <button type="button" class="navbar-identity-option selected" data-mode="anonymous">
            <span class="navbar-opt-icon">👤</span>
            <span class="navbar-opt-name">Anonymous</span>
          </button>
          <button type="button" class="navbar-identity-option" data-mode="pseudonymous">
            <span class="navbar-opt-icon">🎭</span>
            <span class="navbar-opt-name">Alias</span>
          </button>
          <button type="button" class="navbar-identity-option" data-mode="identified">
            <span class="navbar-opt-icon">😊</span>
            <span class="navbar-opt-name">Real Name</span>
          </button>
        </div>
        <div id="alias-preview" class="navbar-alias-preview" style="display:none;">
          <span>Your alias: <strong id="alias-name"></strong></span>
          <button type="button" onclick="regenerateAlias()" class="navbar-alias-refresh">🔄</button>
        </div>
      </div>
      <div class="navbar-dropdown-divider"></div>
      <div class="navbar-dropdown-section">
        <div class="navbar-dropdown-label">💬 Message Type</div>
        <div class="navbar-msgtype-grid">
          <button type="button" class="navbar-msgtype-option" data-type="QUESTION">❓ Question</button>
          <button type="button" class="navbar-msgtype-option selected" data-type="COMMENT">💬 Comment</button>
          <button type="button" class="navbar-msgtype-option" data-type="CONFUSION">❗ Confusion</button>
        </div>
      </div>
    </div>
  `;
  navbarUser.appendChild(dropdown);

  navbarUser.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.style.display === 'block';
    dropdown.style.display = isOpen ? 'none' : 'block';
  });

  document.addEventListener('click', (e) => {
    if (!navbarUser.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  dropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  document.querySelectorAll('.navbar-identity-option').forEach(opt => {
    opt.addEventListener('click', () => {
      setIdentityMode(opt.dataset.mode);
    });
  });

  document.querySelectorAll('.navbar-msgtype-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.navbar-msgtype-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      document.getElementById('message-type').value = opt.dataset.type;
    });
  });
}

function injectWaStyles() {
  if (document.getElementById('other-popup-styles')) return;
  const style = document.createElement('style');
  style.id = 'other-popup-styles';
  style.textContent = `
    .chat-input-container {
      position: relative;
      padding: 0 !important;
      background: transparent !important;
      border-top: none !important;
    }

    .other-input-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      background: #0b141a;
      border-radius: 0 0 16px 16px;
    }

    .other-plus-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: none;
      background: #1f2c34;
      color: #8696a0;
      font-size: 28px;
      font-weight: 300;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .other-plus-btn:hover {
      background: #2a3942;
      color: #e9edef;
    }

    .other-plus-btn.active {
      background: #00a884;
      color: white;
      transform: rotate(45deg);
    }

    .other-input-wrapper {
      flex: 1;
      min-width: 0;
    }

    .other-message-input {
      width: 100%;
      padding: 12px 16px;
      border-radius: 24px;
      border: 1px solid #2a3942;
      background: #1e2a32;
      color: #e9edef;
      font-size: 15px;
      outline: none;
    }

    .other-message-input:focus {
      border-color: #3b4a54;
    }

    .other-message-input::placeholder {
      color: #8696a0;
    }

    .other-send-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: none;
      background: #00a884;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s ease;
    }

    .other-send-btn:hover {
      background: #00c49a;
      transform: scale(1.05);
    }

    .reply-indicator-container {
      background: rgba(0, 168, 132, 0.15);
      border-left: 3px solid #00a884;
      padding: 10px 14px;
      margin: 0 16px 8px 16px;
      border-radius: 8px;
    }

    body:not(.dark-mode) .other-input-row {
      background: #f0f2f5;
      border-radius: 0 0 16px 16px;
    }

    body:not(.dark-mode) .other-plus-btn {
      background: #e5e7eb;
      color: #6b7280;
    }

    body:not(.dark-mode) .other-plus-btn:hover {
      background: #d1d5db;
      color: #374151;
    }

    body:not(.dark-mode) .other-message-input {
      background: #ffffff;
      color: #1f2937;
      border: 1px solid #e5e7eb;
    }

    .navbar-identity-dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      width: 280px;
      max-width: calc(100vw - 32px);
      background: #1f2c34;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      z-index: 1000;
      overflow: hidden;
      animation: navDropSlideDown 0.2s ease;
      margin-top: 8px;
    }

    @keyframes navDropSlideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .navbar-dropdown-content {
      padding: 0;
    }

    .navbar-dropdown-section {
      padding: 14px 16px;
    }

    .navbar-dropdown-divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
      margin: 0;
    }

    .navbar-dropdown-label {
      font-size: 12px;
      color: #8696a0;
      margin-bottom: 10px;
      font-weight: 500;
    }

    .navbar-identity-grid {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .navbar-identity-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      background: #233138;
      border: 2px solid transparent;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      width: 100%;
      text-align: left;
    }

    .navbar-identity-option:hover {
      background: #2a3f4a;
      border-color: rgba(0, 168, 132, 0.3);
    }

    .navbar-identity-option.selected {
      background: rgba(0, 168, 132, 0.2);
      border-color: #00a884;
    }

    .navbar-opt-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .navbar-opt-name {
      font-size: 14px;
      font-weight: 500;
      color: #e9edef;
    }

    .navbar-identity-option.selected .navbar-opt-name {
      color: #00e5a0;
    }

    .navbar-msgtype-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .navbar-msgtype-option {
      padding: 10px 12px;
      background: #233138;
      border: 2px solid transparent;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 13px;
      font-weight: 500;
      color: #d1d5db;
      text-align: center;
    }

    .navbar-msgtype-option:hover {
      background: #2a3f4a;
      border-color: rgba(0, 168, 132, 0.3);
      color: #ffffff;
    }

    .navbar-msgtype-option.selected {
      background: rgba(0, 168, 132, 0.25);
      border-color: #00a884;
      color: #00e5a0;
    }

    .navbar-alias-preview {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 10px;
      padding: 10px 12px;
      background: rgba(102, 126, 234, 0.15);
      border-radius: 8px;
      color: #e9edef;
      font-size: 13px;
    }

    .navbar-alias-preview strong {
      color: #a78bfa;
      font-weight: 700;
    }

    .navbar-alias-refresh {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }

    .navbar-alias-refresh:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    body:not(.dark-mode) .navbar-identity-dropdown {
      background: #ffffff;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    }

    body:not(.dark-mode) .navbar-dropdown-label {
      color: #6b7280;
    }

    body:not(.dark-mode) .navbar-dropdown-divider {
      background: #e5e7eb;
    }

    body:not(.dark-mode) .navbar-identity-option {
      background: #f3f4f6;
    }

    body:not(.dark-mode) .navbar-identity-option:hover {
      background: #e5e7eb;
    }

    body:not(.dark-mode) .navbar-identity-option.selected {
      background: rgba(0, 168, 132, 0.15);
    }

    body:not(.dark-mode) .navbar-opt-name {
      color: #1f2937;
    }

    body:not(.dark-mode) .navbar-identity-option.selected .navbar-opt-name {
      color: #059669;
    }

    body:not(.dark-mode) .navbar-msgtype-option {
      background: #f3f4f6;
      color: #374151;
    }

    body:not(.dark-mode) .navbar-msgtype-option:hover {
      background: #e5e7eb;
    }

    body:not(.dark-mode) .navbar-msgtype-option.selected {
      background: rgba(0, 168, 132, 0.15);
      color: #059669;
    }

    @media (max-width: 480px) {
      .navbar-identity-dropdown {
        right: -10px;
        width: calc(100vw - 20px);
      }

      .other-input-row {
        padding: 10px 12px;
        gap: 8px;
      }

      .other-plus-btn,
      .other-send-btn {
        width: 40px;
        height: 40px;
      }

      .other-plus-btn {
        font-size: 24px;
      }

      .other-message-input {
        padding: 10px 14px;
        font-size: 14px;
      }

      .navbar-identity-option {
        padding: 10px 12px;
      }

      .navbar-opt-icon {
        font-size: 18px;
      }

      .navbar-opt-name {
        font-size: 13px;
      }

      .navbar-msgtype-option {
        padding: 8px 10px;
        font-size: 12px;
      }
    }
  `;
  document.head.appendChild(style);
}

function getMessageDisplayInfo(message, isLecturer) {
  if (isLecturer) {
    return {
      displayName: message.username || 'Lecturer',
      avatarHTML: generateAvatarHTML(message.avatar, message.username, true),
      identityBadge: ''
    };
  }
  const identityMode = message.identityMode || 'identified';
  switch (identityMode) {
    case 'anonymous':
      return {
        displayName: 'Anonymous',
        avatarHTML: '<div class="message-avatar" style="background:#6b7280;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:bold;">?</div>',
        identityBadge: '<span class="identity-badge anonymous">👤 Anon</span>'
      };
    case 'pseudonymous':
      const alias = message.alias || 'Student';
      const initials = alias.substring(0, 2).toUpperCase();
      return {
        displayName: alias,
        avatarHTML: `<div class="message-avatar" style="background:linear-gradient(135deg,#667eea,#764ba2);width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:700;">${initials}</div>`,
        identityBadge: '<span class="identity-badge pseudonymous">🎭 Alias</span>'
      };
    default:
      return {
        displayName: message.username || 'Student',
        avatarHTML: generateAvatarHTML(message.avatar, message.username, false),
        identityBadge: ''
      };
  }
}

function generateAvatarHTML(avatarUrl, name, isLecturer) {
  if (avatarUrl) {
    return `<img src="${avatarUrl}" class="message-avatar" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`;
  }
  const initials = getInitials(name);
  const color = isLecturer ? 'linear-gradient(135deg, #667eea, #764ba2)' : getColorFromName(name);
  return `<div class="message-avatar" style="background:${color};width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:700;">${initials}</div>`;
}

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function getColorFromName(name) {
  if (!name) return '#6b7280';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  return colors[Math.abs(hash) % colors.length];
}