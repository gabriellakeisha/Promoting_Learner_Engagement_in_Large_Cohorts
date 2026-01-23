let currentIdentityMode = 'anonymous';
let userAlias = null;

function generateAlias() {
  const adjectives = ['Swift', 'Clever', 'Curious', 'Bright', 'Quick', 'Eager', 'Bold', 'Calm', 'Wise', 'Keen', 'Happy', 'Brave', 'Witty', 'Noble', 'Merry'];
  const animals = ['Falcon', 'Dolphin', 'Panda', 'Fox', 'Owl', 'Tiger', 'Eagle', 'Wolf', 'Bear', 'Hawk', 'Otter', 'Raven', 'Lion', 'Deer', 'Lynx'];
  const number = Math.floor(Math.random() * 999) + 1;
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adj}${animal}${number}`;
}

function getSessionAlias() {
  if (!userAlias) {
    const sessionId = new URLSearchParams(window.location.search).get('sessionId');
    const storageKey = `alias_${sessionId}`;
    userAlias = localStorage.getItem(storageKey);
    if (!userAlias) {
      userAlias = generateAlias();
      localStorage.setItem(storageKey, userAlias);
    }
  }
  return userAlias;
}

function regenerateAlias() {
  const sessionId = new URLSearchParams(window.location.search).get('sessionId');
  const storageKey = `alias_${sessionId}`;
  userAlias = generateAlias();
  localStorage.setItem(storageKey, userAlias);
  const aliasName = document.getElementById('alias-name');
  if (aliasName) aliasName.textContent = userAlias;
  return userAlias;
}

function getIdentityMode() {
  return currentIdentityMode;
}

function setIdentityMode(mode) {
  currentIdentityMode = mode;
  document.querySelectorAll('.wa-identity-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.mode === mode);
  });
  const currentLabel = document.getElementById('current-identity-label');
  if (currentLabel) {
    const labels = { 'anonymous': '👤 Anonymous', 'pseudonymous': '🦊 Alias', 'identified': '😊 Real Name' };
    currentLabel.textContent = labels[mode] || labels['anonymous'];
  }
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
  if (!container || document.getElementById('wa-plus-btn')) return;

  const existingSelector = document.getElementById('identity-mode-container');
  if (existingSelector) existingSelector.remove();

  const oldInputWrapper = container.querySelector('.chat-input-wrapper');
  if (!oldInputWrapper) return;

  container.innerHTML = '';

  const replyIndicator = document.createElement('div');
  replyIndicator.id = 'reply-indicator';
  replyIndicator.className = 'reply-indicator-container';
  replyIndicator.style.display = 'none';
  container.appendChild(replyIndicator);

  const waInputRow = document.createElement('div');
  waInputRow.className = 'wa-input-row';
  waInputRow.innerHTML = `
    <button type="button" id="wa-plus-btn" class="wa-plus-btn">+</button>
    <div class="wa-input-wrapper">
      <input type="text" id="message-input" class="wa-message-input" placeholder="Type a message">
    </div>
    <button type="button" id="send-btn" class="wa-send-btn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
      </svg>
    </button>
  `;
  container.appendChild(waInputRow);

  const plusMenu = document.createElement('div');
  plusMenu.id = 'wa-plus-menu';
  plusMenu.className = 'wa-plus-menu';
  plusMenu.style.display = 'none';
  plusMenu.innerHTML = `
    <div class="wa-plus-menu-overlay"></div>
    <div class="wa-plus-menu-content">
      <div class="wa-plus-menu-header">
        <span>Options</span>
        <button type="button" class="wa-plus-menu-close">&times;</button>
      </div>
      <div class="wa-plus-section">
        <div class="wa-plus-section-title">🔒 Post as: <span id="current-identity-label">👤 Anonymous</span></div>
        <div class="wa-identity-options">
          <button type="button" class="wa-identity-option selected" data-mode="anonymous">
            <span class="wa-opt-icon">👤</span>
            <span class="wa-opt-name">Anonymous</span>
            <span class="wa-opt-desc">Hidden identity</span>
          </button>
          <button type="button" class="wa-identity-option" data-mode="pseudonymous">
            <span class="wa-opt-icon">🦊</span>
            <span class="wa-opt-name">Alias</span>
            <span class="wa-opt-desc">Fun nickname</span>
          </button>
          <button type="button" class="wa-identity-option" data-mode="identified">
            <span class="wa-opt-icon">😊</span>
            <span class="wa-opt-name">Real Name</span>
            <span class="wa-opt-desc">Full identity</span>
          </button>
        </div>
        <div id="alias-preview" class="wa-alias-preview" style="display:none;">
          <span>Your alias: <strong id="alias-name"></strong></span>
          <button type="button" onclick="regenerateAlias()" class="wa-alias-refresh">🔄</button>
        </div>
      </div>
      <div class="wa-plus-section">
        <div class="wa-plus-section-title">Message Type</div>
        <div class="wa-msgtype-options">
          <button type="button" class="wa-msgtype-option selected" data-type="QUESTION">❓ Question</button>
          <button type="button" class="wa-msgtype-option" data-type="COMMENT">💬 Comment</button>
          <button type="button" class="wa-msgtype-option" data-type="CONFUSION">❗ Confusion</button>
        </div>
      </div>
    </div>
  `;
  container.appendChild(plusMenu);

  const hiddenType = document.createElement('input');
  hiddenType.type = 'hidden';
  hiddenType.id = 'message-type';
  hiddenType.value = 'QUESTION';
  container.appendChild(hiddenType);

  const plusBtn = document.getElementById('wa-plus-btn');
  const overlay = plusMenu.querySelector('.wa-plus-menu-overlay');
  const closeBtn = plusMenu.querySelector('.wa-plus-menu-close');

  plusBtn.addEventListener('click', () => {
    plusMenu.style.display = 'block';
  });

  overlay.addEventListener('click', () => {
    plusMenu.style.display = 'none';
  });

  closeBtn.addEventListener('click', () => {
    plusMenu.style.display = 'none';
  });

  document.querySelectorAll('.wa-identity-option').forEach(opt => {
    opt.addEventListener('click', () => {
      setIdentityMode(opt.dataset.mode);
    });
  });

  document.querySelectorAll('.wa-msgtype-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.wa-msgtype-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      document.getElementById('message-type').value = opt.dataset.type;
    });
  });

  addWaStyles();
}

function addWaStyles() {
  if (document.getElementById('wa-input-styles')) return;

  const style = document.createElement('style');
  style.id = 'wa-input-styles';
  style.textContent = `
    .chat-input-container {
      padding: 8px 12px !important;
      background: var(--card-bg, #1f2c34) !important;
      border-top: 1px solid var(--border-color, #2a3942) !important;
    }
    .wa-input-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .wa-plus-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: transparent;
      color: var(--text-secondary, #8696a0);
      font-size: 28px;
      font-weight: 300;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s;
    }
    .wa-plus-btn:hover {
      background: rgba(255,255,255,0.1);
      color: var(--text-primary, #e9edef);
    }
    .wa-input-wrapper {
      flex: 1;
      min-width: 0;
    }
    .wa-message-input {
      width: 100%;
      background: var(--bg-color, #2a3942);
      border: none;
      border-radius: 21px;
      padding: 9px 16px;
      font-size: 15px;
      color: #ffffff;
      outline: none;
    }
    .wa-message-input::placeholder {
      color: var(--text-secondary, #8696a0);
    }
    body:not(.dark-mode) .wa-message-input {
      background: #f0f2f5;
      color: #1f2937;
    }
    body:not(.dark-mode) .wa-message-input::placeholder {
      color: #65676b;
    }
    .wa-send-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: #00a884;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s;
    }
    .wa-send-btn:hover {
      background: #06cf9c;
      transform: scale(1.05);
    }
    .wa-plus-menu {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1000;
    }
    .wa-plus-menu-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
    }
    .wa-plus-menu-content {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--card-bg, #1f2c34);
      border-radius: 16px 16px 0 0;
      padding: 16px;
      max-height: 70vh;
      overflow-y: auto;
      animation: slideUp 0.25s ease;
    }
    body:not(.dark-mode) .wa-plus-menu-content {
      background: #ffffff;
    }
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    .wa-plus-menu-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-color, #2a3942);
    }
    .wa-plus-menu-header span {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary, #e9edef);
    }
    body:not(.dark-mode) .wa-plus-menu-header span {
      color: #1f2937;
    }
    .wa-plus-menu-close {
      background: none;
      border: none;
      color: var(--text-secondary, #8696a0);
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    .wa-plus-section {
      margin-bottom: 20px;
    }
    .wa-plus-section-title {
      font-size: 13px;
      color: var(--text-secondary, #8696a0);
      margin-bottom: 10px;
      font-weight: 500;
    }
    .wa-identity-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .wa-identity-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      background: rgba(255,255,255,0.05);
      border: 2px solid transparent;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
    }
    body:not(.dark-mode) .wa-identity-option {
      background: #f0f2f5;
    }
    .wa-identity-option:hover {
      background: rgba(255,255,255,0.08);
    }
    body:not(.dark-mode) .wa-identity-option:hover {
      background: #e4e6e9;
    }
    .wa-identity-option.selected {
      background: rgba(0,168,132,0.15);
      border-color: #00a884;
    }
    .wa-opt-icon {
      font-size: 24px;
    }
    .wa-opt-name {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary, #e9edef);
      flex: 1;
    }
    body:not(.dark-mode) .wa-opt-name {
      color: #1f2937;
    }
    .wa-opt-desc {
      font-size: 12px;
      color: var(--text-secondary, #8696a0);
    }
    .wa-alias-preview {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: rgba(0,168,132,0.1);
      border-radius: 8px;
      margin-top: 10px;
      font-size: 13px;
      color: var(--text-secondary, #8696a0);
    }
    .wa-alias-preview strong {
      color: #00a884;
    }
    .wa-alias-refresh {
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
    }
    .wa-msgtype-options {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .wa-msgtype-option {
      padding: 8px 14px;
      background: rgba(255,255,255,0.05);
      border: 2px solid transparent;
      border-radius: 20px;
      color: var(--text-primary, #e9edef);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    body:not(.dark-mode) .wa-msgtype-option {
      background: #f0f2f5;
      color: #1f2937;
    }
    .wa-msgtype-option:hover {
      background: rgba(255,255,255,0.08);
    }
    body:not(.dark-mode) .wa-msgtype-option:hover {
      background: #e4e6e9;
    }
    .wa-msgtype-option.selected {
      background: rgba(0,168,132,0.15);
      border-color: #00a884;
    }
    .reply-indicator-container {
      background: rgba(0,168,132,0.1);
      border-left: 3px solid #00a884;
      padding: 8px 12px;
      margin-bottom: 8px;
      border-radius: 4px;
      display: none;
    }
    .reply-indicator-container.show {
      display: block;
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
  const parts = name.trim().split(' ').filter(p => p.length > 0);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function getColorFromName(name) {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
  let hash = 0;
  for (let i = 0; i < (name || 'User').length; i++) {
    hash = (name || 'User').charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

window.editMessage = async function(messageId) {
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!messageEl) return;
  
  const textEl = messageEl.querySelector('.message-text');
  if (!textEl) return;
  
  const currentText = textEl.textContent.trim();
  const newText = prompt('Edit your message:', currentText);
  
  if (newText === null || newText.trim() === '' || newText.trim() === currentText) {
    return;
  }
  
  try {
    const response = await fetch(`/api/messages/${messageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text: newText.trim() })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to edit message');
    }
    
    textEl.textContent = newText.trim();
    
    if (!messageEl.querySelector('.edited-badge')) {
      const header = messageEl.querySelector('.message-header');
      if (header) {
        const editedBadge = document.createElement('span');
        editedBadge.className = 'message-badge edited-badge';
        editedBadge.textContent = '✏️ edited';
        editedBadge.style.cssText = 'font-size:9px;padding:2px 6px;background:rgba(255,255,255,0.1);border-radius:4px;margin-left:4px;';
        header.appendChild(editedBadge);
      }
    }
    
    console.log('✅ Message edited successfully');
  } catch (error) {
    console.error('❌ Edit error:', error);
    alert('Failed to edit message: ' + error.message);
  }
};

window.initIdentityModeSelector = initIdentityModeSelector;
window.getIdentityMode = getIdentityMode;
window.setIdentityMode = setIdentityMode;
window.getSessionAlias = getSessionAlias;
window.regenerateAlias = regenerateAlias;
window.getMessageDisplayInfo = getMessageDisplayInfo;