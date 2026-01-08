let socket;
let currentUser = null;
let currentSession = null;

// FIXED: Proper URL parameter extraction
function getUrlParameter(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Get session ID from URL
const sessionId = getUrlParameter('sessionId');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 CHAT ROOM DEBUG:');
console.log('URL:', window.location.href);
console.log('Session ID:', sessionId);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Validate session ID
if (!sessionId || sessionId.length !== 24) {
  alert('❌ Invalid session ID. Redirecting to dashboard...');
  window.location.href = '/student-dashboard.html';
  throw new Error('Invalid session ID');
}

console.log('✅ Valid Session ID:', sessionId);

// Initialize
async function init() {
  try {
    console.log('🚀 Starting initialization...');
    
    // Check authentication
    const authResponse = await fetch('/api/auth/me', {
      credentials: 'include'
    });
    
    console.log('Auth response status:', authResponse.status);
    
    if (!authResponse.ok) {
      throw new Error('Authentication failed');
    }
    
    const authResult = await authResponse.json();
    console.log('Auth result:', authResult);
    
    if (!authResult.success) {
      console.error('❌ Auth not successful');
      window.location.href = '/login.html';
      return;
    }
    
    currentUser = authResult.user;
    console.log('✅ Authenticated as:', currentUser.displayName, `(${currentUser.role})`);
    document.getElementById('user-name').textContent = currentUser.displayName;
    
    // Load session details
    await loadSession();
    
    // Initialize Socket.IO
    initializeSocket();
    
    // Load existing messages
    await loadMessages();
    
    console.log('✅ Initialization complete!');
    
  } catch (error) {
    console.error('❌ Init error:', error);
    removeLoadingSpinner();
    showError('Failed to load chat: ' + error.message);
    
    // Redirect after showing error
    setTimeout(() => {
      if (currentUser && currentUser.role === 'lecturer') {
        window.location.href = '/lecturer-dashboard.html';
      } else {
        window.location.href = '/student-dashboard.html';
      }
    }, 3000);
  }
}

// Load session details
async function loadSession() {
  try {
    console.log('📡 Loading session:', sessionId);
    
    const response = await fetch(`/api/sessions/${sessionId}`, {
      credentials: 'include'
    });
    
    console.log('Session response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Session not found (HTTP ${response.status})`);
    }
    
    const result = await response.json();
    console.log('Session result:', result);
    
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

// Initialize Socket.IO
function initializeSocket() {
  console.log('🔌 Initializing Socket.IO...');
  
  socket = io({
    transports: ['websocket', 'polling']
  });
  
  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id);
    socket.emit('join_session', {
      sessionId: sessionId,
      userId: currentUser._id,
      username: currentUser.displayName,
      userRole: currentUser.role
    });
  });
  
  socket.on('receive_message', (message) => {
    console.log('📨 Received message:', message);
    appendMessage(message);
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected');
  });
  
  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
  
  socket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error);
  });
}

// ✅ FIXED: Load existing messages with better error handling
async function loadMessages() {
  try {
    console.log('📥 Loading messages for session:', sessionId);
    
    const response = await fetch(`/api/messages/session/${sessionId}`, {
      credentials: 'include'
    });
    
    console.log('Messages response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Failed to load messages (HTTP ${response.status})`);
    }
    
    const result = await response.json();
    console.log('Messages result:', result);
    
    // ✅ ALWAYS remove loading spinner, even if there are no messages
    removeLoadingSpinner();
    
    if (result.success && result.messages && result.messages.length > 0) {
      console.log(`✅ Loaded ${result.messages.length} messages`);
      result.messages.forEach(msg => {
        appendMessage({
          username: msg.userId?.displayName || 'Anonymous',
          userRole: msg.userId?.role || 'student',
          text: msg.text,
          type: msg.type,
          timestamp: msg.createdAt
        });
      });
      scrollToBottom();
    } else {
      console.log('ℹ️ No messages yet in this session');
      showEmptyState();
    }
    
  } catch (error) {
    console.error('❌ Load messages error:', error);
    removeLoadingSpinner();
    showError('Failed to load messages: ' + error.message);
  }
}

// ✅ Helper: Remove loading spinner safely
function removeLoadingSpinner() {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.remove();
    console.log('🗑️ Loading spinner removed');
  }
}

// ✅ Helper: Show empty state
function showEmptyState() {
  const container = document.getElementById('messages-container');
  const emptyDiv = document.createElement('div');
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

// ✅ Helper: Show error message
function showError(message) {
  const container = document.getElementById('messages-container');
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    text-align: center;
    padding: 60px 20px;
    color: var(--danger-color);
  `;
  errorDiv.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
    <h3 style="margin-bottom: 8px;">Error Loading Chat</h3>
    <p style="font-size: 14px; color: var(--text-secondary);">${message}</p>
    <p style="font-size: 12px; color: var(--text-secondary); margin-top: 16px;">Redirecting to dashboard...</p>
  `;
  container.appendChild(errorDiv);
}

// ✅ ENHANCED: Append message to chat - FIXED FOR DARK MODE
function appendMessage(message) {
  const container = document.getElementById('messages-container');
  const messageDiv = document.createElement('div');
  
  // Determine if message is from lecturer
  const isLecturer = message.userRole === 'lecturer';
  const isOwnMessage = currentUser && message.username === currentUser.displayName;
  
  // Add classes based on role
  messageDiv.className = `chat-message ${isLecturer ? 'lecturer-message' : 'student-message'}`;
  
  // Build username badge with proper class
  const usernameClass = isLecturer ? 'lecturer' : 'student';
  const userIcon = isLecturer ? '👨‍🏫' : '👤';
  
  messageDiv.innerHTML = `
    <div class="message-header">
      <span class="message-username ${usernameClass}">
        ${userIcon} ${escapeHtml(message.username)}${isOwnMessage ? ' (You)' : ''}
      </span>
      <span class="message-time">${formatTime(message.timestamp || new Date())}</span>
    </div>
    <div class="message-text">${escapeHtml(message.text)}</div>
    <span class="message-badge badge-${(message.type || 'COMMENT').toLowerCase()}">
      ${getTypeIcon(message.type || 'COMMENT')} ${message.type || 'COMMENT'}
    </span>
  `;
  
  container.appendChild(messageDiv);
  scrollToBottom();
}

// Send message
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('message-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  const input = document.getElementById('message-input');
  const typeSelect = document.getElementById('message-type');
  const text = input.value.trim();
  
  if (!text) return;
  
  const messageData = {
    sessionId: sessionId,
    text: text,
    type: typeSelect.value,
    username: currentUser.displayName,
    userRole: currentUser.role
  };
  
  console.log('📤 Sending message:', messageData);
  
  try {
    // Send via Socket.IO
    socket.emit('send_message', messageData);
    
    // Also save to database via API
    const response = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(messageData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    
    console.log('✅ Message sent successfully');
    
    // Clear input
    input.value = '';
    input.focus();
    
  } catch (error) {
    console.error('❌ Send message error:', error);
    alert('Failed to send message. Please try again.');
  }
}

// Helper functions
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
  container.scrollTop = container.scrollHeight;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM Content Loaded - Starting init...');
  init();
});