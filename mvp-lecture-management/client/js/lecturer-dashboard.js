let currentUser = null;
let sessions = [];
let currentAnalyticsSessionId = null;

// Initialize
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

// Load sessions
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

// Display sessions 
function displaySessions(sessions) {
  const container = document.getElementById('sessions-list');
  container.innerHTML = sessions.map(session => `
    <div class="session-card">
      <div class="session-title">${session.title}</div>
      <div class="session-meta">
        <div class="session-meta-item">
          📚 ${session.moduleCode || 'No module'}
        </div>
        <div class="session-meta-item">
          🔑 Join Code: <span class="session-code">${session.joinCode}</span>
        </div>
        <div class="session-meta-item">
          <span class="session-status status-${session.status}">${session.status}</span>
        </div>
      </div>
      <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-primary btn-small" onclick="viewSessionChat('${session._id || session.id}', '${session.title}')">
          💬 Join Chat
        </button>
        <button class="btn btn-secondary btn-small" onclick="openManageStudentsModal('${session._id || session.id}', '${session.title.replace(/'/g, "\\'")}', '${session.joinCode}')">
        👥 Manage Students
        </button>
        <button class="btn btn-secondary btn-small" onclick="viewAnalytics('${session._id || session.id}', '${session.title}')">
          📊 Analytics
        </button>
        ${session.status === 'active' ? `
          <button class="btn btn-danger btn-small" onclick="endSession('${session._id || session.id}')">
            End Session
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// NEW FUNCTION - Join chat as lecturer
function viewSessionChat(sessionId, title) {
  window.location.href = `/chat-room.html?sessionId=${sessionId}`;
}

// Create session modal
document.getElementById('create-session-btn').addEventListener('click', () => {
  document.getElementById('create-modal').classList.add('show');
});

document.getElementById('cancel-btn').addEventListener('click', () => {
  document.getElementById('create-modal').classList.remove('show');
  document.getElementById('create-session-form').reset();
});

// Create session
document.getElementById('create-session-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    title: document.getElementById('title').value,
    moduleCode: document.getElementById('moduleCode').value,
    description: document.getElementById('description').value
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

// View analytics
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
        <h3 style="color: var(--danger-color);">⚠️ Error Loading Analytics</h3>
        <p style="margin-top: 12px;">${error.message}</p>
        <p style="color: var(--text-secondary); margin-top: 12px;">Please try again or contact support if the issue persists.</p>
      </div>`;
  }
}

// Display analytics
function displayAnalytics(analytics) {
  const container = document.getElementById('analytics-content');

  if (!analytics || !analytics.summary) {
    container.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-color);">
      <p>No analytics data available yet. Send some messages first!</p>
    </div>`;
    return;
  }

  container.innerHTML = `
    <div class="analytics-grid">
      <div class="stat-card">
        <div class="stat-label">Total Messages</div>
        <div class="stat-value">${analytics.summary.totalMessages || 0}</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #10b981, #059669);">
        <div class="stat-label">Active Users</div>
        <div class="stat-value">${analytics.summary.activeUsers || 0}/${analytics.summary.totalMembers || 0}</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
        <div class="stat-label">Participation Rate</div>
        <div class="stat-value">${analytics.summary.participationRate || 0}%</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px;">
      <div class="analytics-chart-card">
        <h3 style="margin-bottom: 16px; color: var(--text-color);">Messages by Type</h3>
        <canvas id="type-chart"></canvas>
      </div>
      <div class="analytics-chart-card">
        <h3 style="margin-bottom: 16px; color: var(--text-color);">Timeline</h3>
        <canvas id="timeline-chart"></canvas>
      </div>
    </div>

    <div class="analytics-table-card">
      <h3 style="margin-bottom: 16px; color: var(--text-color);">Top Contributors</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid var(--border-color);">
            <th style="text-align: left; padding: 12px; color: var(--text-color);">Name</th>
            <th style="text-align: left; padding: 12px; color: var(--text-color);">Email</th>
            <th style="text-align: right; padding: 12px; color: var(--text-color);">Messages</th>
          </tr>
        </thead>
        <tbody>
          ${(analytics.topContributors || []).map(c => `
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 12px; color: var(--text-color);">${c.displayName || 'Anonymous'}</td>
              <td style="padding: 12px; color: var(--text-secondary);">${c.email || 'N/A'}</td>
              <td style="padding: 12px; text-align: right; font-weight: 600; color: var(--text-color);">${c.messageCount || 0}</td>
            </tr>
          `).join('')}
          ${(analytics.topContributors || []).length === 0 ? '<tr><td colspan="3" style="padding: 20px; text-align: center; color: var(--text-secondary);">No contributors yet</td></tr>' : ''}
        </tbody>
      </table>
    </div>
  `;

  if (analytics.messagesByType) {
    createTypeChart(analytics.messagesByType);
  }
  if (analytics.timeline) {
    createTimelineChart(analytics.timeline);
  }
}

// Create charts
function createTypeChart(data) {
  const ctx = document.getElementById('type-chart').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Questions', 'Comments', 'Confusion'],
      datasets: [{
        data: [data.QUESTION || 0, data.COMMENT || 0, data.CONFUSION || 0],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

function createTimelineChart(data) {
  const ctx = document.getElementById('timeline-chart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.time.split(' ')[1]),
      datasets: [{
        label: 'Messages',
        data: data.map(d => d.count),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// Close analytics
document.getElementById('close-analytics-btn').addEventListener('click', () => {
  document.getElementById('analytics-modal').classList.remove('show');
});

// End session
async function endSession(sessionId) {
  if (!confirm('Are you sure you want to end this session?')) return;

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

// Export CSV
function exportToCSV() {
  const sessionId = currentAnalyticsSessionId;

  if (!sessionId) {
    alert('No session selected for export');
    return;
  }

  const btn = document.querySelector('.export-csv-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '⏳ Exporting...';
  btn.disabled = true;

  fetch(`/api/analytics/export-csv/${sessionId}`, {
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

      alert('✅ Analytics exported successfully!');
      btn.innerHTML = originalText;
      btn.disabled = false;
    })
    .catch(error => {
      console.error('CSV export error:', error);
      alert('❌ Failed to export CSV');
      btn.innerHTML = originalText;
      btn.disabled = false;
    });
}

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
});

function showAlert(message, type) {
  const container = document.getElementById('alert-container');
  container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => container.innerHTML = '', 5000);
}

// Initialize
init();