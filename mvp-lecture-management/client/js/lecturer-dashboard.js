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
        ${session.status === 'active' ?
          `
          <button class="btn btn-danger btn-small" onclick="endSession('${session._id || session.id}')">
            End Session
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
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
});

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

  container.innerHTML = `
    <div class="analytics-stats-row">
      <div class="analytics-stat-card stat-orange">
        <div class="stat-label">Total Messages</div>
        <div class="stat-value">${summary.totalMessages || 0}</div>
      </div>
      <div class="analytics-stat-card stat-green">
        <div class="stat-label">Contributors / Total</div>
        <div class="stat-value">${summary.activeUsers || 0}/${summary.totalMembers || 0}</div>
        <div class="stat-sub">${consumersCount} consumers (read only)</div>
      </div>
      <div class="analytics-stat-card stat-orange">
        <div class="stat-label">Participation Rate</div>
        <div class="stat-value">${Math.min(100, summary.participationRate || 0)}%</div>
      </div>
      <div class="analytics-stat-card stat-green">
        <div class="stat-label">Messages/Minute</div>
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

document.getElementById('close-analytics-btn').addEventListener('click', () => {
  document.getElementById('analytics-modal').classList.remove('show');
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

init();