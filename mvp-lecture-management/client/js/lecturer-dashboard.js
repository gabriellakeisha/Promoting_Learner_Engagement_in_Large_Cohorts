let currentUser = null;
let sessions = [];

// Initialize
async function init() {
  try {
    // Check auth
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
      <div style="margin-top: 16px; display: flex; gap: 8px;">
        <button class="btn btn-primary btn-small" onclick="viewAnalytics('${session.id}', '${session.title}')">
          📊 View Analytics
        </button>
        ${session.status === 'active' ? `
          <button class="btn btn-danger btn-small" onclick="endSession('${session.id}')">
            End Session
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// Create session modal - FIXED
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

// View analytics - FIXED
async function viewAnalytics(sessionId, title) {
  document.getElementById('analytics-modal').classList.add('show');
  document.getElementById('analytics-title').textContent = `Analytics: ${title}`;
  document.getElementById('analytics-content').innerHTML = '<div class="spinner"></div>';
  
  try {
    const response = await fetch(`/api/analytics/lecturer/${sessionId}`);
    const result = await response.json();
    
    if (result.success) {
      displayAnalytics(result.analytics);
    } else {
      document.getElementById('analytics-content').innerHTML = 
        '<p style="color: var(--danger-color);">Error loading analytics</p>';
    }
  } catch (error) {
    document.getElementById('analytics-content').innerHTML = 
      '<p style="color: var(--danger-color);">Error loading analytics</p>';
  }
}

// Display analytics
function displayAnalytics(analytics) {
  const container = document.getElementById('analytics-content');
  
  container.innerHTML = `
    <!-- Summary Cards -->
    <div class="analytics-grid">
      <div class="stat-card">
        <div class="stat-label">Total Messages</div>
        <div class="stat-value">${analytics.summary.totalMessages}</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #10b981, #059669);">
        <div class="stat-label">Active Users</div>
        <div class="stat-value">${analytics.summary.activeUsers}/${analytics.summary.totalMembers}</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
        <div class="stat-label">Participation Rate</div>
        <div class="stat-value">${analytics.summary.participationRate}%</div>
      </div>
    </div>

    <!-- Charts -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px;">
      <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h3 style="margin-bottom: 16px;">Messages by Type</h3>
        <canvas id="type-chart"></canvas>
      </div>
      <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h3 style="margin-bottom: 16px;">Timeline</h3>
        <canvas id="timeline-chart"></canvas>
      </div>
    </div>

    <!-- Top Contributors -->
    <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-top: 24px;">
      <h3 style="margin-bottom: 16px;">Top Contributors</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid var(--border-color);">
            <th style="text-align: left; padding: 12px;">Name</th>
            <th style="text-align: left; padding: 12px;">Email</th>
            <th style="text-align: right; padding: 12px;">Messages</th>
          </tr>
        </thead>
        <tbody>
          ${analytics.topContributors.map(c => `
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 12px;">${c.displayName}</td>
              <td style="padding: 12px; color: var(--text-secondary);">${c.email}</td>
              <td style="padding: 12px; text-align: right; font-weight: 600;">${c.messageCount}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  // Create charts
  createTypeChart(analytics.messagesByType);
  createTimelineChart(analytics.timeline);
}

// Create type chart
function createTypeChart(data) {
  const ctx = document.getElementById('type-chart').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Questions', 'Comments', 'Confusion'],
      datasets: [{
        data: [data.QUESTION, data.COMMENT, data.CONFUSION],
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

// Create timeline chart
function createTimelineChart(data) {
  const ctx = document.getElementById('timeline-chart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.time.split(' ')[1]), // Extract time only
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

// Close analytics - FIXED
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
