let socket = null;
let currentUser = null;
let currentSession = null;
let sessionId = null;
let replyingTo = null;
let socketJoined = false;
let optionsMenuOpen = false;

console.log('🚀 student-chat.js loaded');

function getSessionIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('sessionId');
}

async function checkAuth() {
  console.log('🔐 Checking auth...');
  try {
    const authResponse = await fetch('/api/auth/me', { credentials: 'include' });
    if (!authResponse.ok) { window.location.href = '/login.html'; return false; }
    const authResult = await authResponse.json();
    if (!authResult.success) { window.location.href = '/login.html'; return false; }
    currentUser = authResult.user;
    currentUser._id = currentUser._id || currentUser.id;
    console.log('✅ Auth OK, user:', currentUser._id, 'Role:', currentUser.role);
    document.getElementById('user-name').textContent = currentUser.displayName;
    return true;
  } catch (error) { 
    console.error('❌ Auth error:', error);
    window.location.href = '/login.html'; 
    return false; 
  }
}

async function init() {
  console.log('🎬 Init starting...');
  try {
    sessionId = getSessionIdFromURL();
    console.log('📍 Session ID:', sessionId);
    if (!sessionId || sessionId.length !== 24) { alert('Invalid session ID'); redirectToDashboard(); return; }
    
    const authOk = await checkAuth();
    if (!authOk) return;
    
    console.log('📚 Loading session...');
    await loadSession();
    
    console.log('🔌 Initializing socket...');
    initializeSocket();
    
    console.log('📥 About to load messages...');
    await loadMessages();
    
    console.log('⌨️ Setting up input...');
    setupInputArea();
    
    console.log('✅ Init complete!');
  } catch (error) {
    console.error('❌ Init error:', error);
    removeLoadingSpinner();
    showError('Failed to load chat: ' + error.message);
    setTimeout(function() { redirectToDashboard(); }, 3000);
  }
}

function redirectToDashboard() {
  if (currentUser && currentUser.role === 'lecturer') {
    window.location.href = '/lecturer-dashboard.html';
  } else {
    window.location.href = '/student-dashboard.html';
  }
}

async function loadSession() {
  try {
    const response = await fetch('/api/sessions/' + sessionId, { credentials: 'include' });
    if (!response.ok) throw new Error('Session not found');
    const result = await response.json();
    if (result.success && result.session) {
      currentSession = result.session;
      document.getElementById('session-title').textContent = result.session.title;
      document.getElementById('session-info').textContent = (result.session.moduleCode || 'No module') + ' • Join Code: ' + result.session.joinCode;
    } else { throw new Error('Session data is invalid'); }
  } catch (error) { throw new Error('Cannot load session: ' + error.message); }
}

function initializeSocket() {
  socket = io({ transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 5, forceNew: false });
  socket.on('connect', function() {
    console.log('🔌 Socket connected');
    if (!sessionId || !currentUser) return;
    socket.emit('join-session', { sessionId: sessionId, userId: currentUser._id, displayName: currentUser.displayName, role: currentUser.role });
  });
  socket.on('joined-session', function(data) { 
    socketJoined = true; 
    console.log('✅ Joined session room');
  });
  socket.on('new-message', function(message) {
    console.log('📨 New message received via socket');
    var visOwner = String(message.user?.id || message.userId?._id || message.userId || '');
    appendMessage({
      id: message.id || message._id,
      username: message.user?.displayName || message.username,
      userRole: message.user?.role || message.userRole,
      visOwner: visOwner,
      text: message.text,
      type: message.type,
      timestamp: message.timestamp || message.createdAt,
      replyTo: message.replyTo,
      isPinned: message.isPinned,
      isAnnouncement: message.isAnnouncement,
      isReported: message.isReported,
      identityMode: message.identityMode || 'identified',
      alias: message.alias
    });
    scrollToBottom();
  });
  socket.on('message-deleted', function(data) {
    var el = document.querySelector('[data-message-id="' + data.messageId + '"]');
    if (el) { el.style.transition = 'opacity 0.3s'; el.style.opacity = '0'; setTimeout(function() { el.remove(); }, 300); }
  });
  socket.on('message-reported', function(data) {
    var el = document.querySelector('[data-message-id="' + data.messageId + '"]');
    if (el) { if (data.isReported) el.classList.add('reported-message'); else el.classList.remove('reported-message'); }
  });
  socket.on('message-edited', function(data) {
    var el = document.querySelector('[data-message-id="' + data.messageId + '"]');
    if (el) { var textEl = el.querySelector('.message-text'); if (textEl) textEl.textContent = data.text; }
  });
  socket.on('message-pinned', function(data) {
    var el = document.querySelector('[data-message-id="' + data.messageId + '"]');
    if (el) { if (data.isPinned) el.classList.add('pinned'); else el.classList.remove('pinned'); }
  });
  socket.on('disconnect', function() { socketJoined = false; console.log('🔌 Socket disconnected'); });
}

async function loadMessages() {
  console.log('📥 loadMessages() called');
  try {
    showLoadingSpinner();
    console.log('📥 Fetching from /api/messages/session/' + sessionId);
    const response = await fetch('/api/messages/session/' + sessionId + '?limit=200', { credentials: 'include' });
    console.log('📥 Response status:', response.status);
    
    const text = await response.text();
    console.log('📥 Raw response length:', text.length);
    
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.log('📥 First 500 chars:', text.substring(0, 500));
      throw new Error('Invalid JSON response');
    }
    
    removeLoadingSpinner();
    console.log('📥 Parsed result, messages:', result.messages?.length || 0);
    
    if (result.success && result.messages && result.messages.length > 0) {
      var container = document.getElementById('messages-container');
      // Clear loading/empty states
      var loading = container.querySelector('#loading');
      var empty = container.querySelector('.empty-state');
      if (loading) loading.style.display = 'none';
      if (empty) empty.remove();
      
      console.log('📥 Appending', result.messages.length, 'messages');
      result.messages.forEach(function(msg, index) {
        var visOwner = String(msg.user?.id || msg.userId?._id || msg.userId || '');
        if (index < 3) console.log('📥 Msg', index, '- id:', msg.id, 'owner:', visOwner);
        appendMessage({
          id: msg.id || msg._id,
          username: msg.user?.displayName || msg.username || 'Anonymous',
          userRole: msg.user?.role || msg.userRole || 'student',
          visOwner: visOwner,
          text: msg.text,
          type: msg.type,
          timestamp: msg.createdAt || msg.timestamp,
          replyTo: msg.replyTo,
          isPinned: msg.isPinned,
          isAnnouncement: msg.isAnnouncement,
          isReported: msg.isReported,
          identityMode: msg.identityMode || 'identified',
          alias: msg.alias
        });
      });
      scrollToBottom();
      console.log('📥 All messages appended');
    } else { 
      console.log('📥 No messages found');
      showEmptyState(); 
    }
  } catch (error) { 
    console.error('❌ loadMessages error:', error);
    removeLoadingSpinner(); 
    showError('Failed to load messages: ' + error.message); 
  }
}

function setupInputArea() {
  var inputContainer = document.querySelector('.chat-input-container');
  
  if (currentUser.role === 'lecturer') {
    inputContainer.innerHTML = `
      <div id="reply-indicator" class="reply-indicator-container" style="display:none;margin-bottom:8px;"></div>
      <div id="options-menu" class="options-menu" style="display:none;position:absolute;bottom:70px;left:12px;background:#1e293b;border-radius:12px;padding:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:100;min-width:220px;">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;padding:0 4px;">Message Options</div>
        <label style="display:flex;align-items:center;gap:10px;padding:10px 8px;cursor:pointer;border-radius:8px;transition:background 0.2s;" onmouseover="this.style.background='#334155'" onmouseout="this.style.background='transparent'">
          <input type="checkbox" id="is-announcement" style="width:18px;height:18px;accent-color:#f59e0b;">
          <span style="font-size:14px;">📢 Announcement</span>
        </label>
        <label style="display:flex;align-items:center;gap:10px;padding:10px 8px;cursor:pointer;border-radius:8px;transition:background 0.2s;" onmouseover="this.style.background='#334155'" onmouseout="this.style.background='transparent'">
          <input type="checkbox" id="pin-message" style="width:18px;height:18px;accent-color:#00a884;">
          <span style="font-size:14px;">📌 Pin Message</span>
        </label>
      </div>
      <div class="wa-input-row" style="display:flex;align-items:center;gap:8px;position:relative;">
        <button id="plus-btn" type="button" class="wa-plus-btn" style="width:44px;height:44px;border-radius:50%;border:none;background:#374151;color:white;font-size:24px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.2s;">+</button>
        <input type="text" id="message-input" class="wa-message-input" placeholder="Type a message" style="flex:1;padding:12px 16px;border-radius:24px;border:none;background:#1e293b;color:white;font-size:14px;outline:none;">
        <button id="send-btn" type="button" class="wa-send-btn" style="width:44px;height:44px;border-radius:50%;border:none;background:#00a884;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    `;
    
    // Setup + button click handler
    var plusBtn = document.getElementById('plus-btn');
    if (plusBtn) {
      plusBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleOptionsMenu();
      });
    }
    
    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      var menu = document.getElementById('options-menu');
      var plusBtn = document.getElementById('plus-btn');
      if (menu && optionsMenuOpen && !menu.contains(e.target) && e.target !== plusBtn) {
        menu.style.display = 'none';
        optionsMenuOpen = false;
        plusBtn.textContent = '+';
        plusBtn.style.background = '#374151';
      }
    });
  } else {
    var replyIndicator = document.getElementById('reply-indicator');
    if (!replyIndicator) {
      replyIndicator = document.createElement('div');
      replyIndicator.id = 'reply-indicator';
      replyIndicator.className = 'reply-indicator-container';
      replyIndicator.style.display = 'none';
      inputContainer.insertBefore(replyIndicator, inputContainer.firstChild);
    }
    if (typeof initIdentityModeSelector === 'function') { initIdentityModeSelector('.chat-input-container'); }
  }
  
  var sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  var input = document.getElementById('message-input');
  if (input) { 
    input.addEventListener('keypress', function(e) { 
      if (e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault(); 
        sendMessage(); 
      } 
    }); 
  }
}

function toggleOptionsMenu() {
  var menu = document.getElementById('options-menu');
  var plusBtn = document.getElementById('plus-btn');
  if (!menu || !plusBtn) return;
  
  optionsMenuOpen = !optionsMenuOpen;
  menu.style.display = optionsMenuOpen ? 'block' : 'none';
  plusBtn.textContent = optionsMenuOpen ? '×' : '+';
  plusBtn.style.background = optionsMenuOpen ? '#ef4444' : '#374151';
}

async function sendMessage() {
  var input = document.getElementById('message-input');
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;
  
  if (!socketJoined) { 
    socket.emit('join-session', { sessionId: sessionId, userId: currentUser._id, displayName: currentUser.displayName, role: currentUser.role }); 
  }
  
  var messageData;
  if (currentUser.role === 'lecturer') {
    var isAnnouncement = document.getElementById('is-announcement')?.checked || false;
    var shouldPin = document.getElementById('pin-message')?.checked || false;
    
    messageData = { sessionId: sessionId, text: text, type: 'COMMENT', replyTo: replyingTo ? replyingTo.id : null, isAnnouncement: isAnnouncement };
    try {
      var response = await fetch('/api/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(messageData) });
      if (!response.ok) { var errorData = await response.json(); throw new Error(errorData.message || 'Failed'); }
      var result = await response.json();
      if (shouldPin && result.messageData && result.messageData.id) { 
        await fetch('/api/messages/' + result.messageData.id + '/pin', { method: 'POST', credentials: 'include' }); 
      }
      input.value = '';
      var ac = document.getElementById('is-announcement'); if (ac) ac.checked = false;
      var pc = document.getElementById('pin-message'); if (pc) pc.checked = false;
      // Close options menu
      var menu = document.getElementById('options-menu');
      if (menu) menu.style.display = 'none';
      optionsMenuOpen = false;
      var plusBtn = document.getElementById('plus-btn');
      if (plusBtn) { plusBtn.textContent = '+'; plusBtn.style.background = '#374151'; }
      cancelReply(); 
      input.focus();
    } catch (error) { alert('Failed to send: ' + error.message); }
  } else {
    var typeSelect = document.getElementById('message-type');
    var identityMode = typeof getIdentityMode === 'function' ? getIdentityMode() : 'anonymous';
    var alias = identityMode === 'pseudonymous' && typeof getSessionAlias === 'function' ? getSessionAlias() : null;
    messageData = { sessionId: sessionId, text: text, type: typeSelect ? typeSelect.value : 'COMMENT', replyTo: replyingTo ? replyingTo.id : null, identityMode: identityMode, alias: alias };
    try {
      var response = await fetch('/api/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(messageData) });
      if (!response.ok) { var errorData = await response.json(); throw new Error(errorData.message || 'Failed'); }
      input.value = ''; cancelReply(); input.focus();
    } catch (error) { alert('Failed to send: ' + error.message); }
  }
}

function appendMessage(message) {
  var container = document.getElementById('messages-container');
  if (!container) return;
  var emptyState = container.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  // Check for duplicate
  var existingMsg = document.querySelector('[data-message-id="' + (message.id || message._id) + '"]');
  if (existingMsg) {
    console.log('⚠️ Duplicate message, skipping:', message.id);
    return;
  }

  var messageDiv = document.createElement('div');
  var isLecturer = message.userRole === 'lecturer';
  var isOwnMessage = currentUser && message.visOwner && (message.visOwner === currentUser._id);
  var identityMode = message.identityMode || 'identified';
  
  var messageClasses = 'chat-message ' + (isLecturer ? 'lecturer-message' : 'student-message');
  if (isOwnMessage && !message.isAnnouncement) messageClasses += ' own-message';
  if (message.isAnnouncement) messageClasses += ' announcement';
  if (message.isPinned) messageClasses += ' pinned';
  if (message.isReported) messageClasses += ' reported-message';
  if (!isLecturer && identityMode !== 'identified') messageClasses += ' ' + identityMode + '-message';

  messageDiv.className = messageClasses;
  messageDiv.dataset.messageId = message.id || message._id;

  var displayName, avatarHTML, identityBadge = '';
  if (isLecturer) {
    displayName = message.username || 'Lecturer';
    avatarHTML = generateAvatarHTML(displayName, true);
  } else {
    if (identityMode === 'anonymous') {
      displayName = 'Anonymous';
      avatarHTML = '<div class="message-avatar anon-avatar" style="width:40px;height:40px;border-radius:50%;background:#6b7280;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:bold;flex-shrink:0;">?</div>';
      identityBadge = '<span class="identity-badge anonymous">👤 Anon</span>';
    } else if (identityMode === 'pseudonymous') {
      displayName = message.alias || 'Student';
      var ai = displayName.substring(0, 2).toUpperCase();
      avatarHTML = '<div class="message-avatar pseudo-avatar" style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:700;flex-shrink:0;">' + ai + '</div>';
      identityBadge = '<span class="identity-badge pseudonymous">🎭 Alias</span>';
    } else {
      displayName = message.username || 'Student';
      avatarHTML = generateAvatarHTML(displayName, false);
    }
  }

  var lecturerBadge = isLecturer ? '<span class="lecturer-badge-inline">👨‍🏫 LECTURER</span>' : '';
  var replyHTML = '';
  if (message.replyTo) {
    var ru = message.replyTo.user?.displayName || message.replyTo.userId?.displayName || 'Unknown';
    var rt = message.replyTo.text && message.replyTo.text.length > 50 ? message.replyTo.text.substring(0, 50) + '...' : (message.replyTo.text || '');
    replyHTML = '<div class="reply-context" onclick="scrollToMessage(\'' + (message.replyTo._id || message.replyTo.id) + '\')"><span class="reply-icon">↩️</span><span class="reply-to-user">' + escapeHtml(ru) + '</span><span class="reply-preview">' + escapeHtml(rt) + '</span></div>';
  }

  var typeIcon = getTypeIcon(message.type);
  var badgeHTML = '';
  if (message.isPinned) badgeHTML += '<span class="message-badge badge-pinned">📌 Pinned</span>';
  if (message.isAnnouncement) badgeHTML += '<span class="message-badge badge-announcement">📢 Announcement</span>';
  if (message.isReported) badgeHTML += '<span class="message-badge badge-reported">🚩 Reported</span>';

  var actionButtonsHTML = '<button class="action-btn reply-btn" onclick="setReplyTo(\'' + (message.id || message._id) + '\', \'' + escapeHtml(displayName) + '\', \'' + escapeHtml((message.text || '').substring(0, 100)) + '\')" title="Reply">↩️ Reply</button>';

  if (currentUser && currentUser.role === 'lecturer') {
    actionButtonsHTML += '<button class="action-btn edit-btn" onclick="editMessage(\'' + (message.id || message._id) + '\')" title="Edit">✏️ Edit</button>';
    actionButtonsHTML += '<button class="action-btn pin-btn" onclick="togglePin(\'' + (message.id || message._id) + '\')" title="' + (message.isPinned ? 'Unpin' : 'Pin') + '">' + (message.isPinned ? '📌 Unpin' : '📍 Pin') + '</button>';
    actionButtonsHTML += message.isReported 
      ? '<button class="action-btn report-btn reported" onclick="unreportMessage(\'' + (message.id || message._id) + '\')" title="Remove Report">✅ Unreport</button>'
      : '<button class="action-btn report-btn" onclick="reportMessage(\'' + (message.id || message._id) + '\')" title="Report">🚩 Report</button>';
    actionButtonsHTML += '<button class="action-btn delete-btn" onclick="deleteMessage(\'' + (message.id || message._id) + '\')" title="Delete">🗑️ Delete</button>';
  } else if (isOwnMessage) {
    actionButtonsHTML += '<button class="action-btn edit-btn" onclick="editMessage(\'' + (message.id || message._id) + '\')" title="Edit">✏️ Edit</button>';
    actionButtonsHTML += '<button class="action-btn delete-btn" onclick="deleteMessage(\'' + (message.id || message._id) + '\')" title="Delete">🗑️ Delete</button>';
  }

  messageDiv.innerHTML = '<div class="message-avatar-wrapper">' + avatarHTML + '</div><div class="message-content-wrapper"><div class="message-header"><span class="message-username ' + (isLecturer ? 'lecturer' : 'student') + '">' + escapeHtml(displayName) + '</span>' + lecturerBadge + identityBadge + '<span class="message-time">' + formatTime(message.timestamp || message.createdAt || new Date()) + '</span></div>' + replyHTML + '<div class="message-body"><span class="message-type-indicator">' + typeIcon + '</span><span class="message-text">' + escapeHtml(message.text) + '</span></div><div class="message-footer">' + badgeHTML + '<div class="message-actions">' + actionButtonsHTML + '</div></div></div>';

  container.appendChild(messageDiv);
}

function generateAvatarHTML(displayName, isLecturer) {
  var initials = getAvatarInitials(displayName);
  var bgColor = generateColorFromName(displayName);
  var border = isLecturer ? 'border:2px solid #667eea;' : '';
  return '<div class="message-avatar ' + (isLecturer ? 'lecturer-avatar' : '') + '" style="width:40px;height:40px;border-radius:50%;background-color:' + bgColor + ';display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;flex-shrink:0;' + border + '">' + initials + '</div>';
}

function getAvatarInitials(name) {
  if (!name) return '??';
  var parts = name.trim().split(' ').filter(function(p) { return p.length > 0; });
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function generateColorFromName(name) {
  var colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
  var hash = 0;
  for (var i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

window.deleteMessage = async function(messageId) {
  if (!confirm('Delete this message permanently?')) return;
  try {
    var response = await fetch('/api/messages/' + messageId, { method: 'DELETE', credentials: 'include' });
    if (!response.ok) { var e = await response.json(); throw new Error(e.message || 'Failed'); }
    var el = document.querySelector('[data-message-id="' + messageId + '"]');
    if (el) { el.style.transition = 'opacity 0.3s'; el.style.opacity = '0'; setTimeout(function() { el.remove(); }, 300); }
  } catch (error) { alert('Failed: ' + error.message); }
};

window.editMessage = async function(messageId) {
  var el = document.querySelector('[data-message-id="' + messageId + '"]');
  if (!el) return;
  var textEl = el.querySelector('.message-text');
  if (!textEl) return;
  var currentText = textEl.textContent.trim();
  var newText = prompt('Edit your message:', currentText);
  if (newText === null || newText.trim() === '' || newText.trim() === currentText) return;
  try {
    var response = await fetch('/api/messages/' + messageId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ text: newText.trim() }) });
    if (!response.ok) { var e = await response.json(); throw new Error(e.message || 'Failed'); }
    textEl.textContent = newText.trim();
  } catch (error) { alert('Failed: ' + error.message); }
};

window.reportMessage = async function(messageId) {
  var reason = prompt('Why are you reporting this? (Optional)');
  if (reason === null) return;
  try {
    var response = await fetch('/api/messages/' + messageId + '/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ reason: reason || 'Violation' }) });
    if (!response.ok) { var e = await response.json(); throw new Error(e.message || 'Failed'); }
    alert('Reported');
  } catch (error) { alert('Failed: ' + error.message); }
};

window.unreportMessage = async function(messageId) {
  if (!confirm('Remove report?')) return;
  try {
    var response = await fetch('/api/messages/' + messageId + '/report', { method: 'DELETE', credentials: 'include' });
    if (!response.ok) { var e = await response.json(); throw new Error(e.message || 'Failed'); }
    alert('Removed');
  } catch (error) { alert('Failed: ' + error.message); }
};

window.togglePin = async function(messageId) {
  try {
    var el = document.querySelector('[data-message-id="' + messageId + '"]');
    var isPinned = el?.classList.contains('pinned');
    var response = await fetch('/api/messages/' + messageId + '/pin', { method: 'POST', credentials: 'include' });
    if (!response.ok) { var e = await response.json(); throw new Error(e.message || 'Failed'); }
    if (el) {
      if (isPinned) el.classList.remove('pinned');
      else el.classList.add('pinned');
    }
  } catch (error) { alert('Failed: ' + error.message); }
};

function setReplyTo(messageId, username, text) {
  replyingTo = { id: messageId, username: username, text: text };
  var indicator = document.getElementById('reply-indicator');
  if (!indicator) { 
    indicator = document.createElement('div'); 
    indicator.id = 'reply-indicator'; 
    indicator.className = 'reply-indicator-container'; 
    var inputContainer = document.querySelector('.chat-input-container');
    inputContainer.insertBefore(indicator, inputContainer.firstChild); 
  }
  indicator.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(0,168,132,0.15);border-left:3px solid #00a884;border-radius:8px;"><div><div style="font-size:12px;color:#00a884;font-weight:600;">Replying to ' + escapeHtml(username) + '</div><div style="font-size:13px;color:#94a3b8;margin-top:2px;">' + escapeHtml(text.length > 60 ? text.substring(0, 60) + '...' : text) + '</div></div><button onclick="cancelReply()" style="background:none;border:none;font-size:20px;color:#94a3b8;cursor:pointer;padding:4px 8px;">×</button></div>';
  indicator.style.display = 'block';
  indicator.style.marginBottom = '8px';
  var input = document.getElementById('message-input'); if (input) input.focus();
}

function cancelReply() { 
  replyingTo = null; 
  var indicator = document.getElementById('reply-indicator'); 
  if (indicator) indicator.style.display = 'none'; 
}

function scrollToMessage(messageId) {
  var el = document.querySelector('[data-message-id="' + messageId + '"]');
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('message-highlighted'); setTimeout(function() { el.classList.remove('message-highlighted'); }, 2000); }
}

function showLoadingSpinner() { var el = document.getElementById('loading'); if (el) el.style.display = 'flex'; }
function removeLoadingSpinner() { var el = document.getElementById('loading'); if (el) el.style.display = 'none'; }
function showEmptyState() { 
  var container = document.getElementById('messages-container'); 
  var div = document.createElement('div'); 
  div.className = 'empty-state'; 
  div.style.cssText = 'text-align:center;padding:60px 20px;color:#94a3b8;'; 
  div.innerHTML = '<div style="font-size:48px;margin-bottom:16px;">💬</div><h3 style="color:white;margin-bottom:8px;">No messages yet</h3><p>Be the first to start the conversation!</p>'; 
  container.appendChild(div); 
}
function showError(message) { 
  var container = document.getElementById('messages-container'); 
  var div = document.createElement('div'); 
  div.innerHTML = '<div style="text-align:center;padding:60px;color:#ef4444;"><div style="font-size:48px;">⚠️</div><h3>Error</h3><p>' + escapeHtml(message) + '</p></div>'; 
  container.appendChild(div); 
}
function escapeHtml(text) { var div = document.createElement('div'); div.textContent = text || ''; return div.innerHTML; }
function formatTime(timestamp) { return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
function getTypeIcon(type) { return { 'QUESTION': '❓', 'COMMENT': '💬', 'CONFUSION': '❗' }[type] || '💬'; }
function scrollToBottom() { var container = document.getElementById('messages-container'); if (container) container.scrollTop = container.scrollHeight; }

window.setReplyTo = setReplyTo;
window.cancelReply = cancelReply;
window.scrollToMessage = scrollToMessage;
window.toggleOptionsMenu = toggleOptionsMenu;

document.addEventListener('DOMContentLoaded', function() { 
  console.log('📄 DOM ready, calling init()');
  init(); 
});