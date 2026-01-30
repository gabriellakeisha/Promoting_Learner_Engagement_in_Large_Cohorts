let socket = null;
let currentUser = null;
let currentSession = null;
let sessionId = null;
let replyingTo = null;
let socketJoined = false;
let optionsMenuOpen = false;
let activeReactionPicker = null;

console.log('🚀 student-chat.js loaded');

// Inject reaction styles
(function injectReactionStyles() {
  if (document.getElementById('reaction-styles')) return;
  var style = document.createElement('style');
  style.id = 'reaction-styles';
  style.textContent = `
    /* WhatsApp-style Reaction Picker */
    .reaction-picker {
      background: #1f2c34;
      border-radius: 24px;
      padding: 8px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      z-index: 9999;
      animation: reactionPopIn 0.2s ease;
      max-width: 320px;
    }
    @keyframes reactionPopIn {
      from { transform: scale(0.8); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .reaction-picker-btn {
      background: none;
      border: none;
      font-size: 28px;
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      transition: all 0.15s ease;
      line-height: 1;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .reaction-picker-btn:hover {
      background: rgba(255,255,255,0.15);
      transform: scale(1.2);
    }
    
    /* Reaction Chips on Messages */
    .message-reactions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
      min-height: 0;
    }
    .reaction-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 16px;
      padding: 4px 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 14px;
    }
    .reaction-chip:hover {
      background: rgba(255,255,255,0.15);
      transform: scale(1.05);
    }
    .reaction-chip.reacted {
      background: rgba(0, 168, 132, 0.25);
      border-color: #00a884;
    }
    .reaction-emoji {
      font-size: 16px;
      line-height: 1;
    }
    .reaction-count {
      font-size: 12px;
      font-weight: 600;
      color: #aebac1;
    }
    .reaction-chip.reacted .reaction-count {
      color: #00e5a0;
    }
    
    /* Reaction button in actions */
    .reaction-btn {
      font-size: 14px !important;
    }
    
    /* Full Emoji Picker Overlay */
    .emoji-picker-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .emoji-picker-wrapper {
      animation: scaleIn 0.2s ease;
    }
    @keyframes scaleIn {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
})();

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
    
    // Close reaction picker when clicking outside
    document.addEventListener('click', function(e) {
      if (activeReactionPicker && !activeReactionPicker.contains(e.target) && !e.target.classList.contains('reaction-btn')) {
        closeReactionPicker();
      }
    });

    console.log('✅ Init complete!');
  } catch (error) {
    console.error('❌ Init error:', error);
    removeLoadingSpinner();
    showError('Failed to load chat: ' + error.message);
    setTimeout(function () { redirectToDashboard(); }, 3000);
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
  
  socket.on('connect', function () {
    console.log('🔌 Socket connected, id:', socket.id);
    if (!sessionId || !currentUser) {
      console.log('⚠️ Missing sessionId or currentUser, cannot join room');
      return;
    }
    var roomToJoin = sessionId.toString();
    console.log('📤 Emitting join-session for room: session-' + roomToJoin);
    socket.emit('join-session', { sessionId: roomToJoin, userId: currentUser._id, displayName: currentUser.displayName, role: currentUser.role });
  });
  
  socket.on('joined-session', function (data) {
    socketJoined = true;
    console.log('✅ Joined session room:', data);
  });
  
  socket.on('new-message', function (message) {
    console.log('📨 New message received via socket:', message.id || message._id);
    var visOwner = String(message.user?.id || message.userId?._id || message.userId || '');
    appendMessage({
      id: message.id || message._id,
      username: message.user?.displayName || message.username,
      userRole: message.user?.role || message.userRole,
      visOwner: visOwner,
      avatarUrl: message.avatarUrl || message.user?.avatarUrl || null,
      text: message.text,
      type: message.type,
      timestamp: message.timestamp || message.createdAt,
      replyTo: message.replyTo,
      isPinned: message.isPinned,
      isAnnouncement: message.isAnnouncement,
      isReported: message.isReported,
      identityMode: message.identityMode || 'identified',
      alias: message.alias,
      reactions: message.reactions || {}
    });
    scrollToBottom();
    
    // Track new announcements and pinned messages
    if (message.isAnnouncement && typeof addAnnouncement === 'function') {
      addAnnouncement({
        id: message.id || message._id,
        username: message.user?.displayName || message.username,
        text: message.text,
        timestamp: message.timestamp || message.createdAt,
        isAnnouncement: true
      });
    }
    if (message.isPinned && typeof addPinnedMessage === 'function') {
      addPinnedMessage({
        id: message.id || message._id,
        username: message.user?.displayName || message.username,
        text: message.text,
        timestamp: message.timestamp || message.createdAt,
        isPinned: true
      });
    }
  });
  
  socket.on('message-deleted', function (data) {
    var el = document.querySelector('[data-message-id="' + data.messageId + '"]');
    if (el) { el.style.transition = 'opacity 0.3s'; el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 300); }
  });
  socket.on('message-reported', function (data) {
    var el = document.querySelector('[data-message-id="' + data.messageId + '"]');
    if (el) { if (data.isReported) el.classList.add('reported-message'); else el.classList.remove('reported-message'); }
  });
  socket.on('message-edited', function (data) {
    var el = document.querySelector('[data-message-id="' + data.messageId + '"]');
    if (el) { var textEl = el.querySelector('.message-text'); if (textEl) textEl.textContent = data.text; }
  });
  
  // Updated message-pinned handler with pin bar update
  socket.on('message-pinned', function (data) {
    var msgId = data.messageId || data.id;
    var el = document.querySelector('[data-message-id="' + msgId + '"]');
    if (el) { 
      if (data.isPinned) el.classList.add('pinned'); 
      else el.classList.remove('pinned'); 
    }
    if (typeof handlePinUpdate === 'function') {
      handlePinUpdate(data);
    }
  });
  
  // Handle reaction updates in real-time
  socket.on('message-reaction', function (data) {
    console.log('Reaction update received:', data);
    updateMessageReactions(data.messageId, data.reactions);
  });
  
  socket.on('disconnect', function (reason) { 
    socketJoined = false; 
    console.log('🔌 Socket disconnected, reason:', reason); 
  });
  
  socket.on('reconnect', function (attemptNumber) {
    console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
    if (sessionId && currentUser) {
      socket.emit('join-session', { sessionId: sessionId, userId: currentUser._id, displayName: currentUser.displayName, role: currentUser.role });
    }
  });
  
  socket.on('connect_error', function (error) {
    console.error('❌ Socket connect error:', error.message);
  });
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
      var loading = container.querySelector('#loading');
      var empty = container.querySelector('.empty-state');
      if (loading) loading.style.display = 'none';
      if (empty) empty.remove();

      console.log('📥 Appending', result.messages.length, 'messages');
      result.messages.forEach(function (msg, index) {
        var visOwner = String(msg.user?.id || msg.userId?._id || msg.userId || '');
        if (index < 3) console.log('📥 Msg', index, '- id:', msg.id, 'owner:', visOwner);
        appendMessage({
          id: msg.id || msg._id,
          username: msg.user?.displayName || msg.username || 'Anonymous',
          userRole: msg.user?.role || msg.userRole || 'student',
          visOwner: visOwner,
          avatarUrl: msg.avatarUrl || msg.user?.avatarUrl || null,
          text: msg.text,
          type: msg.type,
          timestamp: msg.createdAt || msg.timestamp,
          replyTo: msg.replyTo,
          isPinned: msg.isPinned,
          isAnnouncement: msg.isAnnouncement,
          isReported: msg.isReported,
          identityMode: msg.identityMode || 'identified',
          alias: msg.alias,
          reactions: msg.reactions || {}
        });
      });
      scrollToBottom();
      console.log('📥 All messages appended');
      
      // Initialize announcement and pinned messages feature
      var formattedForFeature = result.messages.map(function(msg) {
        return {
          id: msg.id || msg._id,
          username: msg.user?.displayName || msg.username || 'Anonymous',
          text: msg.text,
          timestamp: msg.createdAt || msg.timestamp,
          isPinned: msg.isPinned,
          isAnnouncement: msg.isAnnouncement
        };
      });
      if (typeof initializeAnnouncementAndPinFeature === 'function') {
        initializeAnnouncementAndPinFeature(formattedForFeature);
      }
      
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
      <div class="other-input-row" style="display:flex;align-items:center;gap:8px;position:relative;">
        <button id="plus-btn" type="button" class="other-plus-btn" style="width:44px;height:44px;border-radius:50%;border:none;background:#374151;color:white;font-size:24px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.2s;">+</button>
        <input type="text" id="message-input" class="other-message-input" placeholder="Type a message" style="flex:1;padding:12px 16px;border-radius:24px;border:none;background:#1e293b;color:white;font-size:14px;outline:none;">
        <button id="send-btn" type="button" class="other-send-btn" style="width:44px;height:44px;border-radius:50%;border:none;background:#00a884;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    `;

    var plusBtn = document.getElementById('plus-btn');
    if (plusBtn) {
      plusBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleOptionsMenu();
      });
    }

    document.addEventListener('click', function (e) {
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
    input.addEventListener('keypress', function (e) {
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
    messageData = { sessionId: sessionId, text: text, type: typeSelect ? typeSelect.value : 'NONE', replyTo: replyingTo ? replyingTo.id : null, identityMode: identityMode, alias: alias };
    try {
      var response = await fetch('/api/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(messageData) });
      if (!response.ok) { var errorData = await response.json(); throw new Error(errorData.message || 'Failed'); }
      input.value = ''; cancelReply(); input.focus();
    } catch (error) { alert('Failed to send: ' + error.message); }
  }
}

function appendMessage(message) {
  console.log('📝 appendMessage called with:', message.id || message._id, message.text?.substring(0, 30));
  
  var container = document.getElementById('messages-container');
  if (!container) {
    console.error('❌ messages-container not found!');
    return;
  }
  
  var emptyState = container.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  var msgId = message.id || message._id;
  var existingMsg = document.querySelector('[data-message-id="' + msgId + '"]');
  if (existingMsg) {
    console.log('⚠️ Duplicate message, skipping:', msgId);
    return;
  }
  
  console.log('✅ Creating new message element for:', msgId);

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
    avatarHTML = generateAvatarHTML(displayName, true, message.avatarUrl);
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
      avatarHTML = generateAvatarHTML(displayName, false, message.avatarUrl);
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

  var reactionBtnHTML = '<button class="action-btn reaction-btn" onclick="showReactionPicker(event, \'' + msgId + '\')" title="React">😀</button>';

  var actionButtonsHTML = reactionBtnHTML;
  actionButtonsHTML += '<button class="action-btn reply-btn" onclick="setReplyTo(\'' + msgId + '\', \'' + escapeHtml(displayName) + '\', \'' + escapeHtml((message.text || '').substring(0, 100)) + '\')" title="Reply">↩️</button>';

  if (currentUser && currentUser.role === 'lecturer') {
    actionButtonsHTML += '<button class="action-btn edit-btn" onclick="editMessage(\'' + msgId + '\')" title="Edit">✏️</button>';
    actionButtonsHTML += '<button class="action-btn pin-btn" onclick="togglePin(\'' + msgId + '\')" title="' + (message.isPinned ? 'Unpin' : 'Pin') + '">' + (message.isPinned ? '📌' : '📍') + '</button>';
    actionButtonsHTML += '<button class="action-btn report-btn" onclick="' + (message.isReported ? 'unreportMessage' : 'reportMessage') + '(\'' + msgId + '\')" title="' + (message.isReported ? 'Unreport' : 'Report') + '">' + (message.isReported ? '✅' : '🚩') + '</button>';
    actionButtonsHTML += '<button class="action-btn delete-btn" onclick="deleteMessage(\'' + msgId + '\')" title="Delete">🗑️</button>';
  } else if (isOwnMessage) {
    actionButtonsHTML += '<button class="action-btn edit-btn" onclick="editMessage(\'' + msgId + '\')" title="Edit">✏️</button>';
    actionButtonsHTML += '<button class="action-btn delete-btn" onclick="deleteMessage(\'' + msgId + '\')" title="Delete">🗑️</button>';
  }

  var reactionsHTML = renderReactions(msgId, message.reactions);

  messageDiv.innerHTML = '<div class="message-avatar-wrapper">' + avatarHTML + '</div><div class="message-content-wrapper"><div class="message-header"><span class="message-username ' + (isLecturer ? 'lecturer' : 'student') + '">' + escapeHtml(displayName) + '</span>' + lecturerBadge + identityBadge + '<span class="message-time">' + formatTime(message.timestamp || message.createdAt || new Date()) + '</span></div>' + replyHTML + '<div class="message-body"><span class="message-type-indicator">' + typeIcon + '</span><span class="message-text">' + escapeHtml(message.text) + '</span></div>' + reactionsHTML + '<div class="message-footer">' + badgeHTML + '<div class="message-actions">' + actionButtonsHTML + '</div></div></div>';

  container.appendChild(messageDiv);
  console.log('✅ Message appended to DOM:', msgId, '- Total messages now:', container.querySelectorAll('.chat-message').length);
}

// ========================================
// EMOJI REACTION SYSTEM (Using emoji-picker-element)
// ========================================

// Quick reactions - the main 6 that appear first (like WhatsApp)
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

let currentReactionMessageId = null;

function renderReactions(messageId, reactions) {
  var html = '<div class="message-reactions" data-message-id="' + messageId + '">';
  
  if (reactions && typeof reactions === 'object') {
    var entries = reactions instanceof Map ? Array.from(reactions.entries()) : Object.entries(reactions);
    
    entries.forEach(function(entry) {
      var emoji = entry[0];
      var users = entry[1];
      var count = Array.isArray(users) ? users.length : (typeof users === 'number' ? users : 0);
      
      if (count > 0) {
        var hasReacted = Array.isArray(users) && currentUser && users.includes(currentUser._id);
        html += '<button class="reaction-chip' + (hasReacted ? ' reacted' : '') + '" onclick="toggleReaction(\'' + messageId + '\', \'' + emoji + '\')">';
        html += '<span class="reaction-emoji">' + emoji + '</span>';
        html += '<span class="reaction-count">' + count + '</span>';
        html += '</button>';
      }
    });
  }
  
  html += '</div>';
  return html;
}

function updateMessageReactions(messageId, reactions) {
  var container = document.querySelector('.message-reactions[data-message-id="' + messageId + '"]');
  if (container) {
    var newHTML = renderReactions(messageId, reactions);
    var temp = document.createElement('div');
    temp.innerHTML = newHTML;
    container.replaceWith(temp.firstChild);
  }
}

function showReactionPicker(event, messageId) {
  event.stopPropagation();
  closeReactionPicker();
  currentReactionMessageId = messageId;

  var picker = document.createElement('div');
  picker.className = 'reaction-picker';
  picker.id = 'reaction-picker';

  var quickRow = document.createElement('div');
  quickRow.className = 'quick-reactions';
  quickRow.style.display = 'flex';
  quickRow.style.gap = '2px';
  
  QUICK_REACTIONS.forEach(function(emoji) {
    var btn = document.createElement('button');
    btn.className = 'reaction-picker-btn';
    btn.textContent = emoji;
    btn.onclick = function(e) {
      e.stopPropagation();
      closeReactionPicker();
      toggleReaction(messageId, emoji);
    };
    quickRow.appendChild(btn);
  });

  // Add "+" button for full picker
  var plusBtn = document.createElement('button');
  plusBtn.className = 'reaction-picker-btn';
  plusBtn.innerHTML = '<span style="font-size:20px;color:#8696a0;">+</span>';
  plusBtn.onclick = function(e) {
    e.stopPropagation();
    closeReactionPicker();
    showFullEmojiPicker(messageId);
  };
  quickRow.appendChild(plusBtn);

  picker.appendChild(quickRow);

  // Position near the button
  var btn = event.target.closest('.reaction-btn');
  var rect = btn.getBoundingClientRect();
  picker.style.position = 'fixed';
  picker.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
  picker.style.left = Math.max(10, rect.left - 100) + 'px';

  document.body.appendChild(picker);
  activeReactionPicker = picker;
}

// Full emoji picker using emoji-picker-element library
function showFullEmojiPicker(messageId) {
  var overlay = document.createElement('div');
  overlay.className = 'emoji-picker-overlay';
  overlay.id = 'emoji-picker-overlay';
  overlay.onclick = function(e) {
    if (e.target === overlay) {
      overlay.remove();
    }
  };

  var wrapper = document.createElement('div');
  wrapper.className = 'emoji-picker-wrapper';
  wrapper.onclick = function(e) { e.stopPropagation(); };

  // Use the emoji-picker-element web component
  var picker = document.createElement('emoji-picker');
  picker.addEventListener('emoji-click', function(event) {
    overlay.remove();
    toggleReaction(messageId, event.detail.unicode);
  });

  wrapper.appendChild(picker);
  overlay.appendChild(wrapper);
  document.body.appendChild(overlay);
}

function closeReactionPicker() {
  if (activeReactionPicker) {
    activeReactionPicker.remove();
    activeReactionPicker = null;
  }
}

async function toggleReaction(messageId, emoji) {
  try {
    var response = await fetch('/api/messages/' + messageId + '/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ emoji: emoji })
    });

    if (!response.ok) {
      var e = await response.json();
      throw new Error(e.message || 'Failed');
    }

    var result = await response.json();
    if (result.success) {
      updateMessageReactions(messageId, result.reactions);
    }
  } catch (error) {
    console.error('Reaction error:', error);
  }
}

window.showReactionPicker = showReactionPicker;
window.toggleReaction = toggleReaction;
window.showFullEmojiPicker = showFullEmojiPicker;

// ========================================
// AVATAR & UTILITY FUNCTIONS
// ========================================

function generateAvatarHTML(displayName, isLecturer, avatarUrl) {
  if (avatarUrl) {
    var border = isLecturer ? 'border:2px solid #667eea;' : '';
    return '<img src="' + avatarUrl + '" class="message-avatar ' + (isLecturer ? 'lecturer-avatar' : '') + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;' + border + '">';
  }
  var initials = getAvatarInitials(displayName);
  var bgColor = generateColorFromName(displayName);
  var border = isLecturer ? 'border:2px solid #667eea;' : '';
  return '<div class="message-avatar ' + (isLecturer ? 'lecturer-avatar' : '') + '" style="width:40px;height:40px;border-radius:50%;background-color:' + bgColor + ';display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;flex-shrink:0;' + border + '">' + initials + '</div>';
}

function getAvatarInitials(name) {
  if (!name) return '??';
  var parts = name.trim().split(' ').filter(function (p) { return p.length > 0; });
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function generateColorFromName(name) {
  var colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
  var hash = 0;
  for (var i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

window.deleteMessage = async function (messageId) {
  if (!confirm('Delete this message permanently?')) return;
  try {
    var response = await fetch('/api/messages/' + messageId, { method: 'DELETE', credentials: 'include' });
    if (!response.ok) { var e = await response.json(); throw new Error(e.message || 'Failed'); }
    var el = document.querySelector('[data-message-id="' + messageId + '"]');
    if (el) { el.style.transition = 'opacity 0.3s'; el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 300); }
  } catch (error) { alert('Failed: ' + error.message); }
};

window.editMessage = async function (messageId) {
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

window.reportMessage = async function (messageId) {
  var reason = prompt('Why are you reporting this? (Optional)');
  if (reason === null) return;
  try {
    var response = await fetch('/api/messages/' + messageId + '/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ reason: reason || 'Violation' }) });
    if (!response.ok) { var e = await response.json(); throw new Error(e.message || 'Failed'); }
    alert('Reported');
  } catch (error) { alert('Failed: ' + error.message); }
};

window.unreportMessage = async function (messageId) {
  if (!confirm('Remove report?')) return;
  try {
    var response = await fetch('/api/messages/' + messageId + '/report', { method: 'DELETE', credentials: 'include' });
    if (!response.ok) { var e = await response.json(); throw new Error(e.message || 'Failed'); }
    alert('Removed');
  } catch (error) { alert('Failed: ' + error.message); }
};

window.togglePin = async function (messageId) {
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
  // Clear filter first if active
  if (typeof clearPinnedFilter === 'function' && typeof isFilteringPinned !== 'undefined' && isFilteringPinned) {
    clearPinnedFilter();
  }
  
  var el = document.querySelector('[data-message-id="' + messageId + '"]');
  if (el) { 
    el.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
    el.classList.add('message-highlighted'); 
    el.style.transition = 'background 0.3s';
    el.style.background = 'rgba(0, 168, 132, 0.3)';
    setTimeout(function () { 
      el.classList.remove('message-highlighted'); 
      el.style.background = '';
    }, 2000); 
  }
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
function getTypeIcon(type) { return { 'NONE': '📝', 'QUESTION': '❓', 'COMMENT': '💬', 'CONFUSION': '❗' }[type] || '📝'; }
function scrollToBottom() { 
  var container = document.getElementById('messages-container'); 
  if (container) {
    requestAnimationFrame(function() {
      setTimeout(function() {
        container.scrollTop = container.scrollHeight + 1000;
      }, 10);
    });
  }
}

window.setReplyTo = setReplyTo;
window.cancelReply = cancelReply;
window.scrollToMessage = scrollToMessage;
window.toggleOptionsMenu = toggleOptionsMenu;

document.addEventListener('DOMContentLoaded', function () {
  console.log('📄 DOM ready, calling init()');
  init();
});