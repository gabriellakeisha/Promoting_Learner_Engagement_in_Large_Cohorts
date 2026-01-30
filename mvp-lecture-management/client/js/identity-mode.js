let currentIdentityMode = 'anonymous';
let currentMessageType = 'NONE';
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
}

function getIdentityMode() {
  return currentIdentityMode;
}

function getAlias() {
  return currentIdentityMode === 'pseudonymous' ? getSessionAlias() : null;
}

function getMessageType() {
  const typeInput = document.getElementById('message-type');
  return typeInput ? typeInput.value : 'NONE';
}

function setIdentityMode(mode) {
  currentIdentityMode = mode;
  document.querySelectorAll('.other-identity-option').forEach(opt => {
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
}

function initIdentityModeSelector(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container || document.getElementById('other-plus-btn')) return;

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

  const plusMenu = document.createElement('div');
  plusMenu.id = 'other-plus-menu';
  plusMenu.className = 'other-plus-menu-popup';
  plusMenu.style.display = 'none';
  plusMenu.innerHTML = `
    <div class="other-popup-content">
      <div class="other-popup-header">
        <span>Options</span>
        <button type="button" class="other-popup-close">&times;</button>
      </div>
      <div class="other-popup-section">
        <div class="other-popup-label">🔒 Post as: <span id="current-identity-label">👤 Anonymous</span></div>
        <div class="other-identity-grid">
          <button type="button" class="other-identity-option selected" data-mode="anonymous">
            <span class="other-opt-icon">👤</span>
            <span class="other-opt-name">Anonymous</span>
          </button>
          <button type="button" class="other-identity-option" data-mode="pseudonymous">
            <span class="other-opt-icon">🎭</span>
            <span class="other-opt-name">Alias</span>
          </button>
          <button type="button" class="other-identity-option" data-mode="identified">
            <span class="other-opt-icon">😊</span>
            <span class="other-opt-name">Real Name</span>
          </button>
        </div>
        <div id="alias-preview" class="other-alias-preview" style="display:none;">
          <span>Your alias: <strong id="alias-name"></strong></span>
          <button type="button" onclick="regenerateAlias()" class="other-alias-refresh">🔄</button>
        </div>
      </div>
      <div class="other-popup-section">
        <div class="other-msgtype-grid">
          <button type="button" class="other-msgtype-option selected" data-type="NONE">📝 None</button>
          <button type="button" class="other-msgtype-option" data-type="QUESTION">❓ Question</button>
          <button type="button" class="other-msgtype-option" data-type="COMMENT">💬 Comment</button>
          <button type="button" class="other-msgtype-option" data-type="CONFUSION">❗ Confusion</button>
        </div>
      </div>
    </div>
  `;
  container.appendChild(plusMenu);

  const hiddenType = document.createElement('input');
  hiddenType.type = 'hidden';
  hiddenType.id = 'message-type';
  hiddenType.value = 'NONE';
  container.appendChild(hiddenType);

  const plusBtn = document.getElementById('other-plus-btn');
  const closeBtn = plusMenu.querySelector('.other-popup-close');

  plusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = plusMenu.style.display === 'block';
    plusMenu.style.display = isOpen ? 'none' : 'block';
    plusBtn.textContent = isOpen ? '+' : '×';
    plusBtn.classList.toggle('active', !isOpen);
  });

  closeBtn.addEventListener('click', () => {
    plusMenu.style.display = 'none';
    plusBtn.textContent = '+';
    plusBtn.classList.remove('active');
  });

  document.addEventListener('click', (e) => {
    if (!plusMenu.contains(e.target) && e.target !== plusBtn) {
      plusMenu.style.display = 'none';
      plusBtn.textContent = '+';
      plusBtn.classList.remove('active');
    }
  });

  document.querySelectorAll('.other-identity-option').forEach(opt => {
    opt.addEventListener('click', () => {
      setIdentityMode(opt.dataset.mode);
    });
  });

  document.querySelectorAll('.other-msgtype-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.other-msgtype-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      document.getElementById('message-type').value = opt.dataset.type;
    });
  });

  injectWaStyles();
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

    .other-plus-menu-popup {
      position: absolute;
      bottom: 70px;
      left: 16px;
      width: 280px;
      max-width: calc(100vw - 32px);
      background: #1f2c34;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      z-index: 1000;
      overflow: hidden;
      animation: popupSlideUp 0.2s ease;
    }

    @keyframes popupSlideUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .other-popup-content {
      padding: 0;
    }

    .other-popup-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      font-weight: 600;
      font-size: 15px;
      color: #e9edef;
    }

    .other-popup-close {
      background: none;
      border: none;
      font-size: 24px;
      color: #8696a0;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s;
    }

    .other-popup-close:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }

    .other-popup-section {
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .other-popup-section:last-child {
      border-bottom: none;
    }

    .other-popup-label {
      font-size: 12px;
      color: #8696a0;
      margin-bottom: 10px;
      font-weight: 500;
    }

    .other-identity-grid {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .other-identity-option {
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

    .other-identity-option:hover {
      background: #2a3f4a;
      border-color: rgba(0, 168, 132, 0.3);
    }

    .other-identity-option.selected {
      background: rgba(0, 168, 132, 0.2);
      border-color: #00a884;
    }

    .other-opt-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .other-opt-name {
      font-size: 14px;
      font-weight: 500;
      color: #e9edef;
    }

    .other-identity-option.selected .other-opt-name {
      color: #00e5a0;
    }

    .other-msgtype-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .other-msgtype-option {
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

    .other-msgtype-option:hover {
      background: #2a3f4a;
      border-color: rgba(0, 168, 132, 0.3);
      color: #ffffff;
    }

    .other-msgtype-option.selected {
      background: rgba(0, 168, 132, 0.25);
      border-color: #00a884;
      color: #00e5a0;
    }

    .other-alias-preview {
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

    .other-alias-preview strong {
      color: #a78bfa;
      font-weight: 700;
    }

    .other-alias-refresh {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }

    .other-alias-refresh:hover {
      background: rgba(255, 255, 255, 0.2);
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

    body:not(.dark-mode) .other-plus-menu-popup {
      background: #ffffff;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    }

    body:not(.dark-mode) .other-popup-header {
      color: #1f2937;
      border-bottom-color: #e5e7eb;
    }

    body:not(.dark-mode) .other-popup-close {
      color: #6b7280;
    }

    body:not(.dark-mode) .other-popup-label {
      color: #6b7280;
    }

    body:not(.dark-mode) .other-identity-option {
      background: #f3f4f6;
    }

    body:not(.dark-mode) .other-identity-option:hover {
      background: #e5e7eb;
    }

    body:not(.dark-mode) .other-identity-option.selected {
      background: rgba(0, 168, 132, 0.15);
    }

    body:not(.dark-mode) .other-opt-name {
      color: #1f2937;
    }

    body:not(.dark-mode) .other-identity-option.selected .other-opt-name {
      color: #059669;
    }

    body:not(.dark-mode) .other-msgtype-option {
      background: #f3f4f6;
      color: #374151;
    }

    body:not(.dark-mode) .other-msgtype-option:hover {
      background: #e5e7eb;
    }

    body:not(.dark-mode) .other-msgtype-option.selected {
      background: rgba(0, 168, 132, 0.15);
      color: #059669;
    }

    @media (max-width: 480px) {
      .other-plus-menu-popup {
        left: 10px;
        right: 10px;
        width: auto;
        max-width: none;
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

      .other-identity-option {
        padding: 10px 12px;
      }

      .other-opt-icon {
        font-size: 18px;
      }

      .other-opt-name {
        font-size: 13px;
      }

      .other-msgtype-option {
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
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function getColorFromName(name) {
  if (!name) return '#6b7280';
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}