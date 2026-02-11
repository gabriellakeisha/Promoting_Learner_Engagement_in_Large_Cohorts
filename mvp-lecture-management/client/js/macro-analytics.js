var macroChartInstances = {};

async function loadMacroDashboard(moduleFilter) {
  var container = document.getElementById('macro-dashboard-content');
  if (!container) return;
  container.innerHTML = '<div class="spinner" style="margin:20px auto;"></div>';

  try {
    var url = '/api/analytics/macro';
    if (moduleFilter) url += '?module=' + encodeURIComponent(moduleFilter);

    var response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to load analytics');
    var result = await response.json();
    if (!result.success) throw new Error('Server error');

    var sessions = result.sessions || [];
    var modules = result.modules || [];

    var filterHtml = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap;">' +
      '<label style="font-size:13px;color:var(--text-secondary);">Filter by module:</label>' +
      '<select id="macro-module-filter" onchange="loadMacroDashboard(this.value)" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border-color);background:var(--input-bg,#1e293b);color:var(--text-color);font-size:13px;">' +
      '<option value="">All Modules</option>';
    modules.forEach(function(m) {
      var selected = (moduleFilter === m) ? ' selected' : '';
      filterHtml += '<option value="' + m + '"' + selected + '>' + m + '</option>';
    });
    filterHtml += '</select>' +
      '<span style="font-size:12px;color:var(--text-secondary);">' + sessions.length + ' session(s)</span></div>';

    if (sessions.length === 0) {
      container.innerHTML = filterHtml +
        '<p style="text-align:center;color:var(--text-secondary);padding:30px;">No session data available' +
        (moduleFilter ? ' for ' + moduleFilter : '') + '.</p>';
      return;
    }

    var totalMsgs = sessions.reduce(function(s, x) { return s + x.totalMessages; }, 0);
    var totalStudents = sessions.reduce(function(s, x) { return s + x.totalMembers; }, 0);
    var avgParticipation = (sessions.reduce(function(s, x) { return s + parseFloat(x.participationRate); }, 0) / sessions.length).toFixed(1);
    var avgConfusion = (sessions.reduce(function(s, x) { return s + parseFloat(x.confusionRate); }, 0) / sessions.length).toFixed(1);

    container.innerHTML = filterHtml + `
      <div class="analytics-stats-row" style="margin-bottom:24px;">
        <div class="analytics-stat-card stat-orange">
          <div class="stat-label">Total Messages</div>
          <div class="stat-value">${totalMsgs}</div>
          <div class="stat-sub">Across ${sessions.length} sessions</div>
        </div>
        <div class="analytics-stat-card stat-green">
          <div class="stat-label">Total Students</div>
          <div class="stat-value">${totalStudents}</div>
        </div>
        <div class="analytics-stat-card stat-orange">
          <div class="stat-label">Avg Participation</div>
          <div class="stat-value">${avgParticipation}%</div>
        </div>
        <div class="analytics-stat-card stat-green">
          <div class="stat-label">Avg Confusion</div>
          <div class="stat-value">${avgConfusion}%</div>
        </div>
      </div>

      <div class="analytics-charts-row" style="margin-bottom:24px;">
        <div class="analytics-chart-card chart-wide">
          <h3 class="chart-title">Engagement Across Sessions</h3>
          <div class="chart-container" style="height:240px;">
            <canvas id="macro-engagement-chart"></canvas>
          </div>
        </div>
        <div class="analytics-chart-card chart-narrow">
          <h3 class="chart-title">Overall Message Types</h3>
          <div class="chart-container" style="height:240px;">
            <canvas id="macro-type-chart"></canvas>
          </div>
        </div>
      </div>

      <div class="analytics-bottom-row" style="margin-bottom:24px;">
        <div class="analytics-chart-card">
          <h3 class="chart-title">Participation Rate Trend</h3>
          <div class="chart-container-small" style="height:180px;">
            <canvas id="macro-participation-chart"></canvas>
          </div>
        </div>
        <div class="analytics-chart-card">
          <h3 class="chart-title">Confusion Rate Trend</h3>
          <div class="chart-container-small" style="height:180px;">
            <canvas id="macro-confusion-chart"></canvas>
          </div>
        </div>
      </div>

      <div class="analytics-chart-card">
        <h3 class="chart-title">Cross-Session Breakdown</h3>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="border-bottom:2px solid var(--border-color);text-align:left;">
                <th style="padding:10px;">Session</th>
                <th style="padding:10px;">Module</th>
                <th style="padding:10px;">Date</th>
                <th style="padding:10px;">Messages</th>
                <th style="padding:10px;">Participants</th>
                <th style="padding:10px;">Participation</th>
                <th style="padding:10px;">Confusion</th>
                <th style="padding:10px;">Questions</th>
              </tr>
            </thead>
            <tbody>
              ${sessions.map(function(s) {
                return '<tr style="border-bottom:1px solid var(--border-color);">' +
                  '<td style="padding:10px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + s.title + '</td>' +
                  '<td style="padding:10px;">' + (s.moduleCode || '-') + '</td>' +
                  '<td style="padding:10px;">' + new Date(s.date).toLocaleDateString() + '</td>' +
                  '<td style="padding:10px;">' + s.totalMessages + '</td>' +
                  '<td style="padding:10px;">' + s.activeUsers + '/' + s.totalMembers + '</td>' +
                  '<td style="padding:10px;">' + s.participationRate + '%</td>' +
                  '<td style="padding:10px;' + (parseFloat(s.confusionRate) > 20 ? 'color:#ef4444;font-weight:600;' : '') + '">' + s.confusionRate + '%</td>' +
                  '<td style="padding:10px;">' + s.questionRate + '%</td>' +
                '</tr>';
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    Object.values(macroChartInstances).forEach(function(c) { if (c && c.destroy) c.destroy(); });
    macroChartInstances = {};

    var labels = sessions.map(function(s) {
      return s.title.length > 18 ? s.title.substring(0, 18) + '...' : s.title;
    });
    var tickColor = getComputedStyle(document.body).getPropertyValue('--text-secondary') || '#9ca3af';

    var engCtx = document.getElementById('macro-engagement-chart');
    if (engCtx) {
      macroChartInstances.engagement = new Chart(engCtx.getContext('2d'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            { label: 'Questions', data: sessions.map(function(s){ return s.questions; }), backgroundColor: '#3b82f6', borderRadius: 4 },
            { label: 'Comments', data: sessions.map(function(s){ return s.comments; }), backgroundColor: '#10b981', borderRadius: 4 },
            { label: 'Confusion', data: sessions.map(function(s){ return s.confusion; }), backgroundColor: '#f59e0b', borderRadius: 4 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 } } } },
          scales: {
            x: { stacked: true, grid: { display: false }, ticks: { color: tickColor, maxRotation: 45 } },
            y: { stacked: true, beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: tickColor } }
          }
        }
      });
    }

    var totalQ = sessions.reduce(function(s, x) { return s + x.questions; }, 0);
    var totalC = sessions.reduce(function(s, x) { return s + x.comments; }, 0);
    var totalConf = sessions.reduce(function(s, x) { return s + x.confusion; }, 0);

    var typeCtx = document.getElementById('macro-type-chart');
    if (typeCtx) {
      macroChartInstances.types = new Chart(typeCtx.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Questions', 'Comments', 'Confusion'],
          datasets: [{ data: [totalQ, totalC, totalConf], backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'], borderWidth: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '60%',
          plugins: { legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 } } } }
        }
      });
    }

    var partCtx = document.getElementById('macro-participation-chart');
    if (partCtx) {
      macroChartInstances.participation = new Chart(partCtx.getContext('2d'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Participation %',
            data: sessions.map(function(s){ return parseFloat(s.participationRate); }),
            borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)',
            fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#10b981'
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: tickColor, maxRotation: 45 } },
            y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: tickColor, callback: function(v) { return v + '%'; } } }
          }
        }
      });
    }

    var confCtx = document.getElementById('macro-confusion-chart');
    if (confCtx) {
      macroChartInstances.confusion = new Chart(confCtx.getContext('2d'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Confusion %',
            data: sessions.map(function(s){ return parseFloat(s.confusionRate); }),
            borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)',
            fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#f59e0b'
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: tickColor, maxRotation: 45 } },
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: tickColor, callback: function(v) { return v + '%'; } } }
          }
        }
      });
    }

  } catch (error) {
    console.error('Macro dashboard error:', error);
    container.innerHTML = '<p style="text-align:center;color:#ef4444;padding:20px;">Failed to load semester analytics: ' + error.message + '</p>';
  }
}

loadMacroDashboard('');