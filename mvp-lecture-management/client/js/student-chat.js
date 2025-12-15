let socket;
let currentUser;
let sessionId;
let messages = [];

// Get session ID from URL
const pathParts = window.location.pathname.split('/');
sessionId = pathParts[pathParts.length - 1];

// Initialize
async function init() {
  try {
    // Check authentication
    const authResponse = await fetch('/api/auth/me');
    const authResult = await authResponse.json();
    
    if (!authResult.success) {
      window.location.href = '/';
      return;
    }
    
    currentUser = authResult.user;
    document.getElementById('user-name').textContent = currentUser.displayName;
    
    // Load session details
    await loadSessionDetails();
    
    // Initialize Socket.IO
    initSocket();
    
    // Load messages
    await loadMessages();
    
  } catch (error) {
    console.error('Init error:', error);
    alert('Error loading chat. Redirecting...');
    window.location.href = '/student-dashboard';
  }
}

// Load session details
async function loadSessionDetails() {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`);
    const result = await response.json();
    
    if (result.success) {
      document.getElementById('session-title').textContent = result.session.title;
      document.getElementById('session-info').textContent = 
        `${result.session.moduleCode} • ${result.session.lecturer.name} • ${result.session.memberCount} members`;
    }
  } catch (error) {
    console.error('Error loading session:', error);
  }
}

// Initialize Socket.IO
function initSocket() {
  socket = io();
  
  socket.on('connect', () => {
    console.log('✅ Connected to server');
    
    // Join session room
    socket.emit('join-session', { sessionId });
  });
  
  socket.on('joined-session', (data) => {
    console.log('✅ Joined session:', data);
  });
  
  socket.on('new-message', (message) => {
    console.log('📨 New message:', message);
    addMessageToUI(message);
    scrollToBottom();
  });
  
  socket.on('user-joined', (data) => {
    showNotification(`${data.displayName} joined the session`);
  });
  
  socket.on('user-left', (data) => {
    showNotification(`${data.displayName} left the session`);
  });
  
  socket.on('error', (data) => {
    alert(data.message);
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
  });
}

// Load messages
async function loadMessages() {
  try {
    const response = await fetch(`/api/messages/${sessionId}?limit=50`);
    const result = await response.json();
    
    document.getElementById('loading').style.display = 'none';
    
    if (result.success) {
      messages = result.messages;
      displayMessages(messages);
      scrollToBottom();
    }
  } catch (error) {
    console.error('Error loading messages:', error);
    document.getElementById('loading').innerHTML = 
      '<p style="color: var(--danger-color);">Error loading messages</p>';
  }
}

// Display messages
function displayMessages(messages) {
  const container = document.getElementById('messages-container');
  container.innerHTML = messages.map(msg => createMessageHTML(msg)).join('');
}

// Add message to UI
function addMessageToUI(message) {
  const container = document.getElementById('messages-container');
  container.insertAdjacentHTML('beforeend', createMessageHTML(message));
}

// Create message HTML
function createMessageHTML(msg) {
  const time = new Date(msg.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return `
    <div class="message type-${msg.type.toLowerCase()}">
      <div class="message-header">
        <span class="message-author">${msg.user.displayName}</span>
        <span class="message-type type-badge-${msg.type.toLowerCase()}">
          ${msg.type}
        </span>
      </div>
      <div class="message-text">${escapeHtml(msg.text)}</div>
      <div class="message-time">${time}${msg.isEdited ? ' (edited)' : ''}</div>
    </div>
  `;
}

// Send message
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('message-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  const input = document.getElementById('message-input');
  const type = document.getElementById('message-type').value;
  const text = input.value.trim();
  
  if (!text) return;
  
  const btn = document.getElementById('send-btn');
  btn.disabled = true;
  btn.textContent = 'Sending...';
  
  try {
    // Send via Socket.IO for real-time
    socket.emit('send-message', {
      sessionId,
      text,
      type
    });
    
    // Clear input
    input.value = '';
    
  } catch (error) {
    console.error('Send error:', error);
    alert('Error sending message');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send';
  }
}

// Utility functions
function scrollToBottom() {
  const container = document.getElementById('messages-container');
  container.scrollTop = container.scrollHeight;
}

function showNotification(message) {
  // Simple notification
  const notification = document.createElement('div');
  notification.className = 'alert alert-info';
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.zIndex = '1000';
  document.body.appendChild(notification);
  
  setTimeout(() => notification.remove(), 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when page loads
init();
