// COMPLETE FIXED student-chat.js - ALL BUGS RESOLVED
// - Real-time updates working
// - Lecturer messages show NO badge (unless announcement/pinned)
// - Announcement = RED with top label
// - Pinned messages stay visible

let socket = null;
let currentUser = null;
let currentSession = null;
let sessionId = null;
let replyingTo = null;

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
    initializeSocket(); // Initialize socket BEFORE loading messages
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

// Initialize Socket.IO - FIXED FOR REAL-TIME UPDATES
function initializeSocket() {
  console.log('🔌 Initializing Socket.IO...');
  
  socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });
  
  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id);
    
    // Add small delay to ensure socket is fully ready
    setTimeout(() => {
      console.log('📡 Emitting join-session...');
      socket.emit('join-session', {
        sessionId: sessionId,
        userId: currentUser._id,
        displayName: currentUser.displayName,
        role: currentUser.role
      });
    }, 100); // 100ms delay ensures socket is ready
  });
  
  socket.on('joined-session', (data) => {
    console.log('✅ Successfully joined session:', data);
    console.log('🎯 NOW IN ROOM - Will receive messages!');
  });
  

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
      isAnnouncement: message.isAnnouncement
    };
    
    console.log('📨 Formatted message:', formattedMessage);
    appendMessage(formattedMessage);
    scrollToBottom();
  });
  
  socket.on('user-joined', (data) => {
    console.log('👋 User joined:', data.displayName);
  });
  
  socket.on('user-left', (data) => {
    console.log('👋 User left:', data.displayName);
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected');
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
          isAnnouncement: msg.isAnnouncement
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
    // STUDENT UI - Keep as is but ensure reply indicator
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

// Send message - FIXED to not send via Socket.IO, let server broadcast
async function sendMessage() {
  const input = document.getElementById('message-input');
  
  if (!input) {
    console.error('Input element not found');
    return;
  }
  
  const text = input.value.trim();
  
  if (!text) return;
  
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
      
      // Message will appear via Socket.IO broadcast, no need to append manually
      
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
      
      // Message will appear via Socket.IO broadcast
      
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
  
  // Remove empty state if exists
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
  
  messageDiv.className = messageClasses;
  messageDiv.dataset.messageId = message.id || message._id;
  
  const userIcon = isLecturer ? '👨‍🏫' : '👤';
  
  // Announcement top label
  let announcementLabelHTML = '';
  if (message.isAnnouncement) {
    announcementLabelHTML = '<div class="announcement-label">📢 IMPORTANT ANNOUNCEMENT</div>';
  }
  
  // Badge logic - CRITICAL: No badge for lecturers unless announcement/pinned
  let badgeHTML = '';
  if (message.isAnnouncement) {
    badgeHTML = '<span class="message-badge badge-announcement">📢 ANNOUNCEMENT</span>';
  } else if (message.isPinned) {
    badgeHTML = '<span class="message-badge badge-pinned">📌 PINNED</span>';
  } else if (!isLecturer) {
    // Only students show type badge
    badgeHTML = `<span class="message-badge badge-${(message.type || 'COMMENT').toLowerCase()}">${getTypeIcon(message.type || 'COMMENT')} ${message.type || 'COMMENT'}</span>`;
  }
  
  messageDiv.innerHTML = `
    ${announcementLabelHTML}
    <div class="message-header">
      <span class="message-username">
        ${userIcon} ${escapeHtml(message.username)}${isOwnMessage ? ' (You)' : ''}
      </span>
      <span class="message-time">${formatTime(message.timestamp || message.createdAt || new Date())}</span>
    </div>
    <div class="message-text">${escapeHtml(message.text)}</div>
    <div class="message-footer">
      ${badgeHTML}
      <button class="reply-btn" onclick="setReplyTo('${message.id || message._id}', '${escapeHtml(message.username)}', '${escapeHtml(message.text).replace(/'/g, "&#39;")}')">
        Reply
      </button>
    </div>
  `;
  
  container.appendChild(messageDiv);
  console.log('✅ Message appended to DOM');
  
  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

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