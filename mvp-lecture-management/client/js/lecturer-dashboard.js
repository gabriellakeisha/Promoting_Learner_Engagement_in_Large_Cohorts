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
        ${session.status === 'active' ? `
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
        <h3 style="color: var(--danger-color);">⚠️ Error Loading Analytics</h3>
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

  const consumersCount = summary.consumersCount || (summary.totalMembers - summary.activeUsers) || 0;
  const confRate = confusionRate || (summary.totalMessages > 0 ? ((messagesByType?.CONFUSION || 0) / summary.totalMessages * 100).toFixed(1) : 0);
  const questRate = questionRate || (summary.totalMessages > 0 ? ((messagesByType?.QUESTION || 0) / summary.totalMessages * 100).toFixed(1) : 0);

  container.innerHTML = `
    <div class="analytics-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
      <div class="stat-card" style="background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 12px; padding: 20px; color: white;">
        <div class="stat-label" style="font-size: 12px; opacity: 0.9;">Total Messages</div>
        <div class="stat-value" style="font-size: 32px; font-weight: 700;">${summary.totalMessages || 0}</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #10b981, #059669); border-radius: 12px; padding: 20px; color: white;">
        <div class="stat-label" style="font-size: 12px; opacity: 0.9;">Contributors / Total</div>
        <div class="stat-value" style="font-size: 32px; font-weight: 700;">${summary.activeUsers || 0}/${summary.totalMembers || 0}</div>
        <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">${consumersCount} consumers (read only)</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 12px; padding: 20px; color: white;">
        <div class="stat-label" style="font-size: 12px; opacity: 0.9;">Participation Rate</div>
        <div class="stat-value" style="font-size: 32px; font-weight: 700;">${summary.participationRate || 0}%</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 12px; padding: 20px; color: white;">
        <div class="stat-label" style="font-size: 12px; opacity: 0.9;">Messages/Minute</div>
        <div class="stat-value" style="font-size: 32px; font-weight: 700;">${summary.messagesPerMinute || 0}</div>
        <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">Last 5 min: ${summary.messagesLast5Min || 0}</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
      <div class="indicator-card" style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border-left: 4px solid #ef4444;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 14px; color: var(--text-secondary);">😕 Confusion Rate</div>
            <div style="font-size: 28px; font-weight: 700; color: ${parseFloat(confRate) > 20 ? '#ef4444' : 'var(--text-color)'};">${confRate}%</div>
          </div>
          <div style="font-size: 48px;">😕</div>
        </div>
        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
          ${parseFloat(confRate) > 20 ? '⚠️ High confusion - consider clarifying recent topics' : '✅ Normal confusion levels'}
        </div>
      </div>
      <div class="indicator-card" style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border-left: 4px solid #3b82f6;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 14px; color: var(--text-secondary);">❓ Question Rate</div>
            <div style="font-size: 28px; font-weight: 700; color: var(--text-color);">${questRate}%</div>
          </div>
          <div style="font-size: 48px;">❓</div>
        </div>
        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
          ${messagesByType?.QUESTION || 0} questions asked during session
        </div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-bottom: 24px;">
      <div class="analytics-chart-card" style="background: var(--bg-secondary); border-radius: 12px; padding: 20px;">
        <h3 style="margin-bottom: 16px; color: var(--text-color); font-size: 16px;">📈 Engagement Over Time</h3>
        <div style="height: 200px; max-height: 200px;">
          <canvas id="timeline-chart"></canvas>
        </div>
        ${peakActivity ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 12px;">
          🔥 Peak activity: <strong>${peakActivity.time}</strong> (${peakActivity.count} messages)
        </div>` : ''}
      </div>
      
      <div class="analytics-chart-card" style="background: var(--bg-secondary); border-radius: 12px; padding: 20px;">
        <h3 style="margin-bottom: 16px; color: var(--text-color); font-size: 16px;">📊 Message Types</h3>
        <div style="height: 200px; max-height: 200px;">
          <canvas id="type-chart"></canvas>
        </div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
      <div class="analytics-chart-card" style="background: var(--bg-secondary); border-radius: 12px; padding: 20px;">
        <h3 style="margin-bottom: 16px; color: var(--text-color); font-size: 16px;">🔒 Identity Mode Usage</h3>
        <div style="height: 150px; max-height: 150px;">
          <canvas id="identity-chart"></canvas>
        </div>
        <div style="display: flex; justify-content: space-around; margin-top: 16px; font-size: 12px;">
          <div style="text-align: center;">
            <div style="font-size: 20px;">👤</div>
            <div style="color: var(--text-secondary);">Anonymous</div>
            <div style="font-weight: 700; color: var(--text-color);">${identityModes?.anonymous || 0}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 20px;">🎭</div>
            <div style="color: var(--text-secondary);">Alias</div>
            <div style="font-weight: 700; color: var(--text-color);">${identityModes?.pseudonymous || 0}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 20px;">😊</div>
            <div style="color: var(--text-secondary);">Real Name</div>
            <div style="font-weight: 700; color: var(--text-color);">${identityModes?.identified || 0}</div>
          </div>
        </div>
      </div>

      <div class="analytics-chart-card" style="background: var(--bg-secondary); border-radius: 12px; padding: 20px;">
        <h3 style="margin-bottom: 16px; color: var(--text-color); font-size: 16px;">🔤 Top Keywords</h3>
        <div id="keyword-cloud" style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 220px; overflow-y: auto;">
          ${(keywords || []).length > 0 ? 
            keywords.map((k, i) => {
              const size = Math.max(12, 24 - i * 1.5);
              const opacity = Math.max(0.6, 1 - i * 0.04);
              return `<span style="
                padding: 6px 14px;
                background: linear-gradient(135deg, rgba(102, 126, 234, ${opacity}), rgba(118, 75, 162, ${opacity}));
                color: #ffffff;
                border-radius: 16px;
                font-size: ${size}px;
                font-weight: ${i < 3 ? '600' : '500'};
                text-shadow: 0 1px 2px rgba(0,0,0,0.2);
              ">${k.word} <small style="opacity: 0.85;">(${k.count})</small></span>`;
            }).join('') :
            '<p style="color: var(--text-secondary); text-align: center; width: 100%;">No keywords yet</p>'
          }
        </div>
      </div>
    </div>

    <div class="analytics-table-card" style="background: var(--bg-secondary); border-radius: 12px; padding: 20px;">
      <h3 style="margin-bottom: 16px; color: var(--text-color); font-size: 16px;">🏆 Top 5 Student Contributors</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid var(--border-color);">
            <th style="text-align: left; padding: 12px; color: var(--text-color); font-size: 13px;">Rank</th>
            <th style="text-align: left; padding: 12px; color: var(--text-color); font-size: 13px;">Name</th>
            <th style="text-align: left; padding: 12px; color: var(--text-color); font-size: 13px;">Email</th>
            <th style="text-align: right; padding: 12px; color: var(--text-color); font-size: 13px;">Messages</th>
          </tr>
        </thead>
        <tbody>
          ${(topContributors || []).map((c, i) => `
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 12px; color: var(--text-color);">
                ${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </td>
              <td style="padding: 12px; color: var(--text-color); font-weight: 500;">${c.displayName || 'Anonymous'}</td>
              <td style="padding: 12px; color: var(--text-secondary); font-size: 13px;">${c.email || 'N/A'}</td>
              <td style="padding: 12px; text-align: right; font-weight: 600; color: #667eea;">${c.messageCount || 0}</td>
            </tr>
          `).join('')}
          ${(topContributors || []).length === 0 ? 
            '<tr><td colspan="4" style="padding: 20px; text-align: center; color: var(--text-secondary);">No student contributors yet</td></tr>' : ''}
        </tbody>
      </table>
    </div>
  `;

  createEnhancedCharts(analytics);
}

let chartInstances = {};

function createEnhancedCharts(analytics) {
  const { messagesByType, identityModes, timeline } = analytics;

  if (chartInstances.typeChart) chartInstances.typeChart.destroy();
  if (chartInstances.timelineChart) chartInstances.timelineChart.destroy();
  if (chartInstances.identityChart) chartInstances.identityChart.destroy();

  const typeCtx = document.getElementById('type-chart')?.getContext('2d');
  if (typeCtx) {
    chartInstances.typeChart = new Chart(typeCtx, {
      type: 'doughnut',
      data: {
        labels: ['❓ Questions', '💬 Comments', '😕 Confusion'],
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
        plugins: {
          legend: { 
            position: 'bottom',
            labels: { 
              color: getComputedStyle(document.body).getPropertyValue('--text-color') || '#fff',
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
    chartInstances.timelineChart = new Chart(timelineCtx, {
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
    chartInstances.identityChart = new Chart(identityCtx, {
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