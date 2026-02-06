var announcements = [];
var pinnedMessages = [];
var isFilteringPinned = false;
var activeTypeFilter = null;

function initializeAnnouncementAndPinFeature(messages) {
  console.log('📢 Initializing announcement & pin feature');
  updateAnnouncementsFromMessages(messages);
  updatePinnedFromMessages(messages);
  initializeAnnouncementBanner();
  initializeHeaderMenu();
  initializeFilterBanner();
  createModals();
  updateTypeBadges();
}

function initializeAnnouncementBanner() {
  var chatMessages = document.querySelector('.chat-messages');
  if (!chatMessages || document.getElementById('announcement-banner')) return;
  
  var banner = document.createElement('div');
  banner.id = 'announcement-banner';
  banner.className = 'announcement-banner';
  banner.onclick = showAnnouncementList;
  banner.innerHTML = `
    <span class="announcement-icon">📢</span>
    <div class="announcement-content">
      <div class="announcement-label">Latest Announcement</div>
      <div class="announcement-text" id="announcement-text">-</div>
    </div>
    <span class="announcement-count" id="announcement-count">0</span>
    <span class="announcement-arrow">›</span>
  `;
  
  chatMessages.parentNode.insertBefore(banner, chatMessages);
  updateAnnouncementBanner();
}

function updateAnnouncementBanner() {
  var banner = document.getElementById('announcement-banner');
  var textEl = document.getElementById('announcement-text');
  var countEl = document.getElementById('announcement-count');
  
  if (!banner) return;
  
  if (announcements.length > 0) {
    banner.classList.add('has-announcements');
    var latest = announcements[announcements.length - 1];
    textEl.textContent = latest.text;
    countEl.textContent = announcements.length;
  } else {
    banner.classList.remove('has-announcements');
  }
}

function updateAnnouncementsFromMessages(messages) {
  announcements = messages.filter(function(msg) {
    return msg.isAnnouncement;
  }).map(function(msg) {
    return {
      id: msg.id,
      username: msg.username,
      text: msg.text,
      timestamp: msg.timestamp
    };
  });
}

function addAnnouncement(message) {
  var exists = announcements.some(function(a) { return a.id === message.id; });
  if (!exists) {
    announcements.push({
      id: message.id,
      username: message.username,
      text: message.text,
      timestamp: message.timestamp
    });
    updateAnnouncementBanner();
  }
}

function initializeHeaderMenu() {
  var chatHeader = document.querySelector('.chat-header');
  if (!chatHeader || document.getElementById('header-menu-container')) return;
  
  chatHeader.style.position = 'relative';
  chatHeader.style.display = 'flex';
  chatHeader.style.alignItems = 'flex-start';
  chatHeader.style.justifyContent = 'space-between';
  
  var existingContent = chatHeader.innerHTML;
  chatHeader.innerHTML = '<div class="header-content">' + existingContent + '</div>';
  
  var menuContainer = document.createElement('div');
  menuContainer.id = 'header-menu-container';
  menuContainer.className = 'header-menu-container';
  menuContainer.innerHTML = `
    <button class="header-menu-btn" id="header-menu-btn" title="Options">⋮</button>
    <div class="header-dropdown" id="header-dropdown">
      <button class="dropdown-item" id="pinned-filter-btn">
        <span class="dropdown-item-icon">📌</span>
        <span class="dropdown-item-text">Pinned Messages</span>
        <span class="dropdown-item-badge" id="pinned-count-badge">0</span>
      </button>
      <div class="dropdown-divider"></div>
      <div style="padding:8px 16px 4px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Filter by Type</div>
      <button class="dropdown-item" id="filter-questions-btn">
        <span class="dropdown-item-icon">❓</span>
        <span class="dropdown-item-text">Questions</span>
        <span class="dropdown-item-badge" id="question-count-badge" style="display:none;">0</span>
      </button>
      <button class="dropdown-item" id="filter-confusion-btn">
        <span class="dropdown-item-icon">❗</span>
        <span class="dropdown-item-text">Confusion</span>
        <span class="dropdown-item-badge" id="confusion-count-badge" style="display:none;">0</span>
      </button>
      <button class="dropdown-item" id="filter-comments-btn">
        <span class="dropdown-item-icon">💬</span>
        <span class="dropdown-item-text">Comments</span>
        <span class="dropdown-item-badge" id="comment-count-badge" style="display:none;">0</span>
      </button>
      <div class="dropdown-divider"></div>
      <button class="dropdown-item" id="clear-all-filters-btn" style="display:none;">
        <span class="dropdown-item-icon">✕</span>
        <span class="dropdown-item-text" style="color:#ef4444;">Clear Filter</span>
      </button>
    </div>
  `;
  
  chatHeader.appendChild(menuContainer);
  
  var menuBtn = document.getElementById('header-menu-btn');
  var dropdown = document.getElementById('header-dropdown');
  var pinnedBtn = document.getElementById('pinned-filter-btn');
  var questionsBtn = document.getElementById('filter-questions-btn');
  var confusionBtn = document.getElementById('filter-confusion-btn');
  var commentsBtn = document.getElementById('filter-comments-btn');
  var clearFiltersBtn = document.getElementById('clear-all-filters-btn');
  
  menuBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    dropdown.classList.toggle('show');
    menuBtn.classList.toggle('active');
    updateTypeBadges();
  });
  
  pinnedBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    dropdown.classList.remove('show');
    menuBtn.classList.remove('active');
    if (activeTypeFilter) { clearTypeFilter(); }
    togglePinnedFilter();
  });

  questionsBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    dropdown.classList.remove('show');
    menuBtn.classList.remove('active');
    applyTypeFilter('QUESTION');
  });

  confusionBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    dropdown.classList.remove('show');
    menuBtn.classList.remove('active');
    applyTypeFilter('CONFUSION');
  });

  commentsBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    dropdown.classList.remove('show');
    menuBtn.classList.remove('active');
    applyTypeFilter('COMMENT');
  });

  clearFiltersBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    dropdown.classList.remove('show');
    menuBtn.classList.remove('active');
    clearAllFilters();
  });
  
  document.addEventListener('click', function(e) {
    if (!menuContainer.contains(e.target)) {
      dropdown.classList.remove('show');
      menuBtn.classList.remove('active');
    }
  });
  
  updatePinnedBadge();
}

function updatePinnedBadge() {
  var badge = document.getElementById('pinned-count-badge');
  var btn = document.getElementById('pinned-filter-btn');
  
  if (badge) {
    badge.textContent = pinnedMessages.length;
    badge.style.display = pinnedMessages.length > 0 ? 'inline-block' : 'none';
  }
  
  if (btn) {
    if (isFilteringPinned) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
}

function initializeFilterBanner() {
  var chatMessages = document.querySelector('.chat-messages');
  if (!chatMessages || document.getElementById('filter-active-banner')) return;
  
  var banner = document.createElement('div');
  banner.id = 'filter-active-banner';
  banner.className = 'filter-active-banner';
  banner.innerHTML = `
    <div class="filter-active-text">
      <span id="filter-banner-icon">📌</span>
      <span id="filter-banner-label">Showing pinned messages only</span>
    </div>
    <button class="filter-clear-btn" onclick="clearAllFilters()">Clear Filter</button>
  `;
  
  var announcementBanner = document.getElementById('announcement-banner');
  if (announcementBanner) {
    announcementBanner.parentNode.insertBefore(banner, announcementBanner.nextSibling);
  } else {
    chatMessages.parentNode.insertBefore(banner, chatMessages);
  }
}

function updatePinnedFromMessages(messages) {
  pinnedMessages = messages.filter(function(msg) {
    return msg.isPinned;
  }).map(function(msg) {
    return {
      id: msg.id,
      username: msg.username,
      text: msg.text,
      timestamp: msg.timestamp
    };
  });
  updatePinnedBadge();
}

function addPinnedMessage(message) {
  var exists = pinnedMessages.some(function(p) { return p.id === message.id; });
  if (!exists) {
    pinnedMessages.push({
      id: message.id,
      username: message.username,
      text: message.text,
      timestamp: message.timestamp
    });
    updatePinnedBadge();
  }
}

function removePinnedMessage(messageId) {
  pinnedMessages = pinnedMessages.filter(function(p) { return p.id !== messageId; });
  updatePinnedBadge();
  
  if (isFilteringPinned) {
    var el = document.querySelector('[data-message-id="' + messageId + '"]');
    if (el) el.classList.remove('show-in-filter');
  }
}

function togglePinnedFilter() {
  if (isFilteringPinned) {
    clearPinnedFilter();
  } else {
    applyPinnedFilter();
  }
}

function applyPinnedFilter() {
  isFilteringPinned = true;
  
  var container = document.querySelector('.chat-messages');
  var filterBanner = document.getElementById('filter-active-banner');
  
  if (container) {
    container.classList.add('filtered');
    
    var allShown = container.querySelectorAll('.show-in-filter');
    allShown.forEach(function(el) { el.classList.remove('show-in-filter'); });
    
    pinnedMessages.forEach(function(pin) {
      var el = document.querySelector('[data-message-id="' + pin.id + '"]');
      if (el) el.classList.add('show-in-filter');
    });
  }
  
  if (filterBanner) {
    var iconEl = document.getElementById('filter-banner-icon');
    var labelEl = document.getElementById('filter-banner-label');
    if (iconEl) iconEl.textContent = '📌';
    if (labelEl) labelEl.textContent = 'Showing pinned messages only';
    filterBanner.classList.add('show');
  }
  
  var clearBtn = document.getElementById('clear-all-filters-btn');
  if (clearBtn) clearBtn.style.display = 'flex';
  
  updatePinnedBadge();
}

function clearPinnedFilter() {
  isFilteringPinned = false;
  
  var container = document.querySelector('.chat-messages');
  var filterBanner = document.getElementById('filter-active-banner');
  
  if (container) {
    container.classList.remove('filtered');
    var messages = container.querySelectorAll('.show-in-filter');
    messages.forEach(function(el) {
      el.classList.remove('show-in-filter');
    });
  }
  
  if (filterBanner) {
    filterBanner.classList.remove('show');
  }
  
  var clearBtn = document.getElementById('clear-all-filters-btn');
  if (clearBtn) clearBtn.style.display = 'none';
  
  updatePinnedBadge();
  updateDropdownActiveState(null);
}

function applyTypeFilter(type) {
  if (activeTypeFilter === type) {
    clearTypeFilter();
    return;
  }

  if (isFilteringPinned) {
    isFilteringPinned = false;
    updatePinnedBadge();
  }

  activeTypeFilter = type;

  var container = document.querySelector('.chat-messages');
  var filterBanner = document.getElementById('filter-active-banner');

  if (container) {
    container.classList.add('filtered');

    var allShown = container.querySelectorAll('.show-in-filter');
    allShown.forEach(function(el) { el.classList.remove('show-in-filter'); });

    var messages = container.querySelectorAll('.chat-message');
    messages.forEach(function(el) {
      var messageType = (el.dataset.messageType || '').toUpperCase();
      if (messageType === type) {
        el.classList.add('show-in-filter');
      }
    });
  }

  if (filterBanner) {
    var typeLabels = { 'QUESTION': '❓ Questions', 'CONFUSION': '❗ Confusion', 'COMMENT': '💬 Comments' };
    var typeIcons = { 'QUESTION': '❓', 'CONFUSION': '❗', 'COMMENT': '💬' };
    var iconEl = document.getElementById('filter-banner-icon');
    var labelEl = document.getElementById('filter-banner-label');
    if (iconEl) iconEl.textContent = typeIcons[type] || '🔍';
    if (labelEl) labelEl.textContent = 'Showing: ' + (typeLabels[type] || type);
    filterBanner.classList.add('show');
  }

  var clearBtn = document.getElementById('clear-all-filters-btn');
  if (clearBtn) clearBtn.style.display = 'flex';

  updateDropdownActiveState(type);
}

function clearTypeFilter() {
  activeTypeFilter = null;

  var container = document.querySelector('.chat-messages');
  var filterBanner = document.getElementById('filter-active-banner');

  if (container) {
    container.classList.remove('filtered');
    var allShown = container.querySelectorAll('.show-in-filter');
    allShown.forEach(function(el) { el.classList.remove('show-in-filter'); });
  }

  if (filterBanner) {
    filterBanner.classList.remove('show');
  }

  var clearBtn = document.getElementById('clear-all-filters-btn');
  if (clearBtn) clearBtn.style.display = 'none';

  updateDropdownActiveState(null);
}

function clearAllFilters() {
  if (isFilteringPinned) { clearPinnedFilter(); }
  if (activeTypeFilter) { clearTypeFilter(); }

  var container = document.querySelector('.chat-messages');
  var filterBanner = document.getElementById('filter-active-banner');

  if (container) {
    container.classList.remove('filtered');
    var allShown = container.querySelectorAll('.show-in-filter');
    allShown.forEach(function(el) { el.classList.remove('show-in-filter'); });
  }

  if (filterBanner) {
    filterBanner.classList.remove('show');
  }

  var clearBtn = document.getElementById('clear-all-filters-btn');
  if (clearBtn) clearBtn.style.display = 'none';

  updateDropdownActiveState(null);
  updatePinnedBadge();
}

function updateDropdownActiveState(activeType) {
  var items = {
    'QUESTION': document.getElementById('filter-questions-btn'),
    'CONFUSION': document.getElementById('filter-confusion-btn'),
    'COMMENT': document.getElementById('filter-comments-btn')
  };

  Object.keys(items).forEach(function(type) {
    if (items[type]) {
      if (type === activeType) {
        items[type].classList.add('active');
      } else {
        items[type].classList.remove('active');
      }
    }
  });
}

function updateTypeBadges() {
  var container = document.querySelector('.chat-messages');
  if (!container) return;

  var messages = container.querySelectorAll('.chat-message');
  var counts = { QUESTION: 0, CONFUSION: 0, COMMENT: 0 };

  messages.forEach(function(el) {
    var type = (el.dataset.messageType || '').toUpperCase();
    if (counts.hasOwnProperty(type)) {
      counts[type]++;
    }
  });

  var qBadge = document.getElementById('question-count-badge');
  var cBadge = document.getElementById('confusion-count-badge');
  var comBadge = document.getElementById('comment-count-badge');

  if (qBadge) { qBadge.textContent = counts.QUESTION; qBadge.style.display = counts.QUESTION > 0 ? 'inline-block' : 'none'; }
  if (cBadge) { cBadge.textContent = counts.CONFUSION; cBadge.style.display = counts.CONFUSION > 0 ? 'inline-block' : 'none'; }
  if (comBadge) { comBadge.textContent = counts.COMMENT; comBadge.style.display = counts.COMMENT > 0 ? 'inline-block' : 'none'; }
}

function handlePinUpdate(data) {
  var messageId = data.messageId || data.id;
  
  if (data.isPinned) {
    var el = document.querySelector('[data-message-id="' + messageId + '"]');
    if (el) {
      var username = el.querySelector('.message-username')?.textContent || 'Unknown';
      var text = el.querySelector('.message-text')?.textContent || '';
      addPinnedMessage({
        id: messageId,
        username: username,
        text: text,
        timestamp: new Date().toISOString()
      });
      
      if (isFilteringPinned) {
        el.classList.add('show-in-filter');
      }
    }
  } else {
    removePinnedMessage(messageId);
  }
}

function createModals() {
  if (!document.getElementById('announcement-modal-overlay')) {
    var announcementModal = document.createElement('div');
    announcementModal.id = 'announcement-modal-overlay';
    announcementModal.className = 'announcement-modal-overlay';
    announcementModal.style.display = 'none';
    announcementModal.onclick = function(e) {
      if (e.target === announcementModal) hideAnnouncementList();
    };
    announcementModal.innerHTML = `
      <div class="announcement-modal">
        <div class="modal-header">
          <div class="modal-title">📢 All Announcements</div>
          <button class="modal-close" onclick="hideAnnouncementList()">×</button>
        </div>
        <div class="modal-body" id="announcement-list"></div>
      </div>
    `;
    document.body.appendChild(announcementModal);
  }
}

function showAnnouncementList() {
  var modal = document.getElementById('announcement-modal-overlay');
  var listContainer = document.getElementById('announcement-list');
  
  if (!modal || !listContainer) return;
  
  if (announcements.length === 0) {
    listContainer.innerHTML = `
      <div class="modal-empty">
        <div class="modal-empty-icon">📢</div>
        <div>No announcements yet</div>
      </div>
    `;
  } else {
    var html = '';
    var sorted = announcements.slice().reverse();
    sorted.forEach(function(ann) {
      html += `
        <div class="modal-item" onclick="goToMessage('${ann.id}')">
          <span class="modal-item-icon">📢</span>
          <div class="modal-item-content">
            <div class="modal-item-header">
              <span class="modal-item-author">${escapeHtmlForModal(ann.username)}</span>
              <span class="modal-item-time">${formatTimeForModal(ann.timestamp)}</span>
            </div>
            <div class="modal-item-text">${escapeHtmlForModal(ann.text)}</div>
          </div>
        </div>
      `;
    });
    listContainer.innerHTML = html;
  }
  
  modal.style.display = 'flex';
}

function hideAnnouncementList() {
  var modal = document.getElementById('announcement-modal-overlay');
  if (modal) modal.style.display = 'none';
}

function goToMessage(messageId) {
  hideAnnouncementList();
  
  if (isFilteringPinned) { clearPinnedFilter(); }
  if (activeTypeFilter) { clearTypeFilter(); }
  
  if (typeof scrollToMessage === 'function') {
    scrollToMessage(messageId);
  } else {
    var el = document.querySelector('[data-message-id="' + messageId + '"]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'background 0.3s';
      el.style.background = 'rgba(0, 168, 132, 0.3)';
      setTimeout(function() { el.style.background = ''; }, 2000);
    }
  }
}

function escapeHtmlForModal(text) {
  var div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function formatTimeForModal(timestamp) {
  if (!timestamp) return '';
  var date = new Date(timestamp);
  var now = new Date();
  var isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + 
           ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
}

window.initializeAnnouncementAndPinFeature = initializeAnnouncementAndPinFeature;
window.addAnnouncement = addAnnouncement;
window.addPinnedMessage = addPinnedMessage;
window.handlePinUpdate = handlePinUpdate;
window.togglePinnedFilter = togglePinnedFilter;
window.clearPinnedFilter = clearPinnedFilter;
window.clearAllFilters = clearAllFilters;
window.applyTypeFilter = applyTypeFilter;
window.clearTypeFilter = clearTypeFilter;
window.updateTypeBadges = updateTypeBadges;
window.showAnnouncementList = showAnnouncementList;
window.hideAnnouncementList = hideAnnouncementList;
window.goToMessage = goToMessage;
window.isFilteringPinned = isFilteringPinned;