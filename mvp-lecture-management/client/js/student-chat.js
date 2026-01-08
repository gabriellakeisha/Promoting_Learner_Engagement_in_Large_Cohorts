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
    // Check authentication
    const authResponse = await fetch('/api/auth/me', {
      credentials: 'include'
    });
    const authResult = await authResponse.json();
    
    if (!authResult.success) {
      window.location.href = '/login.html';
      return;
    }
    
    currentUser = authResult.user;
    document.getElementById('user-name').textContent = currentUser.displayName;
    
    // Load session details
    await loadSession();
    
    // Initialize Socket.IO
    initializeSocket();
    
    // Load existing messages
    await loadMessages();
    
  } catch (error) {
    console.error('Init error:', error);
    alert('Error loading chat. Please try again.');
    window.location.href = '/student-dashboard.html';
  }
}

// Load session details
async function loadSession() {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`, {
      credentials: 'include'
    });
    const result = await response.json();
    
    if (result.success && result.session) {
      currentSession = result.session;
      document.getElementById('session-title').textContent = result.session.title;
      document.getElementById('session-info').textContent = 
        `${result.session.moduleCode || 'No module'} • Join Code: ${result.session.joinCode}`;
    } else {
      throw new Error('Session not found');
    }
  } catch (error) {
    console.error('Load session error:', error);
    alert('Session not found. Redirecting...');
    window.location.href = '/student-dashboard.html';
  }
}

// Initialize Socket.IO
function initializeSocket() {
  socket = io({
    transports: ['websocket', 'polling']
  });
  
  socket.on('connect', () => {
    console.log('✅ Socket connected');
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
    console.error('Socket error:', error);
  });
}

// Load existing messages
async function loadMessages() {
  try {
    const response = await fetch(`/api/messages/session/${sessionId}`, {
      credentials: 'include'
    });
    const result = await response.json();
    
    // Remove loading spinner
    document.getElementById('loading').remove();
    
    if (result.success && result.messages) {
      result.messages.forEach(msg => {
        appendMessage({
          username: msg.userId?.displayName || 'Anonymous',
          userRole: msg.userId?.role || 'student',
          text: msg.text,
          type: msg.type,
          timestamp: msg.createdAt
        });
      });
      
      // Scroll to bottom
      scrollToBottom();
    }
  } catch (error) {
    console.error('Load messages error:', error);
  }
}

// Append message to chat
function appendMessage(message) {
  const container = document.getElementById('messages-container');
  const messageDiv = document.createElement('div');
  
  // Determine if message is from lecturer
  const isLecturer = message.userRole === 'lecturer';
  const isOwnMessage = message.username === currentUser.displayName;
  
  // Add classes based on role
  messageDiv.className = `chat-message ${isLecturer ? 'lecturer-message' : 'student-message'}`;
  
  messageDiv.innerHTML = `
    <div class="message-header">
      <span class="message-username ${isLecturer ? 'lecturer' : 'student'}">
        ${isLecturer ? '👨‍🏫 ' : '👤 '}${escapeHtml(message.username)}
        ${isOwnMessage ? ' (You)' : ''}
      </span>
      <span class="message-time">${formatTime(message.timestamp)}</span>
    </div>
    <div class="message-text">${escapeHtml(message.text)}</div>
    <span class="message-badge badge-${message.type.toLowerCase()}">
      ${getTypeIcon(message.type)} ${message.type}
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
  
  try {
    // Send via Socket.IO
    socket.emit('send_message', messageData);
    
    // Also save to database via API
    await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(messageData)
    });
    
    // Clear input
    input.value = '';
    input.focus();
    
  } catch (error) {
    console.error('Send message error:', error);
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
document.addEventListener('DOMContentLoaded', init);