let socket = null;
let currentUser = null;
let currentSession = null;
let sessionId = null;
let replyingTo = null;
let socketJoined = false;

console.log('✅ student-chat.js loading...');

// Extract session ID from URL
function getSessionIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('sessionId');
}

// Check authentication
async function checkAuth() {
  try {
    console.log('🔐 Checking authentication...');
    
    const authResponse = await fetch('/api/auth/me', {
      credentials: 'include'
    });
    
    if (!authResponse.ok) {
      console.error('❌ Auth failed, redirecting to login');
      window.location.href = '/login.html';
      return false;
    }
    
    const authResult = await authResponse.json();
    
    if (!authResult.success) {
      window.location.href = '/login.html';
      return false;
    }
    
    currentUser = authResult.user;
    console.log('✅ Authenticated as:', currentUser.displayName, `(${currentUser.role})`);
    
    document.getElementById('user-name').textContent = currentUser.displayName;
    
    return true;
    
  } catch (error) {
    console.error('💥 Auth check error:', error);
    window.location.href = '/login.html';
    return false;
  }
}

// Main initialization
async function init() {
  try {
    console.log('🚀 Chat initialization starting...');
    
    sessionId = getSessionIdFromURL();
    console.log('📍 Session ID:', sessionId);
    
    if (!sessionId || sessionId.length !== 24) {
      console.error('❌ Invalid session ID');
      alert('Invalid session ID');
      redirectToDashboard();
      return;
    }

    console.log('✅ Valid session ID confirmed');
    
    const authOk = await checkAuth();
    if (!authOk) return;
    
    await loadSession();
    initializeSocket(); // Initialize socket AFTER we have user and session data
    await loadMessages();
    setupInputArea();
    
    console.log('✅ Initialization complete!');
    
  } catch (error) {
    console.error('❌ Init error:', error);
    removeLoadingSpinner();
    showError('Failed to load chat: ' + error.message);
    
    setTimeout(() => {
      redirectToDashboard();
    }, 3000);
  }
}

// Redirect to appropriate dashboard
function redirectToDashboard() {
  if (currentUser && currentUser.role === 'lecturer') {
    window.location.href = '/lecturer-dashboard.html';
  } else {
    window.location.href = '/student-dashboard.html';
  }
}

// Load session details
async function loadSession() {
  try {
    console.log('📡 Loading session:', sessionId);
    
    const response = await fetch(`/api/sessions/${sessionId}`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Session not found (HTTP ${response.status})`);
    }
    
    const result = await response.json();
    
    if (result.success && result.session) {
      currentSession = result.session;
      console.log('✅ Session loaded:', currentSession.title);
      
      document.getElementById('session-title').textContent = result.session.title;
      document.getElementById('session-info').textContent = 
        `${result.session.moduleCode || 'No module'} • Join Code: ${result.session.joinCode}`;
    } else {
      throw new Error('Session data is invalid');
    }
  } catch (error) {
    console.error('❌ Load session error:', error);
    throw new Error('Cannot load session: ' + error.message);
  }
}

// Initialize Socket.IO - FIXED FOR TIMING ISSUE
function initializeSocket() {
  console.log('🔌 Initializing Socket.IO...');
  console.log('🔌 Session ID:', sessionId);
  console.log('🔌 User:', currentUser?.displayName);
  
  socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    forceNew: false
  });
  
  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id);
    console.log('📡 Socket ready, joining session...');
    
    // Check if we have all required data
    if (!sessionId) {
      console.error('❌ Cannot join: sessionId is null!');
      return;
    }
    
    if (!currentUser) {
      console.error('❌ Cannot join: currentUser is null!');
      return;
    }
    
    console.log('📡 Emitting join-session with:', {
      sessionId,
      userId: currentUser._id,
      displayName: currentUser.displayName,
      role: currentUser.role
    });
    
    socket.emit('join-session', {
      sessionId: sessionId,
      userId: currentUser._id,
      displayName: currentUser.displayName,
      role: currentUser.role
    });
  });
  
  socket.on('joined-session', (data) => {
    console.log('✅ ✅ ✅ SUCCESSFULLY JOINED SESSION! ✅ ✅ ✅');
    console.log('✅ Room joined:', data);
    console.log('✅ NOW will receive real-time messages!');
    socketJoined = true;
  });
  
  // Real-time message reception
  socket.on('new-message', (message) => {
    console.log('📨 NEW MESSAGE RECEIVED via Socket.IO:', message);
    
    // Format message properly
    const formattedMessage = {
      id: message.id || message._id,
      username: message.user?.displayName || message.username,
      userRole: message.user?.role || message.userRole,
      text: message.text,
      type: message.type,
      timestamp: message.timestamp || message.createdAt,
      replyTo: message.replyTo,
      isPinned: message.isPinned,
      isAnnouncement: message.isAnnouncement,
      isReported: message.isReported
    };
    
    console.log('📨 Formatted message:', formattedMessage);
    appendMessage(formattedMessage);
    scrollToBottom();
    console.log('✅ Message added to UI');
  });
  
  // Delete message event
  socket.on('message-deleted', (data) => {
    console.log('🗑️ Message deleted:', data.messageId);
    
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
      messageElement.style.transition = 'opacity 0.3s ease';
      messageElement.style.opacity = '0';
      setTimeout(() => {
        messageElement.remove();
      }, 300);
    }
  });
  
  // Message reported/unreported event
  socket.on('message-reported', (data) => {
    console.log('🚩 Message report status changed:', data);
    
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
      if (data.isReported) {
        // Add reported styling
        messageElement.classList.add('reported-message');
        
        // Add reported badge if not exists
        const footer = messageElement.querySelector('.message-footer');
        if (footer && !footer.querySelector('.badge-reported')) {
          const reportedBadge = document.createElement('span');
          reportedBadge.className = 'message-badge badge-reported';
          reportedBadge.innerHTML = '🚩 REPORTED';
          footer.insertBefore(reportedBadge, footer.firstChild);
        }
        
        // Update report button
        const reportBtn = messageElement.querySelector('.report-btn');
        if (reportBtn) {
          reportBtn.textContent = 'Unreport';
          reportBtn.classList.add('reported');
        }
      } else {
        // Remove reported styling
        messageElement.classList.remove('reported-message');
        
        // Remove reported badge
        const reportedBadge = messageElement.querySelector('.badge-reported');
        if (reportedBadge) {
          reportedBadge.remove();
        }
        
        // Update report button
        const reportBtn = messageElement.querySelector('.report-btn');
        if (reportBtn) {
          reportBtn.textContent = '🚩 Report';
          reportBtn.classList.remove('reported');
        }
      }
    }
  });
  
  socket.on('user-joined', (data) => {
    console.log('👋 User joined:', data.displayName);
  });
  
  socket.on('user-left', (data) => {
    console.log('👋 User left:', data.displayName);
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected');
    socketJoined = false;
  });
  
  socket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error);
  });
  
  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
}

// Load existing messages
async function loadMessages() {
  try {
    console.log('📥 Loading messages...');
    showLoadingSpinner();
    
    const response = await fetch(`/api/messages/session/${sessionId}`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load messages (HTTP ${response.status})`);
    }
    
    const result = await response.json();
    console.log('📦 Messages loaded:', result.messages?.length || 0);
    
    removeLoadingSpinner();
    
    if (result.success && result.messages && result.messages.length > 0) {
      result.messages.forEach(msg => {
        appendMessage({
          id: msg.id,
          username: msg.userId?.displayName || 'Anonymous',
          userRole: msg.userId?.role || 'student',
          text: msg.text,
          type: msg.type,
          timestamp: msg.createdAt || msg.timestamp,
          replyTo: msg.replyTo,
          isPinned: msg.isPinned,
          isAnnouncement: msg.isAnnouncement,
          isReported: msg.isReported
        });
      });
      scrollToBottom();
    } else {
      console.log('ℹ️ No messages yet');
      showEmptyState();
    }
    
  } catch (error) {
    console.error('❌ Load messages error:', error);
    removeLoadingSpinner();
    showError('Failed to load messages: ' + error.message);
  }
}

// Setup input area based on user role
function setupInputArea() {
  const inputContainer = document.querySelector('.chat-input-container');
  
  if (currentUser.role === 'lecturer') {
    // LECTURER UI
    inputContainer.innerHTML = `
      <div id="reply-indicator" class="reply-indicator-container" style="display: none;"></div>
      
      <div class="chat-input-wrapper">
        <textarea 
          id="message-input" 
          class="chat-input" 
          placeholder="Type your message to students..."
          rows="3"
          maxlength="2000"
        ></textarea>
        <button id="send-btn" class="send-btn-corner">➤</button>
      </div>
      
      <div class="lecturer-options">
        <label class="checkbox-option">
          <input type="checkbox" id="is-announcement">
          <span>📢 Announcement</span>
        </label>
        
        <label class="checkbox-option">
          <input type="checkbox" id="pin-message">
          <span>📌 Pin message</span>
        </label>
        
        <label class="checkbox-option">
          <input type="checkbox" id="is-respond">
          <span>💬 Response</span>
        </label>
      </div>
    `;
  } else {
    // STUDENT UI
    let replyIndicator = document.getElementById('reply-indicator');
    if (!replyIndicator) {
      replyIndicator = document.createElement('div');
      replyIndicator.id = 'reply-indicator';
      replyIndicator.className = 'reply-indicator-container';
      replyIndicator.style.display = 'none';
      inputContainer.insertBefore(replyIndicator, inputContainer.firstChild);
    }
  }
  
  // Attach event listeners
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }
  
  const input = document.getElementById('message-input');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
}

// Send message
async function sendMessage() {
  const input = document.getElementById('message-input');
  
  if (!input) {
    console.error('Input element not found');
    return;
  }
  
  const text = input.value.trim();
  
  if (!text) return;
  
  // Check if we're in the room
  if (!socketJoined) {
    console.warn('⚠️ Not in room yet, attempting to rejoin...');
    socket.emit('join-session', {
      sessionId: sessionId,
      userId: currentUser._id,
      displayName: currentUser.displayName,
      role: currentUser.role
    });
  }
  
  let messageData;
  
  if (currentUser.role === 'lecturer') {
    // Lecturer message
    const isAnnouncement = document.getElementById('is-announcement')?.checked || false;
    const shouldPin = document.getElementById('pin-message')?.checked || false;
    
    messageData = {
      sessionId: sessionId,
      text: text,
      type: 'COMMENT',
      replyTo: replyingTo ? replyingTo.id : null,
      isAnnouncement: isAnnouncement
    };
    
    console.log('📤 Sending lecturer message:', messageData);
    
    try {
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(messageData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send message');
      }
      
      const result = await response.json();
      console.log('✅ Message sent via API:', result);
      
      // If should pin, pin the message
      if (shouldPin && result.messageData && result.messageData.id) {
        await fetch(`/api/messages/${result.messageData.id}/pin`, {
          method: 'POST',
          credentials: 'include'
        });
      }
      
      // Clear input and reset checkboxes
      input.value = '';
      const announceCheckbox = document.getElementById('is-announcement');
      const pinCheckbox = document.getElementById('pin-message');
      const respondCheckbox = document.getElementById('is-respond');
      
      if (announceCheckbox) announceCheckbox.checked = false;
      if (pinCheckbox) pinCheckbox.checked = false;
      if (respondCheckbox) respondCheckbox.checked = false;
      
      cancelReply();
      input.focus();
      
      console.log('⏳ Waiting for Socket.IO broadcast...');
      
    } catch (error) {
      console.error('💥 Send message error:', error);
      alert('Failed to send message: ' + error.message);
    }
    
  } else {
    // Student message
    const typeSelect = document.getElementById('message-type');
    
    messageData = {
      sessionId: sessionId,
      text: text,
      type: typeSelect ? typeSelect.value : 'COMMENT',
      replyTo: replyingTo ? replyingTo.id : null
    };
    
    console.log('📤 Sending student message:', messageData);
    
    try {
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(messageData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send message');
      }
      
      console.log('✅ Message sent via API');
      
      input.value = '';
      cancelReply();
      input.focus();
      
      console.log('⏳ Waiting for Socket.IO broadcast...');
      
    } catch (error) {
      console.error('💥 Send message error:', error);
      alert('Failed to send message: ' + error.message);
    }
  }
}

// Append message to chat
function appendMessage(message) {
  console.log('🔵 appendMessage called with:', message);
  
  const container = document.getElementById('messages-container');
  if (!container) {
    console.error('❌ messages-container NOT FOUND!');
    return;
  }
  
  const emptyState = container.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }
  
  const messageDiv = document.createElement('div');
  
  const isLecturer = message.userRole === 'lecturer';
  const isOwnMessage = currentUser && message.username === currentUser.displayName;
  
  let messageClasses = `chat-message ${isLecturer ? 'lecturer-message' : 'student-message'}`;
  
  if (message.isAnnouncement) {
    messageClasses += ' announcement';
  }
  
  if (message.isPinned) {
    messageClasses += ' pinned';
  }
  
  if (message.isReported) {
    messageClasses += ' reported-message';
  }
  
  messageDiv.className = messageClasses;
  messageDiv.dataset.messageId = message.id || message._id;
  
  // ========================================
  // AVATAR GENERATION
  // ========================================
  const displayName = message.username || 'Anonymous';
  const avatar = message.avatar; // If available from server
  const avatarHTML = generateAvatarHTML(avatar, displayName, isLecturer);
  
  // ========================================
  // LECTURER BADGE (as requested by supervisor!)
  // ========================================
  const lecturerBadge = isLecturer ? 
    '<span class="lecturer-badge-inline">👨‍🏫 Lecturer</span>' : '';
  
  // Reply context
  let replyHTML = '';
  if (message.replyTo) {
    const replyUsername = message.replyTo.user?.displayName || message.replyTo.userId?.displayName || 'Unknown';
    const replyText = message.replyTo.text.length > 50 
      ? message.replyTo.text.substring(0, 50) + '...' 
      : message.replyTo.text;
    replyHTML = `
      <div class="reply-context" onclick="scrollToMessage('${message.replyTo._id || message.replyTo.id}')">
        <span class="reply-icon">↩️</span>
        <span class="reply-to-user">${escapeHtml(replyUsername)}</span>
        <span class="reply-preview">${escapeHtml(replyText)}</span>
      </div>
    `;
  }
  
  // Message type badge
  const typeIcon = getTypeIcon(message.type);
  
  // Badges (pinned, announcement, reported)
  let badgeHTML = '';
  if (message.isPinned) {
    badgeHTML += '<span class="message-badge badge-pinned">📌 Pinned</span>';
  }
  if (message.isAnnouncement) {
    badgeHTML += '<span class="message-badge badge-announcement">📢 Announcement</span>';
  }
  if (message.isReported) {
    badgeHTML += '<span class="message-badge badge-reported">🚩 Reported</span>';
  }
  
  // Action buttons based on role
  let actionButtonsHTML = '';
  
  // Reply button (everyone can reply)
  actionButtonsHTML += `<button class="action-btn reply-btn" onclick="setReplyTo('${message.id || message._id}', '${escapeHtml(message.username)}', '${escapeHtml(message.text?.substring(0, 100) || '')}')" title="Reply">↩️ Reply</button>`;
  
  if (currentUser && currentUser.role === 'lecturer') {
    // Lecturer actions
    actionButtonsHTML += `<button class="action-btn pin-btn" onclick="togglePin('${message.id || message._id}')" title="${message.isPinned ? 'Unpin' : 'Pin'}">${message.isPinned ? '📌 Unpin' : '📍 Pin'}</button>`;
    
    if (message.isReported) {
      actionButtonsHTML += `<button class="action-btn report-btn reported" onclick="unreportMessage('${message.id || message._id}')" title="Remove Report">✅ Unreport</button>`;
    } else {
      actionButtonsHTML += `<button class="action-btn report-btn" onclick="reportMessage('${message.id || message._id}')" title="Report">🚩 Report</button>`;
    }
    
    actionButtonsHTML += `<button class="action-btn delete-btn" onclick="deleteMessage('${message.id || message._id}')" title="Delete">🗑️ Delete</button>`;
  } else if (isOwnMessage) {
    // Own message actions (student can delete their own)
    actionButtonsHTML += `<button class="action-btn delete-btn" onclick="deleteMessage('${message.id || message._id}')" title="Delete">🗑️ Delete</button>`;
  }
  
  // ========================================
  // BUILD MESSAGE HTML WITH AVATAR
  // ========================================
  messageDiv.innerHTML = `
    <div class="message-avatar-wrapper">
      ${avatarHTML}
    </div>
    <div class="message-content-wrapper">
      <div class="message-header">
        <span class="message-username ${isLecturer ? 'lecturer' : 'student'}">
          ${escapeHtml(displayName)}${isOwnMessage ? ' (You)' : ''}
        </span>
        ${lecturerBadge}
        <span class="message-time">${formatTime(message.timestamp || message.createdAt || new Date())}</span>
      </div>
      ${replyHTML}
      <div class="message-body">
        <span class="message-type-indicator">${typeIcon}</span>
        <span class="message-text">${escapeHtml(message.text)}</span>
      </div>
      <div class="message-footer">
        ${badgeHTML}
        <div class="message-actions">
          ${actionButtonsHTML}
        </div>
      </div>
    </div>
  `;
  
  container.appendChild(messageDiv);
  console.log('✅ Message appended to DOM');
  
  container.scrollTop = container.scrollHeight;
}

// ========================================
// AVATAR GENERATION HELPER
// ========================================
function generateAvatarHTML(avatar, displayName, isLecturer) {
  const size = 40;
  const initials = getAvatarInitials(displayName);
  
  // If user has uploaded avatar
  if (avatar?.type === 'uploaded' && avatar.imageUrl) {
    return `
      <div class="message-avatar ${isLecturer ? 'lecturer-avatar' : ''}" style="width: ${size}px; height: ${size}px;">
        <img src="${avatar.imageUrl}" alt="${escapeHtml(displayName)}" 
             style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
      </div>
    `;
  }
  
  // Generated avatar with initials
  const bgColor = avatar?.backgroundColor || generateColorFromName(displayName);
  
  return `
    <div class="message-avatar ${isLecturer ? 'lecturer-avatar' : ''}" style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background-color: ${bgColor};
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 14px;
      flex-shrink: 0;
      ${isLecturer ? 'border: 2px solid #667eea;' : ''}
    ">${avatar?.initials || initials}</div>
  `;
}

// ========================================
// GET INITIALS FROM NAME
// ========================================
function getAvatarInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(' ').filter(p => p.length > 0);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// ========================================
// GENERATE CONSISTENT COLOR FROM NAME
// ========================================
function generateColorFromName(name) {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F1948A', '#82E0AA', '#F8B500', '#00CED1', '#FF69B4'
  ];
  
  // Generate consistent index from name
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// DELETE MESSAGE FUNCTIONALITY
window.deleteMessage = async function(messageId) {
  if (!confirm('Are you sure you want to permanently delete this message? This cannot be undone.')) {
    return;
  }
  
  try {
    console.log('🗑️ Deleting message:', messageId);
    
    const response = await fetch(`/api/messages/${messageId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete message');
    }
    
    console.log('✅ Message deleted successfully');
    
    // Remove from UI immediately (Socket.IO will also handle this)
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      messageElement.style.transition = 'opacity 0.3s ease';
      messageElement.style.opacity = '0';
      setTimeout(() => {
        messageElement.remove();
      }, 300);
    }
    
  } catch (error) {
    console.error('❌ Delete error:', error);
    alert('Failed to delete message: ' + error.message);
  }
};

// REPORT MESSAGE FUNCTIONALITY
window.reportMessage = async function(messageId) {
  const reason = prompt('Why are you reporting this message? (Optional)');
  
  // If user clicks cancel, don't report
  if (reason === null) {
    return;
  }
  
  try {
    console.log('🚩 Reporting message:', messageId);
    
    const response = await fetch(`/api/messages/${messageId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        reason: reason || 'Violation reported by lecturer'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to report message');
    }
    
    console.log('✅ Message reported successfully');
    alert('Message reported successfully');
    
  } catch (error) {
    console.error('❌ Report error:', error);
    alert('Failed to report message: ' + error.message);
  }
};

// UNREPORT MESSAGE FUNCTIONALITY
window.unreportMessage = async function(messageId) {
  if (!confirm('Remove the report flag from this message?')) {
    return;
  }
  
  try {
    console.log('✅ Unreporting message:', messageId);
    
    const response = await fetch(`/api/messages/${messageId}/report`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to unreport message');
    }
    
    console.log('✅ Message unreported successfully');
    alert('Report removed successfully');
    
  } catch (error) {
    console.error('❌ Unreport error:', error);
    alert('Failed to unreport message: ' + error.message);
  }
};

// Set reply target
function setReplyTo(messageId, username, text) {
  replyingTo = { id: messageId, username, text };
  
  let replyIndicator = document.getElementById('reply-indicator');
  if (!replyIndicator) {
    replyIndicator = createReplyIndicator();
  }
  
  const shortText = text.length > 60 ? text.substring(0, 60) + '...' : text;
  replyIndicator.innerHTML = `
    <div class="reply-indicator-content">
      <div>
        <div class="reply-indicator-label">Replying to <strong>${escapeHtml(username)}</strong></div>
        <div class="reply-indicator-text">${escapeHtml(shortText)}</div>
      </div>
      <button onclick="cancelReply()" class="reply-indicator-close">×</button>
    </div>
  `;
  replyIndicator.style.display = 'block';
  
  const input = document.getElementById('message-input');
  if (input) input.focus();
}

// Create reply indicator
function createReplyIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'reply-indicator';
  indicator.className = 'reply-indicator-container';
  
  const inputContainer = document.querySelector('.chat-input-container');
  if (inputContainer) {
    inputContainer.insertBefore(indicator, inputContainer.firstChild);
  }
  
  return indicator;
}

// Cancel reply
function cancelReply() {
  replyingTo = null;
  const indicator = document.getElementById('reply-indicator');
  if (indicator) {
    indicator.style.display = 'none';
  }
}

// Scroll to specific message
function scrollToMessage(messageId) {
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageEl) {
    messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    messageEl.classList.add('message-highlighted');
    setTimeout(() => {
      messageEl.classList.remove('message-highlighted');
    }, 2000);
  }
}

// Helper functions
function showLoadingSpinner() {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.style.display = 'flex';
  }
}

function removeLoadingSpinner() {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.style.display = 'none';
  }
}

function showEmptyState() {
  const container = document.getElementById('messages-container');
  const emptyDiv = document.createElement('div');
  emptyDiv.className = 'empty-state';
  emptyDiv.style.cssText = `
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary);
  `;
  emptyDiv.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">💬</div>
    <h3 style="margin-bottom: 8px; color: var(--text-primary);">No messages yet</h3>
    <p style="font-size: 14px;">Be the first to start the conversation!</p>
  `;
  container.appendChild(emptyDiv);
}

function showError(message) {
  const container = document.getElementById('messages-container');
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.style.cssText = `
    text-align: center;
    padding: 60px 20px;
    color: var(--danger-color);
  `;
  errorDiv.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
    <h3 style="margin-bottom: 8px;">Error Loading Chat</h3>
    <p style="font-size: 14px; color: var(--text-secondary);">${escapeHtml(message)}</p>
    <p style="font-size: 12px; color: var(--text-secondary); margin-top: 16px;">Redirecting to dashboard...</p>
  `;
  container.appendChild(errorDiv);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

function getTypeIcon(type) {
  const icons = {
    'QUESTION': '❓',
    'COMMENT': '💬',
    'CONFUSION': '❗'
  };
  return icons[type] || '💬';
}

function scrollToBottom() {
  const container = document.getElementById('messages-container');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

// Make functions available globally
window.setReplyTo = setReplyTo;
window.cancelReply = cancelReply;
window.scrollToMessage = scrollToMessage;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM loaded, calling init()');
  init();
});

console.log('✅ student-chat.js loaded successfully');