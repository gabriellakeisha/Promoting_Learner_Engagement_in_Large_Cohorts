let currentUser = null;
let sessions = [];
let currentAnalyticsSessionId = null;

async function init() {
  try {
    const response = await fetch('/api/auth/me');
    const result = await response.json();

    if (!result.success || result.user.role !== 'lecturer') {
      window.location.href = '/';
      return;
    }

    currentUser = result.user;
    document.getElementById('user-name').textContent = currentUser.displayName;

    loadSessions();
  } catch (error) {
    window.location.href = '/';
  }
}

async function loadSessions() {
  try {
    const response = await fetch('/api/sessions/my-sessions');
    const result = await response.json();

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('sessions-container').classList.remove('hidden');

    if (result.success && result.sessions.length > 0) {
      sessions = result.sessions;
      displaySessions(sessions);
    } else {
      document.getElementById('no-sessions').classList.remove('hidden');
    }
  } catch (error) {
    showAlert('Error loading sessions', 'error');
  }
}

function displaySessions(sessions) {
  const container = document.getElementById('sessions-list');
  container.innerHTML = sessions.map(session => {
    var scheduleInfo = '';
    if (session.status === 'scheduled' && session.startTime) {
      var startDate = new Date(session.startTime);
      var now = new Date();
      var diff = startDate - now;
      var days = Math.floor(diff / (1000 * 60 * 60 * 24));
      var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      var mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      var countdown = '';
      if (diff > 0) {
        if (days > 0) countdown = days + 'd ' + hours + 'h';
        else if (hours > 0) countdown = hours + 'h ' + mins + 'm';
        else countdown = mins + 'm';
        countdown = ' (in ' + countdown + ')';
      } else {
        countdown = ' (ready to start)';
      }
      scheduleInfo = '<div class="session-meta-item">📅 ' +
        startDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) +
        ' at ' + startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) +
        '<span style="color:#f59e0b;font-weight:500;">' + countdown + '</span></div>';
      if (session.endTime) {
        var endDate = new Date(session.endTime);
        scheduleInfo += '<div class="session-meta-item">⏰ Ends: ' +
          endDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + '</div>';
      }
    }

    var statusLabel = session.status;
    if (session.status === 'scheduled') statusLabel = '🗓️ scheduled';

    var actionButtons = '';
    actionButtons += '<button class="btn btn-primary btn-small" onclick="viewSessionChat(\'' + (session._id || session.id) + '\', \'' + session.title + '\')">💬 Join Chat</button>';
    actionButtons += '<button class="btn btn-secondary btn-small" onclick="openManageStudentsModal(\'' + (session._id || session.id) + '\', \'' + session.title.replace(/'/g, "\\'") + '\', \'' + session.joinCode + '\')">👥 Manage Students</button>';
    actionButtons += '<button class="btn btn-secondary btn-small" onclick="viewAnalytics(\'' + (session._id || session.id) + '\', \'' + session.title + '\')">📊 Analytics</button>';

    if (session.status === 'scheduled') {
      var canStart = new Date(session.startTime) <= new Date();
      actionButtons += '<button class="btn btn-primary btn-small" style="background:#10b981;" onclick="activateSession(\'' + (session._id || session.id) + '\')">' + (canStart ? '▶️ Start Now' : '▶️ Start Early') + '</button>';
    }
    if (session.status === 'active') {
      actionButtons += '<button class="btn btn-danger btn-small" onclick="endSession(\'' + (session._id || session.id) + '\')">End Session</button>';
    }

    return '<div class="session-card">' +
      '<div class="session-title">' + session.title + '</div>' +
      '<div class="session-meta">' +
        '<div class="session-meta-item">📚 ' + (session.moduleCode || 'No module') + '</div>' +
        '<div class="session-meta-item">🔑 Join Code: <span class="session-code">' + session.joinCode + '</span></div>' +
        '<div class="session-meta-item"><span class="session-status status-' + session.status + '">' + statusLabel + '</span></div>' +
        scheduleInfo +
      '</div>' +
      '<div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">' +
        actionButtons +
      '</div>' +
    '</div>';
  }).join('');
}
function viewSessionChat(sessionId, title) {
  window.location.href = `/chat-room.html?sessionId=${sessionId}`;
}

document.getElementById('create-session-btn').addEventListener('click', () => {
  document.getElementById('create-modal').classList.add('show');
});

document.getElementById('cancel-btn').addEventListener('click', () => {
  document.getElementById('create-modal').classList.remove('show');
  document.getElementById('create-session-form').reset();
  var sf = document.getElementById('schedule-fields');
  var st = document.getElementById('schedule-toggle');
  var sb = document.getElementById('create-submit-btn');
  if (sf) sf.style.display = 'none';
  if (st) st.checked = false;
  if (sb) sb.textContent = 'Create';
});

var scheduleToggle = document.getElementById('schedule-toggle');
if (scheduleToggle) {
  scheduleToggle.addEventListener('change', function() {
    var fields = document.getElementById('schedule-fields');
    var btn = document.getElementById('create-submit-btn');
    if (this.checked) {
      fields.style.display = 'block';
      if (btn) btn.textContent = 'Schedule Session';
      var now = new Date();
      now.setMinutes(now.getMinutes() + 30);
      var defaultStart = now.toISOString().slice(0, 16);
      var startInput = document.getElementById('scheduledStart');
      if (startInput && !startInput.value) startInput.value = defaultStart;
    } else {
      if (fields) fields.style.display = 'none';
      if (btn) btn.textContent = 'Create';
    }
  });
}

document.getElementById('create-session-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  var schedToggle = document.getElementById('schedule-toggle');
  var isScheduled = schedToggle ? schedToggle.checked : false;
  var startEl = document.getElementById('scheduledStart');
  var endEl = document.getElementById('scheduledEnd');
  var scheduledStart = startEl ? startEl.value : '';
  var scheduledEnd = endEl ? endEl.value : '';

  if (isScheduled && !scheduledStart) {
    showAlert('Please select a start date and time', 'error');
    return;
  }

  if (isScheduled && scheduledStart && new Date(scheduledStart) < new Date()) {
    showAlert('Start time must be in the future', 'error');
    return;
  }

  if (isScheduled && scheduledEnd && scheduledStart && new Date(scheduledEnd) <= new Date(scheduledStart)) {
    showAlert('End time must be after start time', 'error');
    return;
  }

  const data = {
    title: document.getElementById('title').value,
    moduleCode: document.getElementById('moduleCode').value,
    description: document.getElementById('description').value,
    isScheduled: isScheduled,
    scheduledStart: isScheduled ? scheduledStart : null,
    scheduledEnd: isScheduled && scheduledEnd ? scheduledEnd : null
  };

  try {
    const response = await fetch('/api/sessions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (result.success) {
      showAlert(`Session created! Join Code: ${result.session.joinCode}`, 'success');
      document.getElementById('create-modal').classList.remove('show');
      document.getElementById('create-session-form').reset();
      loadSessions();
    } else {
      showAlert(result.message, 'error');
    }
  } catch (error) {
    showAlert('Error creating session', 'error');
  }
});

async function viewAnalytics(sessionId, title) {
  currentAnalyticsSessionId = sessionId;
  document.getElementById('analytics-modal').classList.add('show');
  document.getElementById('analytics-title').textContent = `Analytics: ${title}`;
  document.getElementById('analytics-content').innerHTML = '<div class="spinner"></div>';

  try {
    const response = await fetch(`/api/analytics/lecturer/${sessionId}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.success && result.analytics) {
      displayAnalytics(result.analytics);
    } else {
      throw new Error(result.error || 'No analytics data available');
    }
  } catch (error) {
    console.error('Analytics error:', error);
    document.getElementById('analytics-content').innerHTML =
      `<div style="padding: 40px; text-align: center; color: var(--text-color);">
        <h3 style="color: var(--danger-color);">Error Loading Analytics</h3>
        <p style="margin-top: 12px;">${error.message}</p>
        <p style="color: var(--text-secondary); margin-top: 12px;">Please try again or contact support if the issue persists.</p>
      </div>`;
  }
}

function displayAnalytics(analytics) {
  const container = document.getElementById('analytics-content');

  if (!analytics || !analytics.summary) {
    container.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-color);">
      <p>No analytics data available yet. Send some messages first!</p>
    </div>`;
    return;
  }

  const { summary, messagesByType, identityModes, keywords, topContributors, timeline, peakActivity, confusionRate, questionRate } = analytics;

  const consumersCount = Math.max(0, summary.consumersCount || (summary.totalMembers - summary.activeUsers) || 0);
  const confRate = confusionRate || (summary.totalMessages > 0 ? ((messagesByType?.CONFUSION || 0) / summary.totalMessages * 100).toFixed(1) : 0);
  const questRate = questionRate || (summary.totalMessages > 0 ? ((messagesByType?.QUESTION || 0) / summary.totalMessages * 100).toFixed(1) : 0);

  const spikeData = analytics.confusionSpike || {};
  const spikeActive = spikeData.active || false;

  container.innerHTML = `
    ${spikeActive ? `
    <div style="margin-bottom:20px;padding:14px 20px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.4);border-radius:12px;display:flex;align-items:center;gap:12px;animation:pulse 2s infinite;">
      <span style="font-size:28px;">&#x1F6A8;</span>
      <div>
        <div style="font-weight:700;color:#ef4444;font-size:15px;">Confusion Spike Detected</div>
        <div style="font-size:12px;color:var(--text-secondary);">${spikeData.confusionLast3Min || 0} confusion messages in the last 3 minutes (${spikeData.confusionPerMinute || 0}/min). Students may need clarification on the current topic.</div>
      </div>
    </div>
    ` : ''}
    <div class="analytics-stats-row">

      <div class="analytics-stat-card stat-orange">
        <div class="stat-label">Total Messages</div>
        <div class="stat-value">${summary.totalMessages || 0}</div>
      </div>
      <div class="analytics-stat-card stat-green">
        <div class="stat-label">Contributors</div>
        <div class="stat-value">${summary.activeUsers || 0}/${summary.totalMembers || 0}</div>
        <div class="stat-sub">${consumersCount} read-only</div>
      </div>
      <div class="analytics-stat-card stat-orange">
        <div class="stat-label">Participation</div>
        <div class="stat-value">${Math.min(100, summary.participationRate || 0)}%</div>
      </div>
      <div class="analytics-stat-card stat-green">
        <div class="stat-label">Msgs / min</div>
        <div class="stat-value">${summary.messagesPerMinute || 0}</div>
        <div class="stat-sub">Last 5 min: ${summary.messagesLast5Min || 0}</div>
      </div>
    </div>

    <div class="analytics-indicators-row">
      <div class="indicator-card indicator-confusion">
        <div class="indicator-content">
          <div class="indicator-info">
            <div class="indicator-label">Confusion Rate</div>
            <div class="indicator-value ${parseFloat(confRate) > 20 ? 'text-danger' : ''}">${confRate}%</div>
          </div>
          <div class="indicator-emoji">😕</div>
        </div>
        <div class="indicator-footer">
          ${parseFloat(confRate) > 20 ? 'High confusion - consider clarifying recent topics' : 'Normal confusion levels'}
        </div>
      </div>
      <div class="indicator-card indicator-question">
        <div class="indicator-content">
          <div class="indicator-info">
            <div class="indicator-label">Question Rate</div>
            <div class="indicator-value">${questRate}%</div>
          </div>
          <div class="indicator-emoji">❓</div>
        </div>
        <div class="indicator-footer">
          ${messagesByType?.QUESTION || 0} questions asked during session
        </div>
      </div>
    </div>

    <div class="analytics-charts-row">
      <div class="analytics-chart-card chart-wide">
        <h3 class="chart-title">Engagement Over Time</h3>
        <div class="chart-container">
          <canvas id="timeline-chart"></canvas>
        </div>
        ${peakActivity ? `<div class="peak-activity">Peak activity: <strong>${peakActivity.time}</strong> (${peakActivity.count} messages)</div>` : ''}
      </div>
      
      <div class="analytics-chart-card chart-narrow">
        <h3 class="chart-title">Message Types</h3>
        <div class="chart-container">
          <canvas id="type-chart"></canvas>
        </div>
      </div>
    </div>

    <div class="analytics-bottom-row">
      <div class="analytics-chart-card">
        <h3 class="chart-title">Identity Mode Usage</h3>
        <div class="chart-container-small">
          <canvas id="identity-chart"></canvas>
        </div>
        <div class="identity-legend">
          <div class="identity-item">
            <div class="identity-icon">👤</div>
            <div class="identity-label">Anonymous</div>
            <div class="identity-count">${identityModes?.anonymous || 0}</div>
          </div>
          <div class="identity-item">
            <div class="identity-icon">🎭</div>
            <div class="identity-label">Alias</div>
            <div class="identity-count">${identityModes?.pseudonymous || 0}</div>
          </div>
          <div class="identity-item">
            <div class="identity-icon">😊</div>
            <div class="identity-label">Real Name</div>
            <div class="identity-count">${identityModes?.identified || 0}</div>
          </div>
        </div>
      </div>

      <div class="analytics-chart-card">
        <h3 class="chart-title">Top Keywords</h3>
        <div class="keyword-cloud">
          ${(keywords || []).length > 0 ?
            keywords.map((k, i) => {
              const size = Math.max(12, 20 - i * 1.2);
              const opacity = Math.max(0.6, 1 - i * 0.04);
              return `<span class="keyword-tag" style="font-size: ${size}px; opacity: ${opacity};">${k.word} (${k.count})</span>`;
            }).join('') 
            : '<div class="no-keywords">No keywords detected yet</div>'
          }
        </div>
      </div>
    </div>

    ${topContributors && topContributors.length > 0 ? `
    <div class="analytics-contributors">
      <div class="analytics-chart-card">
        <h3 class="chart-title">Top Contributors</h3>
        <div class="contributors-list">
          ${topContributors.slice(0, 5).map((c, i) => `
            <div class="contributor-item">
              <div class="contributor-rank">#${i + 1}</div>
              <div class="contributor-name">${c.displayName || c.alias || 'Anonymous'}</div>
              <div class="contributor-count">${c.messageCount || 0} msgs</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
    ` : ''}
  `;

  setTimeout(() => initializeCharts(analytics), 100);
}

function initializeCharts(analytics) {
  const { messagesByType, identityModes, timeline } = analytics;
  
  if (window.chartInstances) {
    Object.values(window.chartInstances).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
  }
  window.chartInstances = {};

  const typeCtx = document.getElementById('type-chart')?.getContext('2d');
  if (typeCtx) {
    window.chartInstances.typeChart = new Chart(typeCtx, {
      type: 'doughnut',
      data: {
        labels: ['Questions', 'Comments', 'Confusion'],
        datasets: [{
          data: [
            messagesByType?.QUESTION || 0,
            messagesByType?.COMMENT || 0,
            messagesByType?.CONFUSION || 0
          ],
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 12,
              font: { size: 11 }
            }
          }
        }
      }
    });
  }

  const timelineCtx = document.getElementById('timeline-chart')?.getContext('2d');
  if (timelineCtx && timeline?.length > 0) {
    window.chartInstances.timelineChart = new Chart(timelineCtx, {
      type: 'line',
      data: {
        labels: timeline.map(d => d.time),
        datasets: [{
          label: 'Messages',
          data: timeline.map(d => d.count),
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.15)',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#667eea'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { 
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.1)' },
            ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-secondary') || '#9ca3af' }
          },
          x: {
            grid: { display: false },
            ticks: { 
              color: getComputedStyle(document.body).getPropertyValue('--text-secondary') || '#9ca3af',
              maxRotation: 45
            }
          }
        }
      }
    });
  }

  const identityCtx = document.getElementById('identity-chart')?.getContext('2d');
  if (identityCtx) {
    window.chartInstances.identityChart = new Chart(identityCtx, {
      type: 'bar',
      data: {
        labels: ['Anonymous', 'Alias', 'Real Name'],
        datasets: [{
          data: [
            identityModes?.anonymous || 0,
            identityModes?.pseudonymous || 0,
            identityModes?.identified || 0
          ],
          backgroundColor: ['#6b7280', '#667eea', '#10b981'],
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { 
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.1)' },
            ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-secondary') || '#9ca3af' }
          },
          x: {
            grid: { display: false },
            ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-secondary') || '#9ca3af' }
          }
        }
      }
    });
  }
}

function closeAnalyticsModal() {
  var modal = document.getElementById('analytics-modal');
  if (modal) modal.classList.remove('show');
}
window.closeAnalyticsModal = closeAnalyticsModal;

// Footer Close button
var closeBtn = document.getElementById('close-analytics-btn');
if (closeBtn) closeBtn.addEventListener('click', closeAnalyticsModal);

// Corner ✕ button (always visible, mobile-friendly)
var closeX = document.getElementById('close-analytics-x');
if (closeX) closeX.addEventListener('click', closeAnalyticsModal);

// Backdrop click — only when the click lands on the overlay itself, not a child
var analyticsModal = document.getElementById('analytics-modal');
if (analyticsModal) {
  analyticsModal.addEventListener('click', function (e) {
    if (e.target === analyticsModal) closeAnalyticsModal();
  });
}

// Escape key (desktop) — handle both modern `key` and legacy `keyCode`
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
    var m = document.getElementById('analytics-modal');
    if (m && m.classList.contains('show')) closeAnalyticsModal();
  }
});

async function endSession(sessionId) {
  if (!confirm('Are you sure you want to end this session?'))
    return;

  try {
    const response = await fetch(`/api/sessions/${sessionId}/end`, {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      showAlert('Session ended successfully', 'success');
      loadSessions();
    } else {
      showAlert(result.message, 'error');
    }
  } catch (error) {
    showAlert('Error ending session', 'error');
  }
}

async function activateSession(sessionId) {
  if (!confirm('Start this session now? Students will be able to join and chat.')) return;
  try {
    const response = await fetch('/api/sessions/' + sessionId + '/activate', {
      method: 'POST',
      credentials: 'include'
    });
    const result = await response.json();
    if (result.success) {
      showAlert('Session is now active!', 'success');
      loadSessions();
    } else {
      showAlert(result.message || 'Failed to activate session', 'error');
    }
  } catch (error) {
    showAlert('Error activating session', 'error');
  }
}

function exportToCSV() {
  const sessionId = currentAnalyticsSessionId;

  if (!sessionId) {
    alert('No session selected for export');
    return;
  }

  const btn = document.querySelector('.export-csv-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = 'Exporting...';
  btn.disabled = true;

  fetch(`/api/analytics/export/${sessionId}`, {
    method: 'GET',
    credentials: 'include'
  })
    .then(response => {
      if (!response.ok) throw new Error('Export failed');
      return response.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session_analytics_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert('Analytics exported successfully!');
      btn.innerHTML = originalText;
      btn.disabled = false;
    })
    .catch(error => {
      console.error('CSV export error:', error);
      alert('Failed to export CSV');
      btn.innerHTML = originalText;
      btn.disabled = false;
    });
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
});

function showAlert(message, type) {
  const container = document.getElementById('alert-container');
  container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => container.innerHTML = '', 5000);
}

async function generateAISummary() {
  var sessionId = currentAnalyticsSessionId;
  if (!sessionId) { alert('No session selected'); return; }

  var btn = document.getElementById('ai-summary-btn');
  var originalText = btn.innerHTML;
  btn.innerHTML = '⏳ Generating...';
  btn.disabled = true;

  try {
    var response = await fetch('/api/analytics/ai-summary/' + sessionId, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to generate summary');
    var result = await response.json();
    if (!result.success) throw new Error(result.message || 'Summary generation failed');

    var summary = result.summary;
    var modalHtml = '<div id="ai-summary-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;">';
    modalHtml += '<div style="background:var(--card-bg,#ffffff);border-radius:16px;max-width:800px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">';

    modalHtml += '<div style="padding:24px 28px;border-bottom:1px solid var(--border-color,#e5e7eb);display:flex;justify-content:space-between;align-items:center;">';
    modalHtml += '<div>';
    modalHtml += '<h2 style="margin:0;font-size:20px;color:var(--text-color);">Session Summary</h2>';
    modalHtml += '<p style="margin:4px 0 0;font-size:12px;color:var(--text-secondary);">Generated: ' + new Date(summary.generatedAt).toLocaleString();
    if (summary.aiSummaryGenerated) {
      modalHtml += ' <span style="background:#8b5cf6;color:white;padding:2px 8px;border-radius:10px;font-size:10px;margin-left:8px;">AI Enhanced</span>';
    } else if (summary.aiEnabled === false) {
      modalHtml += ' <span style="background:#6b7280;color:white;padding:2px 8px;border-radius:10px;font-size:10px;margin-left:8px;">Statistical Analysis</span>';
    }
    modalHtml += '</p>';
    modalHtml += '</div>';
    modalHtml += '<button onclick="document.getElementById(\'ai-summary-overlay\').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--text-secondary);padding:4px 8px;">×</button>';
    modalHtml += '</div>';

    modalHtml += '<div style="padding:24px 28px;">';

    modalHtml += '<div style="padding:16px;background:rgba(59,130,246,0.08);border-left:4px solid #3b82f6;border-radius:0 10px 10px 0;margin-bottom:20px;font-size:14px;line-height:1.7;color:var(--text-color);">';
    modalHtml += summary.overview;
    modalHtml += '</div>';

    if (summary.stats) {
      modalHtml += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">';
      var statItems = [
        { label: 'Messages', value: summary.stats.totalMessages },
        { label: 'Contributors', value: summary.stats.uniqueContributors + '/' + summary.stats.totalMembers },
        { label: 'Participation', value: summary.stats.participationRate + '%' },
        { label: 'Duration', value: summary.stats.durationMinutes + ' min' },
        { label: 'Msg/Min', value: summary.stats.messagesPerMinute },
        { label: 'Session', value: summary.sessionTitle }
      ];
      statItems.forEach(function(s) {
        modalHtml += '<div style="background:var(--card-bg,var(--bg-secondary,#f3f4f6));border:1px solid var(--border-color,#e5e7eb);border-radius:10px;padding:12px;text-align:center;">';
        modalHtml += '<div style="font-size:20px;font-weight:700;color:var(--text-color);">' + s.value + '</div>';
        modalHtml += '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">' + s.label + '</div>';
        modalHtml += '</div>';
      });
      modalHtml += '</div>';
    }

    if (summary.sections && summary.sections.length > 0) {
      summary.sections.forEach(function(section) {
        var isRecommendation = section.title === 'Recommendations';
        var isAI = section.isAIGenerated;
        var borderColor = isAI ? '#8b5cf6' : (isRecommendation ? '#f59e0b' : (section.title === 'Areas of Confusion' ? '#ef4444' : 'var(--border-color,#e5e7eb)'));
        var bgColor = isAI ? 'rgba(139,92,246,0.08)' : (isRecommendation ? 'rgba(245,158,11,0.06)' : (section.title === 'Areas of Confusion' ? 'rgba(239,68,68,0.06)' : 'transparent'));

        modalHtml += '<div style="margin-bottom:16px;padding:14px 16px;border:1px solid ' + borderColor + ';border-radius:10px;background:' + bgColor + ';">';
        modalHtml += '<h4 style="margin:0 0 8px;font-size:14px;font-weight:600;color:var(--text-color);">';
        if (isAI) modalHtml += '🤖 ';
        else if (section.title === 'Engagement Pattern') modalHtml += '📊 ';
        else if (section.title === 'Message Classification Breakdown') modalHtml += '💬 ';
        else if (section.title === 'Areas of Confusion') modalHtml += '😕 ';
        else if (section.title === 'Key Questions Raised') modalHtml += '❓ ';
        else if (section.title === 'Discussion Topics') modalHtml += '🏷️ ';
        else if (section.title === 'Identity Mode Usage') modalHtml += '🔒 ';
        else if (section.title === 'Recommendations') modalHtml += '💡 ';
        modalHtml += section.title;
        if (isAI) modalHtml += ' <span style="font-size:10px;background:#8b5cf6;color:white;padding:2px 6px;border-radius:4px;margin-left:6px;">AI</span>';
        modalHtml += '</h4>';
        modalHtml += '<p style="margin:0;font-size:13px;line-height:1.7;color:var(--text-color);">' + section.content + '</p>';
        modalHtml += '</div>';
      });
    }

    modalHtml += '</div>';

    modalHtml += '<div style="padding:16px 28px;border-top:1px solid var(--border-color,#e5e7eb);display:flex;justify-content:flex-end;gap:10px;">';
    modalHtml += '<button onclick="copyAISummary()" class="btn btn-secondary btn-small">📋 Copy to Clipboard</button>';
    modalHtml += '<button onclick="document.getElementById(\'ai-summary-overlay\').remove()" class="btn btn-primary btn-small">Close</button>';
    modalHtml += '</div>';

    modalHtml += '</div></div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);

  } catch (error) {
    alert('Error generating summary: ' + error.message);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

function copyAISummary() {
  var overlay = document.getElementById('ai-summary-overlay');
  if (!overlay) return;
  var textParts = [];
  overlay.querySelectorAll('h2, h4, p, div').forEach(function(el) {
    var text = el.textContent.trim();
    if (text && text.length > 10 && el.tagName !== 'DIV') {
      textParts.push(text);
    }
  });
  var uniqueText = [];
  textParts.forEach(function(t) {
    if (uniqueText.indexOf(t) === -1) uniqueText.push(t);
  });
  navigator.clipboard.writeText(uniqueText.join('\n\n')).then(function() {
    alert('Summary copied to clipboard!');
  }).catch(function() {
    alert('Failed to copy. Please select and copy manually.');
  });
}

init();