// ============================================
// Identity Mode Handler - client/js/identity-mode.js
// Handles anonymous, pseudonymous, and identified chat modes
// ============================================
// Research justification (McDowell et al., 2019):
// - Anonymous: ~3000 messages vs Teams (named): ~10 messages
// - Students avoid identifiable public forums
// - Pseudonymous provides accountability while preserving privacy
// ============================================

let currentIdentityMode = 'anonymous'; // Default to anonymous for max engagement
let userAlias = null;

// ============================================
// ALIAS GENERATION
// ============================================

// Generate a fun, memorable alias for pseudonymous mode
function generateAlias() {
  const adjectives = [
    'Swift', 'Clever', 'Curious', 'Bright', 'Quick', 
    'Eager', 'Bold', 'Calm', 'Wise', 'Keen',
    'Happy', 'Brave', 'Witty', 'Noble', 'Merry'
  ];
  const animals = [
    'Falcon', 'Dolphin', 'Panda', 'Fox', 'Owl', 
    'Tiger', 'Eagle', 'Wolf', 'Bear', 'Hawk',
    'Otter', 'Raven', 'Lion', 'Deer', 'Lynx'
  ];
  const number = Math.floor(Math.random() * 999) + 1;
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  
  return `${adj}${animal}${number}`;
}

// Get or create alias for current session (persists per session)
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

// Regenerate alias (user can get a new one)
function regenerateAlias() {
  const sessionId = new URLSearchParams(window.location.search).get('sessionId');
  const storageKey = `alias_${sessionId}`;
  userAlias = generateAlias();
  localStorage.setItem(storageKey, userAlias);
  updateAliasPreview();
  return userAlias;
}

// ============================================
// UI CREATION
// ============================================

function createIdentityModeSelector() {
  if (document.getElementById('identity-mode-container')) return null;
  
  const container = document.createElement('div');
  container.id = 'identity-mode-container';
  container.innerHTML = `
    <div class="identity-mode-selector">
      <div class="identity-header">
        <span class="identity-label">🔒 Post as:</span>
        <span class="identity-hint">(only you control this)</span>
      </div>
      <div class="identity-options">
        <label class="identity-option" data-mode="anonymous" title="Everyone sees 'Anonymous' - maximum privacy">
          <input type="radio" name="identity-mode" value="anonymous" checked>
          <div class="option-content">
            <span class="option-icon">👤</span>
            <span class="option-text">Anonymous</span>
          </div>
          <span class="option-desc">Hidden identity</span>
        </label>
        
        <label class="identity-option" data-mode="pseudonymous" title="Post with a fun alias like 'SwiftFalcon123'">
          <input type="radio" name="identity-mode" value="pseudonymous">
          <div class="option-content">
            <span class="option-icon">🎭</span>
            <span class="option-text">Alias</span>
          </div>
          <span class="option-desc">Fun nickname</span>
        </label>
        
        <label class="identity-option" data-mode="identified" title="Show your real name and profile">
          <input type="radio" name="identity-mode" value="identified">
          <div class="option-content">
            <span class="option-icon">😊</span>
            <span class="option-text">Real Name</span>
          </div>
          <span class="option-desc">Full identity</span>
        </label>
      </div>
      
      <div id="alias-preview" class="alias-preview" style="display: none;">
        <span>Your alias: <strong id="alias-name"></strong></span>
        <button type="button" onclick="regenerateAlias()" class="alias-refresh-btn" title="Get a new alias">🔄</button>
      </div>
    </div>
  `;
  
  addIdentityModeStyles();
  return container;
}

function addIdentityModeStyles() {
  if (document.getElementById('identity-mode-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'identity-mode-styles';
  style.textContent = `
    /* Identity Mode Selector */
    .identity-mode-selector {
      background: var(--bg-secondary, #252542);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      border: 1px solid var(--border-color, #333);
    }
    
    .identity-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .identity-label {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary, #fff);
    }
    
    .identity-hint {
      font-size: 11px;
      color: var(--text-secondary, #9ca3af);
    }
    
    .identity-options {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    
    .identity-option {
      flex: 1;
      min-width: 100px;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 8px;
      background: var(--bg-primary, #1a1a2e);
      border: 2px solid transparent;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
    }
    
    .identity-option:hover {
      background: var(--bg-tertiary, #2d2d4a);
      border-color: rgba(102, 126, 234, 0.3);
    }
    
    .identity-option input {
      display: none;
    }
    
    .identity-option:has(input:checked) {
      border-color: #667eea;
      background: rgba(102, 126, 234, 0.15);
    }
    
    .option-content {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    
    .option-icon {
      font-size: 18px;
    }
    
    .option-text {
      font-weight: 600;
      font-size: 13px;
      color: var(--text-primary, #fff);
    }
    
    .option-desc {
      font-size: 10px;
      color: var(--text-secondary, #9ca3af);
    }
    
    .identity-option:has(input:checked) .option-text {
      color: #667eea;
    }
    
    /* Alias Preview */
    .alias-preview {
      margin-top: 12px;
      padding: 10px 14px;
      background: rgba(102, 126, 234, 0.1);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;
      color: var(--text-secondary, #9ca3af);
    }
    
    .alias-preview strong {
      color: #667eea;
      font-weight: 700;
    }
    
    .alias-refresh-btn {
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.2s;
    }
    
    .alias-refresh-btn:hover {
      background: rgba(102, 126, 234, 0.2);
    }
    
    /* ============================================ */
    /* MESSAGE STYLING BY IDENTITY MODE */
    /* ============================================ */
    
    /* Anonymous Messages - All look identical */
    .message-bubble.anonymous-message .message-avatar {
      background: #6b7280 !important;
    }
    
    .message-bubble.anonymous-message .message-username {
      color: #9ca3af;
    }
    
    /* Pseudonymous Messages - Gradient avatar */
    .message-bubble.pseudonymous-message .message-avatar {
      background: linear-gradient(135deg, #667eea, #764ba2) !important;
    }
    
    /* Identity Badges */
    .identity-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 10px;
      margin-left: 6px;
      font-weight: 500;
    }
    
    .identity-badge.anonymous {
      background: rgba(107, 114, 128, 0.3);
      color: #9ca3af;
    }
    
    .identity-badge.pseudonymous {
      background: rgba(102, 126, 234, 0.2);
      color: #a5b4fc;
    }
    
    /* Anonymous avatar placeholder */
    .anon-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #6b7280;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 16px;
      font-weight: bold;
      flex-shrink: 0;
    }
    
    /* Pseudonymous avatar */
    .pseudo-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);
}

// ============================================
// INITIALIZATION
// ============================================

function initIdentityModeSelector(containerSelector) {
  const targetContainer = document.querySelector(containerSelector);
  if (!targetContainer) {
    console.error('Identity mode container not found:', containerSelector);
    return;
  }
  
  const selector = createIdentityModeSelector();
  if (!selector) return; // Already exists
  
  targetContainer.insertBefore(selector, targetContainer.firstChild);
  
  // Add event listeners
  const radios = document.querySelectorAll('input[name="identity-mode"]');
  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentIdentityMode = e.target.value;
      updateAliasPreview();
      
      // Visual feedback
      document.querySelectorAll('.identity-option').forEach(opt => {
        opt.classList.remove('selected');
      });
      e.target.closest('.identity-option').classList.add('selected');
      
      console.log('🔒 Identity mode changed to:', currentIdentityMode);
    });
  });
  
  // Initialize alias
  getSessionAlias();
  updateAliasPreview();
}

function updateAliasPreview() {
  const preview = document.getElementById('alias-preview');
  const aliasName = document.getElementById('alias-name');
  
  if (!preview || !aliasName) return;
  
  if (currentIdentityMode === 'pseudonymous') {
    preview.style.display = 'flex';
    aliasName.textContent = getSessionAlias();
  } else {
    preview.style.display = 'none';
  }
}

// ============================================
// PUBLIC API
// ============================================

function getIdentityMode() {
  return currentIdentityMode;
}

function setIdentityMode(mode) {
  if (['anonymous', 'pseudonymous', 'identified'].includes(mode)) {
    currentIdentityMode = mode;
    const radio = document.querySelector(`input[name="identity-mode"][value="${mode}"]`);
    if (radio) {
      radio.checked = true;
      updateAliasPreview();
    }
  }
}

// Get display info for rendering a message
function getMessageDisplayInfo(message) {
  const identityMode = message.identityMode || 'identified';
  const userRole = message.userRole || message.user?.role || 'student';
  
  // Lecturers always show real identity
  if (userRole === 'lecturer') {
    return {
      displayName: message.username || message.user?.displayName || 'Lecturer',
      avatarHtml: createAvatarHtml(message.username || 'Lecturer', 'lecturer'),
      identityBadge: '',
      cssClass: ''
    };
  }
  
  // Students - apply identity mode
  switch (identityMode) {
    case 'anonymous':
      return {
        displayName: 'Anonymous',
        avatarHtml: '<div class="anon-avatar">?</div>',
        identityBadge: '<span class="identity-badge anonymous">👤 Anon</span>',
        cssClass: 'anonymous-message'
      };
      
    case 'pseudonymous':
      const alias = message.alias || 'Student';
      const initials = alias.substring(0, 2).toUpperCase();
      return {
        displayName: alias,
        avatarHtml: `<div class="pseudo-avatar">${initials}</div>`,
        identityBadge: '<span class="identity-badge pseudonymous">🎭 Alias</span>',
        cssClass: 'pseudonymous-message'
      };
      
    case 'identified':
    default:
      const name = message.username || message.user?.displayName || 'Student';
      return {
        displayName: name,
        avatarHtml: createAvatarHtml(name, 'student'),
        identityBadge: '',
        cssClass: ''
      };
  }
}

function createAvatarHtml(name, role) {
  const initials = getInitials(name);
  const color = role === 'lecturer' 
    ? 'linear-gradient(135deg, #667eea, #764ba2)' 
    : getColorFromName(name);
  
  return `<div class="message-avatar" style="background: ${color};">${initials}</div>`;
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

// Export to window for global access
window.initIdentityModeSelector = initIdentityModeSelector;
window.getIdentityMode = getIdentityMode;
window.setIdentityMode = setIdentityMode;
window.getSessionAlias = getSessionAlias;
window.regenerateAlias = regenerateAlias;
window.getMessageDisplayInfo = getMessageDisplayInfo;