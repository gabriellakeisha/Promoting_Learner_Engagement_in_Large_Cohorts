let socket = null;
let currentUser = null;
let currentSession = null;
let sessionId = null;
let replyingTo = null;
let socketJoined = false;

function getSessionIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('sessionId');
}

async function checkAuth() {
  try {
    const authResponse = await fetch('/api/auth/me', {
      credentials: 'include'
    });

    if (!authResponse.ok) {
      window.location.href = '/login.html';
      return false;
    }

    const authResult = await authResponse.json();

    if (!authResult.success) {
      window.location.href = '/login.html';
      return false;
    }

    currentUser = authResult.user;
    document.getElementById('user-name').textContent = currentUser.displayName;

    return true;

  } catch (error) {
    window.location.href = '/login.html';
    return false;
  }
}

async function init() {
  try {
    sessionId = getSessionIdFromURL();

    if (!sessionId || sessionId.length !== 24) {
      alert('Invalid session ID');
      redirectToDashboard();
      return;
    }

    const authOk = await checkAuth();
    if (!authOk) return;

    await loadSession();
    initializeSocket();
    await loadMessages();
    setupInputArea();

  } catch (error) {
    removeLoadingSpinner();
    showError('Failed to load chat: ' + error.message);

    setTimeout(() => {
      redirectToDashboard();
    }, 3000);
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
    const response = await fetch(`/api/sessions/${sessionId}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Session not found (HTTP ${response.status})`);
    }

    const result = await response.json();

    if (result.success && result.session) {
      currentSession = result.session;
      document.getElementById('session-title').textContent = result.session.title;
      document.getElementById('session-info').textContent =
        `${result.session.moduleCode || 'No module'} • Join Code: ${result.session.joinCode}`;
    } else {
      throw new Error('Session data is invalid');
    }
  } catch (error) {
    throw new Error('Cannot load session: ' + error.message);
  }
}

function initializeSocket() {
  socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    forceNew: false
  });

  socket.on('connect', () => {
    if (!sessionId || !currentUser) return;

    socket.emit('join-session', {
      sessionId: sessionId,
      userId: currentUser._id,
      displayName: currentUser.displayName,
      role: currentUser.role
    });
  });

  socket.on('joined-session', (data) => {
    socketJoined = true;
  });

  socket.on('new-message', (message) => {
    const formattedMessage = {
      id: message.id || message._id,
      username: message.user?.displayName || message.username,
      userRole: message.user?.role || message.userRole,
      userId: message.userId || message.user?.id,
      text: message.text,
      type: message.type,
      timestamp: message.timestamp || message.createdAt,
      replyTo: message.replyTo,
      isPinned: message.isPinned,
      isAnnouncement: message.isAnnouncement,
      isReported: message.isReported,
      identityMode: message.identityMode || 'identified',
      alias: message.alias
    };

    appendMessage(formattedMessage);
    scrollToBottom();
  });

  socket.on('message-deleted', (data) => {
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
      messageElement.style.transition = 'opacity 0.3s ease';
      messageElement.style.opacity = '0';
      setTimeout(() => {
        messageElement.remove();
      }, 300);
    }
  });

  socket.on('message-reported', (data) => {
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
      if (data.isReported) {
        messageElement.classList.add('reported-message');

        const footer = messageElement.querySelector('.message-footer');
        if (footer && !footer.querySelector('.badge-reported')) {
          const reportedBadge = document.createElement('span');
          reportedBadge.className = 'message-badge badge-reported';
          reportedBadge.innerHTML = '🚩 REPORTED';
          footer.insertBefore(reportedBadge, footer.firstChild);
        }

        const reportBtn = messageElement.querySelector('.report-btn');
        if (reportBtn) {
          reportBtn.textContent = 'Unreport';
          reportBtn.classList.add('reported');
        }
      } else {
        messageElement.classList.remove('reported-message');

        const reportedBadge = messageElement.querySelector('.badge-reported');
        if (reportedBadge) {
          reportedBadge.remove();
        }

        const reportBtn = messageElement.querySelector('.report-btn');
        if (reportBtn) {
          reportBtn.textContent = '🚩 Report';
          reportBtn.classList.remove('reported');
        }
      }
    }
  });

  socket.on('message-edited', (data) => {
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
      const textEl = messageElement.querySelector('.message-text');
      if (textEl) {
        textEl.textContent = data.text;
      }
      if (!messageElement.querySelector('.edited-badge')) {
        const header = messageElement.querySelector('.message-header');
        if (header) {
          const editedBadge = document.createElement('span');
          editedBadge.className = 'message-badge edited-badge';
          editedBadge.textContent = '✏️ edited';
          editedBadge.style.cssText = 'font-size:9px;padding:2px 6px;background:rgba(255,255,255,0.1);border-radius:4px;margin-left:4px;';
          header.appendChild(editedBadge);
        }
      }
    }
  });

  socket.on('user-joined', (data) => {});
  socket.on('user-left', (data) => {});

  socket.on('disconnect', () => {
    socketJoined = false;
  });

  socket.on('connect_error', (error) => {});
  socket.on('error', (error) => {});
}

async function loadMessages() {
  try {
    showLoadingSpinner();

    const response = await fetch(`/api/messages/session/${sessionId}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to load messages (HTTP ${response.status})`);
    }

    const result = await response.json();

    removeLoadingSpinner();

    if (result.success && result.messages && result.messages.length > 0) {
      result.messages.forEach(msg => {
        appendMessage({
          id: msg.id,
          username: msg.userId?.displayName || msg.username || 'Anonymous',
          userRole: msg.userId?.role || msg.userRole || 'student',
          userId: msg.userId?._id || msg.userId,
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
    } else {
      showEmptyState();
    }

  } catch (error) {
    removeLoadingSpinner();
    showError('Failed to load messages: ' + error.message);
  }
}

function setupInputArea() {
  const inputContainer = document.querySelector('.chat-input-container');

  if (currentUser.role === 'lecturer') {
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
    let replyIndicator = document.getElementById('reply-indicator');
    if (!replyIndicator) {
      replyIndicator = document.createElement('div');
      replyIndicator.id = 'reply-indicator';
      replyIndicator.className = 'reply-indicator-container';
      replyIndicator.style.display = 'none';
      inputContainer.insertBefore(replyIndicator, inputContainer.firstChild);
    }

    if (typeof initIdentityModeSelector === 'function') {
      initIdentityModeSelector('.chat-input-container');
    }
  }

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

async function sendMessage() {
  const input = document.getElementById('message-input');

  if (!input) return;

  const text = input.value.trim();

  if (!text) return;

  if (!socketJoined) {
    socket.emit('join-session', {
      sessionId: sessionId,
      userId: currentUser._id,
      displayName: currentUser.displayName,
      role: currentUser.role
    });
  }

  let messageData;

  if (currentUser.role === 'lecturer') {
    const isAnnouncement = document.getElementById('is-announcement')?.checked || false;
    const shouldPin = document.getElementById('pin-message')?.checked || false;

    messageData = {
      sessionId: sessionId,
      text: text,
      type: 'COMMENT',
      replyTo: replyingTo ? replyingTo.id : null,
      isAnnouncement: isAnnouncement
    };

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

      if (shouldPin && result.messageData && result.messageData.id) {
        await fetch(`/api/messages/${result.messageData.id}/pin`, {
          method: 'POST',
          credentials: 'include'
        });
      }

      input.value = '';
      const announceCheckbox = document.getElementById('is-announcement');
      const pinCheckbox = document.getElementById('pin-message');
      const respondCheckbox = document.getElementById('is-respond');

      if (announceCheckbox) announceCheckbox.checked = false;
      if (pinCheckbox) pinCheckbox.checked = false;
      if (respondCheckbox) respondCheckbox.checked = false;

      cancelReply();
      input.focus();

    } catch (error) {
      alert('Failed to send message: ' + error.message);
    }

  } else {
    const typeSelect = document.getElementById('message-type');

    const identityMode = typeof getIdentityMode === 'function' ? getIdentityMode() : 'anonymous';
    const alias = identityMode === 'pseudonymous' && typeof getSessionAlias === 'function'
      ? getSessionAlias()
      : null;

    messageData = {
      sessionId: sessionId,
      text: text,
      type: typeSelect ? typeSelect.value : 'COMMENT',
      replyTo: replyingTo ? replyingTo.id : null,
      identityMode: identityMode,
      alias: alias
    };

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

      input.value = '';
      cancelReply();
      input.focus();

    } catch (error) {
      alert('Failed to send message: ' + error.message);
    }
  }
}

function appendMessage(message) {
  const container = document.getElementById('messages-container');
  if (!container) return;

  const emptyState = container.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const messageDiv = document.createElement('div');

  const isLecturer = message.userRole === 'lecturer';
  const isOwnMessage = currentUser && (
    message.username === currentUser.displayName ||
    message.userId === currentUser._id ||
    (message.userId && message.userId._id === currentUser._id)
  );

  const identityMode = message.identityMode || 'identified';

  let messageClasses = `chat-message ${isLecturer ? 'lecturer-message' : 'student-message'}`;

  if (isOwnMessage) {
    messageClasses += ' own-message';
  }
  if (message.isAnnouncement) {
    messageClasses += ' announcement';
  }
  if (message.isPinned) {
    messageClasses += ' pinned';
  }
  if (message.isReported) {
    messageClasses += ' reported-message';
  }
  if (!isLecturer && identityMode !== 'identified') {
    messageClasses += ` ${identityMode}-message`;
  }

  messageDiv.className = messageClasses;
  messageDiv.dataset.messageId = message.id || message._id;

  let displayName, avatarHTML, identityBadge = '';

  if (isLecturer) {
    displayName = message.username || 'Lecturer';
    avatarHTML = generateAvatarHTML(message.avatar, displayName, true);
  } else {
    switch (identityMode) {
      case 'anonymous':
        displayName = 'Anonymous';
        avatarHTML = `
          <div class="message-avatar anon-avatar" style="
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #6b7280;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 18px;
            font-weight: bold;
            flex-shrink: 0;
          ">?</div>
        `;
        identityBadge = '<span class="identity-badge anonymous">👤 Anon</span>';
        break;

      case 'pseudonymous':
        displayName = message.alias || 'Student';
        const aliasInitials = displayName.substring(0, 2).toUpperCase();
        avatarHTML = `
          <div class="message-avatar pseudo-avatar" style="
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea, #764ba2);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 14px;
            font-weight: 700;
            flex-shrink: 0;
          ">${aliasInitials}</div>
        `;
        identityBadge = '<span class="identity-badge pseudonymous">🎭 Alias</span>';
        break;

      case 'identified':
      default:
        displayName = message.username || 'Student';
        avatarHTML = generateAvatarHTML(message.avatar, displayName, false);
        break;
    }
  }

  const lecturerBadge = isLecturer ? '<span class="lecturer-badge-inline">👨‍🏫 LECTURER</span>' : '';

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

  const typeIcon = getTypeIcon(message.type);

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

  let actionButtonsHTML = '';

  actionButtonsHTML += `<button class="action-btn reply-btn" onclick="setReplyTo('${message.id || message._id}', '${escapeHtml(displayName)}', '${escapeHtml(message.text?.substring(0, 100) || '')}')" title="Reply">↩️ Reply</button>`;

  if (currentUser && currentUser.role === 'lecturer') {
    actionButtonsHTML += `<button class="action-btn pin-btn" onclick="togglePin('${message.id || message._id}')" title="${message.isPinned ? 'Unpin' : 'Pin'}">${message.isPinned ? '📌 Unpin' : '📍 Pin'}</button>`;

    if (message.isReported) {
      actionButtonsHTML += `<button class="action-btn report-btn reported" onclick="unreportMessage('${message.id || message._id}')" title="Remove Report">✅ Unreport</button>`;
    } else {
      actionButtonsHTML += `<button class="action-btn report-btn" onclick="reportMessage('${message.id || message._id}')" title="Report">🚩 Report</button>`;
    }

    actionButtonsHTML += `<button class="action-btn delete-btn" onclick="deleteMessage('${message.id || message._id}')" title="Delete">🗑️ Delete</button>`;
  } else if (isOwnMessage) {
    actionButtonsHTML += `<button class="action-btn edit-btn" onclick="editMessage('${message.id || message._id}')" title="Edit">✏️ Edit</button>`;
    actionButtonsHTML += `<button class="action-btn delete-btn" onclick="deleteMessage('${message.id || message._id}')" title="Delete">🗑️ Delete</button>`;
  }

  messageDiv.innerHTML = `
    <div class="message-avatar-wrapper">
      ${avatarHTML}
    </div>
    <div class="message-content-wrapper">
      <div class="message-header">
        <span class="message-username ${isLecturer ? 'lecturer' : 'student'}">
          ${escapeHtml(displayName)}
        </span>
        ${lecturerBadge}
        ${identityBadge}
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
  container.scrollTop = container.scrollHeight;
}

function generateAvatarHTML(avatar, displayName, isLecturer) {
  const size = 40;
  const initials = getAvatarInitials(displayName);

  if (avatar?.type === 'uploaded' && avatar.imageUrl) {
    return `
      <div class="message-avatar ${isLecturer ? 'lecturer-avatar' : ''}" style="width: ${size}px; height: ${size}px;">
        <img src="${avatar.imageUrl}" alt="${escapeHtml(displayName)}" 
             style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
      </div>
    `;
  }

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

function getAvatarInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(' ').filter(p => p.length > 0);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function generateColorFromName(name) {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F1948A', '#82E0AA', '#F8B500', '#00CED1', '#FF69B4'
  ];

  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

window.deleteMessage = async function(messageId) {
  if (!confirm('Are you sure you want to permanently delete this message?')) {
    return;
  }

  try {
    const response = await fetch(`/api/messages/${messageId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete message');
    }

    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      messageElement.style.transition = 'opacity 0.3s ease';
      messageElement.style.opacity = '0';
      setTimeout(() => {
        messageElement.remove();
      }, 300);
    }

  } catch (error) {
    alert('Failed to delete message: ' + error.message);
  }
};

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

  } catch (error) {
    alert('Failed to edit message: ' + error.message);
  }
};

window.reportMessage = async function(messageId) {
  const reason = prompt('Why are you reporting this message? (Optional)');

  if (reason === null) {
    return;
  }

  try {
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

    alert('Message reported successfully');

  } catch (error) {
    alert('Failed to report message: ' + error.message);
  }
};

window.unreportMessage = async function(messageId) {
  if (!confirm('Remove the report flag from this message?')) {
    return;
  }

  try {
    const response = await fetch(`/api/messages/${messageId}/report`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to unreport message');
    }

    alert('Report removed successfully');

  } catch (error) {
    alert('Failed to unreport message: ' + error.message);
  }
};

window.togglePin = async function(messageId) {
  try {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    const isPinned = messageElement?.classList.contains('pinned');

    const endpoint = isPinned ? 'unpin' : 'pin';

    const response = await fetch(`/api/messages/${messageId}/${endpoint}`, {
      method: 'POST',
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to ${endpoint} message`);
    }

    location.reload();

  } catch (error) {
    alert('Failed to update pin status: ' + error.message);
  }
};

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

function cancelReply() {
  replyingTo = null;
  const indicator = document.getElementById('reply-indicator');
  if (indicator) {
    indicator.style.display = 'none';
  }
}

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

window.setReplyTo = setReplyTo;
window.cancelReply = cancelReply;
window.scrollToMessage = scrollToMessage;

document.addEventListener('DOMContentLoaded', () => {
  init();
});