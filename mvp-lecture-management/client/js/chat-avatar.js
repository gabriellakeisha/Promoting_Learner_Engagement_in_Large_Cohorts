// RENDER MESSAGE WITH AVATAR

function renderMessageWithAvatar(message, currentUserId, isLecturerView = false) {
  const isOwn = message.userId === currentUserId || message.sender?._id === currentUserId;
  const isLecturer = message.sender?.role === 'lecturer' || message.isLecturer;
  const isAnnouncement = message.isAnnouncement;
  
  // Get display info
  const displayName = message.sender?.displayName || message.displayName || 'Anonymous';
  const avatar = message.sender?.avatar || message.avatar;
  
  // Determine message classes
  let messageClasses = ['chat-message'];
  if (isOwn) messageClasses.push('own');
  if (isLecturer) messageClasses.push('lecturer-message');
  if (isAnnouncement) messageClasses.push('announcement');
  if (message.isPinned) messageClasses.push('pinned');
  if (message.isReported) messageClasses.push('reported');
  
  // Build avatar HTML
  const avatarHTML = renderChatAvatar(avatar, displayName, 36);
  
  // Build lecturer badge
  const lecturerBadge = isLecturer ? 
    `<span class="lecturer-badge" title="Lecturer">👨‍🏫</span>` : '';
  
  // Build announcement badge
  const announcementBadge = isAnnouncement ? 
    `<span class="announcement-badge">📢 Announcement</span>` : '';
  
  // Build pin indicator
  const pinIndicator = message.isPinned ? 
    `<span class="pin-indicator" title="Pinned">📌</span>` : '';
  
  // Message type indicator
  const typeIcons = {
    'QUESTION': '❓',
    'COMMENT': '💬',
    'CONFUSION': '❗'
  };
  const typeIcon = typeIcons[message.type] || '💬';
  
  // Format timestamp
  const timestamp = formatMessageTime(message.createdAt || message.timestamp);
  
  // Reply info
  let replyHTML = '';
  if (message.replyTo) {
    const replyText = message.replyTo.text?.substring(0, 50) + (message.replyTo.text?.length > 50 ? '...' : '');
    replyHTML = `
      <div class="reply-reference">
        ↩️ Replying to: <span class="reply-text">${escapeHTML(replyText)}</span>
      </div>
    `;
  }
  
  return `
    <div class="${messageClasses.join(' ')}" data-message-id="${message._id || message.id}">
      <div class="message-avatar">
        ${avatarHTML}
      </div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-sender">
            ${escapeHTML(displayName)}
            ${lecturerBadge}
          </span>
          ${announcementBadge}
          ${pinIndicator}
          <span class="message-time">${timestamp}</span>
        </div>
        ${replyHTML}
        <div class="message-body">
          <span class="message-type-icon">${typeIcon}</span>
          <span class="message-text">${escapeHTML(message.text)}</span>
        </div>
        ${renderMessageActions(message, currentUserId, isLecturerView)}
      </div>
    </div>
  `;
}


// RENDER CHAT AVATAR

function renderChatAvatar(avatar, displayName, size = 36) {
  const initials = getAvatarInitials(displayName);
  
  if (avatar?.type === 'uploaded' && avatar.imageUrl) {
    return `
      <div class="chat-avatar" style="width: ${size}px; height: ${size}px;">
        <img src="${avatar.imageUrl}" alt="${escapeHTML(displayName)}" 
             style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
      </div>
    `;
  }
  
  const bgColor = avatar?.backgroundColor || generateColorFromName(displayName);
  
  return `
    <div class="chat-avatar" style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background-color: ${bgColor};
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: ${Math.floor(size * 0.4)}px;
      flex-shrink: 0;
    ">${avatar?.initials || initials}</div>
  `;
}


// GET INITIALS FROM NAME

function getAvatarInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(' ').filter(p => p.length > 0);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}


// GENERATE COLOR FROM NAME (consistent)

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


// RENDER MESSAGE ACTIONS

function renderMessageActions(message, currentUserId, isLecturerView) {
  const isOwn = message.userId === currentUserId || message.sender?._id === currentUserId;
  
  let actions = [];
  
  // Reply button (always available)
  actions.push(`<button class="msg-action-btn" onclick="replyToMessage('${message._id || message.id}')" title="Reply">↩️</button>`);
  
  if (isLecturerView) {
    // Lecturer actions
    actions.push(`<button class="msg-action-btn" onclick="togglePin('${message._id || message.id}')" title="${message.isPinned ? 'Unpin' : 'Pin'}">${message.isPinned ? '📌' : '📍'}</button>`);
    
    if (!message.isReported) {
      actions.push(`<button class="msg-action-btn" onclick="reportMessage('${message._id || message.id}')" title="Report">🚩</button>`);
    } else {
      actions.push(`<button class="msg-action-btn" onclick="unreportMessage('${message._id || message.id}')" title="Remove Report">✅</button>`);
    }
    
    actions.push(`<button class="msg-action-btn" onclick="deleteMessage('${message._id || message.id}')" title="Delete">🗑️</button>`);
  } else if (isOwn) {
    // Own message actions (student)
    actions.push(`<button class="msg-action-btn" onclick="editMessage('${message._id || message.id}')" title="Edit">✏️</button>`);
    actions.push(`<button class="msg-action-btn" onclick="deleteMessage('${message._id || message.id}')" title="Delete">🗑️</button>`);
  }
  
  if (actions.length === 0) return '';
  
  return `
    <div class="message-actions">
      ${actions.join('')}
    </div>
  `;
}


// FORMAT MESSAGE TIME

function formatMessageTime(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}


// ESCAPE HTML

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}


// CHAT MESSAGE STYLES

function addChatAvatarStyles() {
  if (document.getElementById('chat-avatar-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'chat-avatar-styles';
  styles.textContent = `
    .chat-message {
      display: flex;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color, #e5e7eb);
      transition: background-color 0.2s ease;
    }
    
    .chat-message:hover {
      background-color: var(--bg-secondary, #f9fafb);
    }
    
    .chat-message.own {
      background-color: rgba(102, 126, 234, 0.05);
    }
    
    .chat-message.lecturer-message {
      border-left: 3px solid #667eea;
      background-color: rgba(102, 126, 234, 0.08);
    }
    
    .chat-message.announcement {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.1));
      border-left: 3px solid #f59e0b;
    }
    
    .chat-message.pinned {
      background-color: rgba(16, 185, 129, 0.1);
      border-left: 3px solid #10b981;
    }
    
    .chat-message.reported {
      background-color: rgba(239, 68, 68, 0.1);
      border-left: 3px solid #ef4444;
      opacity: 0.7;
    }
    
    .message-avatar {
      flex-shrink: 0;
    }
    
    .message-content {
      flex: 1;
      min-width: 0;
    }
    
    .message-header {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 4px;
    }
    
    .message-sender {
      font-weight: 600;
      color: var(--text-primary, #1f2937);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .lecturer-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: 600;
    }
    
    .announcement-badge {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
    }
    
    .pin-indicator {
      color: #10b981;
      font-size: 14px;
    }
    
    .message-time {
      font-size: 12px;
      color: var(--text-secondary, #6b7280);
      margin-left: auto;
    }
    
    .reply-reference {
      background: var(--bg-secondary, #f3f4f6);
      border-left: 2px solid #667eea;
      padding: 4px 8px;
      margin-bottom: 6px;
      border-radius: 4px;
      font-size: 12px;
      color: var(--text-secondary, #6b7280);
    }
    
    .reply-text {
      font-style: italic;
    }
    
    .message-body {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    
    .message-type-icon {
      font-size: 14px;
      flex-shrink: 0;
    }
    
    .message-text {
      color: var(--text-primary, #374151);
      line-height: 1.5;
      word-break: break-word;
    }
    
    .message-actions {
      display: flex;
      gap: 4px;
      margin-top: 8px;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    .chat-message:hover .message-actions {
      opacity: 1;
    }
    
    .msg-action-btn {
      background: var(--bg-secondary, #f3f4f6);
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 6px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s ease;
    }
    
    .msg-action-btn:hover {
      background: var(--bg-primary, #fff);
      border-color: #667eea;
    }
    
    /* Typing indicator with avatar */
    .typing-indicator {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      color: var(--text-secondary, #6b7280);
      font-size: 13px;
      font-style: italic;
    }
    
    .typing-dots {
      display: flex;
      gap: 3px;
    }
    
    .typing-dots span {
      width: 6px;
      height: 6px;
      background: #667eea;
      border-radius: 50%;
      animation: typingBounce 1.4s infinite ease-in-out;
    }
    
    .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
    
    @keyframes typingBounce {
      0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
      40% { transform: scale(1); opacity: 1; }
    }
  `;
  
  document.head.appendChild(styles);
}

// Initialize styles on load
document.addEventListener('DOMContentLoaded', addChatAvatarStyles);