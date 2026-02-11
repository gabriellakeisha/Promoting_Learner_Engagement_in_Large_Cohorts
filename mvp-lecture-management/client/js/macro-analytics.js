var macroChartInstances = {};

function generateInsight(sessions) {
  if (!sessions || sessions.length < 2) return '';
  var insights = [];

  var participations = sessions.map(function(s) { return Math.min(100, parseFloat(s.participationRate)); });
  var first = participations[0];
  var last = participations[participations.length - 1];
  var diff = last - first;
  if (Math.abs(diff) >= 5) {
    if (diff > 0) {
      insights.push('Participation has increased by ' + diff.toFixed(1) + '% from the first to the latest session, suggesting growing student engagement.');
    } else {
      insights.push('Participation has decreased by ' + Math.abs(diff).toFixed(1) + '% since the first session. Consider introducing new engagement strategies.');
    }
  }

  var highestConfusion = sessions.reduce(function(max, s) {
    return parseFloat(s.confusionRate) > parseFloat(max.confusionRate) ? s : max;
  }, sessions[0]);
  if (parseFloat(highestConfusion.confusionRate) > 15) {
    insights.push('"' + highestConfusion.title + '" had the highest confusion rate at ' + highestConfusion.confusionRate + '%. Review the topic delivery for this session.');
  }

  var lowestParticipation = sessions.reduce(function(min, s) {
    return parseFloat(s.participationRate) < parseFloat(min.participationRate) ? s : min;
  }, sessions[0]);
  if (parseFloat(lowestParticipation.participationRate) < 50 && sessions.length > 1) {
    insights.push('"' + lowestParticipation.title + '" had the lowest participation at ' + lowestParticipation.participationRate + '%. Consider what factors may have discouraged engagement.');
  }

  var totalQuestions = sessions.reduce(function(s, x) { return s + x.questions; }, 0);
  var totalConfusion = sessions.reduce(function(s, x) { return s + x.confusion; }, 0);
  if (totalQuestions > 0 && totalConfusion > 0) {
    var ratio = (totalQuestions / totalConfusion).toFixed(1);
    if (parseFloat(ratio) > 2) {
      insights.push('Students ask ' + ratio + 'x more questions than confusion signals, indicating active learning behaviour.');
    } else if (parseFloat(ratio) < 0.5) {
      insights.push('Confusion signals outnumber questions. Students may be struggling but not asking for help.');
    }
  }

  return insights.length > 0 ? insights.join(' ') : 'Collect more session data to generate cross-session insights.';
}

function renderConfusionTopics(confusionTopics) {
  if (!confusionTopics || confusionTopics.length === 0) {
    return '<p style="color:var(--text-secondary);text-align:center;padding:16px;">No confusion messages recorded yet. Confusion topics will appear here as students flag areas of difficulty.</p>';
  }

  var recurring = confusionTopics.filter(function(t) { return t.sessionCount > 1; });
  var all = confusionTopics.slice(0, 10);
  var html = '';

  if (recurring.length > 0) {
    html += '<div style="margin-bottom:16px;">';
    html += '<div style="font-size:13px;font-weight:600;color:#ef4444;margin-bottom:8px;">Recurring across multiple sessions:</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
    recurring.forEach(function(t) {
      html += '<div style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:8px 14px;font-size:13px;">';
      html += '<span style="font-weight:600;color:#ef4444;">' + t.word + '</span>';
      html += '<span style="color:var(--text-secondary);margin-left:6px;">(' + t.count + 'x in ' + t.sessionCount + ' sessions)</span>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
  all.forEach(function(t) {
    var opacity = Math.max(0.5, Math.min(1, t.count / 5));
    html += '<span style="background:rgba(245,158,11,' + (opacity * 0.2) + ');border:1px solid rgba(245,158,11,0.3);border-radius:20px;padding:6px 12px;font-size:12px;color:var(--text-color);">';
    html += t.word + ' <span style="font-weight:600;">(' + t.count + ')</span></span>';
  });
  html += '</div>';

  if (recurring.length > 0) {
    html += '<div style="margin-top:12px;padding:10px 14px;background:rgba(239,68,68,0.08);border-radius:8px;font-size:12px;color:var(--text-secondary);border-left:3px solid #ef4444;">';
    html += 'These recurring confusion topics appear across multiple sessions. Consider redesigning how these concepts are taught.</div>';
  }

  return html;
}

async function loadMacroDashboard(moduleFilter, dateFrom, dateTo) {
  var container = document.getElementById('macro-dashboard-content');
  if (!container) return;
  container.innerHTML = '<div class="spinner" style="margin:20px auto;"></div>';

  try {
    var params = [];
    if (moduleFilter) params.push('module=' + encodeURIComponent(moduleFilter));
    if (dateFrom) params.push('from=' + encodeURIComponent(dateFrom));
    if (dateTo) params.push('to=' + encodeURIComponent(dateTo));
    var url = '/api/analytics/macro' + (params.length > 0 ? '?' + params.join('&') : '');

    var response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to load analytics');
    var result = await response.json();
    if (!result.success) throw new Error('Server error');

    var sessions = result.sessions || [];
    var modules = result.modules || [];
    var confusionTopics = result.confusionTopics || [];
    var identityTrends = result.identityTrends || [];

    var inputStyle = 'padding:8px 12px;border-radius:8px;border:1px solid var(--border-color);background:var(--card-bg,var(--bg-secondary,#f3f4f6));color:var(--text-color);font-size:13px;';

    var filterHtml = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap;">' +
      '<label style="font-size:13px;color:var(--text-secondary);">Module:</label>' +
      '<select id="macro-module-filter" onchange="applyMacroFilters()" style="' + inputStyle + '">' +
      '<option value="">All Modules</option>';
    modules.forEach(function(m) {
      var selected = (moduleFilter === m) ? ' selected' : '';
      filterHtml += '<option value="' + m + '"' + selected + '>' + m + '</option>';
    });
    filterHtml += '</select>' +
      '<label style="font-size:13px;color:var(--text-secondary);margin-left:8px;">From:</label>' +
      '<input type="date" id="macro-date-from" value="' + (dateFrom || '') + '" onchange="applyMacroFilters()" style="' + inputStyle + '">' +
      '<label style="font-size:13px;color:var(--text-secondary);">To:</label>' +
      '<input type="date" id="macro-date-to" value="' + (dateTo || '') + '" onchange="applyMacroFilters()" style="' + inputStyle + '">' +
      '<button onclick="clearMacroFilters()" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border-color);background:transparent;color:var(--text-secondary);font-size:12px;cursor:pointer;">Clear</button>' +
      '<span style="font-size:12px;color:var(--text-secondary);">' + sessions.length + ' session(s)</span></div>';

    if (sessions.length === 0) {
      container.innerHTML = filterHtml +
        '<p style="text-align:center;color:var(--text-secondary);padding:30px;">No session data available' +
        (moduleFilter ? ' for ' + moduleFilter : '') + '.</p>';
      return;
    }

    var totalMsgs = sessions.reduce(function(s, x) { return s + x.totalMessages; }, 0);
    var totalActiveStudents = sessions.reduce(function(s, x) { return s + x.activeUsers; }, 0);
    var totalEnrolled = sessions.reduce(function(s, x) { return s + x.totalMembers; }, 0);
    var avgParticipation = (sessions.reduce(function(s, x) { return s + Math.min(100, parseFloat(x.participationRate)); }, 0) / sessions.length).toFixed(1);
    var avgConfusion = (sessions.reduce(function(s, x) { return s + parseFloat(x.confusionRate); }, 0) / sessions.length).toFixed(1);

    var insightText = generateInsight(sessions);

    container.innerHTML = filterHtml + `
      <div class="analytics-stats-row" style="margin-bottom:24px;">
        <div class="analytics-stat-card stat-orange">
          <div class="stat-label">Total Messages</div>
          <div class="stat-value">${totalMsgs}</div>
          <div class="stat-sub">Across ${sessions.length} sessions</div>
        </div>
        <div class="analytics-stat-card stat-green">
          <div class="stat-label">Active / Enrolled</div>
          <div class="stat-value">${totalActiveStudents}/${totalEnrolled}</div>
          <div class="stat-sub">Across all sessions</div>
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

      ${insightText ? `
      <div style="margin-bottom:24px;padding:14px 18px;background:var(--card-bg,#ffffff);border-left:4px solid #3b82f6;border-radius:0 8px 8px 0;font-size:13px;line-height:1.6;color:var(--text-color);box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <span style="font-weight:600;color:#3b82f6;">Teaching Insights:</span> ${insightText}
      </div>
      ` : ''}

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

      <div class="analytics-chart-card" style="margin-bottom:24px;">
        <h3 class="chart-title">Identity Mode Trends Across Sessions (RQ1)</h3>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">How anonymous, pseudonymous, and identified participation changes over sessions. Tracks whether students become more comfortable using real names over time.</p>
        <div class="chart-container" style="height:240px;">
          <canvas id="macro-identity-trend-chart"></canvas>
        </div>
      </div>

      <div class="analytics-chart-card" style="margin-bottom:24px;">
        <h3 class="chart-title" style="display:flex;align-items:center;gap:8px;">
          <span style="color:#f59e0b;">&#9888;</span> Confusion Hotspots
        </h3>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">Keywords extracted from confusion-tagged messages across sessions. Recurring topics may indicate concepts that need redesigned delivery.</p>
        <div id="confusion-topics-content">
          ${renderConfusionTopics(confusionTopics)}
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
                var cappedParticipation = Math.min(100, parseFloat(s.participationRate)).toFixed(1);
                return '<tr style="border-bottom:1px solid var(--border-color);">' +
                  '<td style="padding:10px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + s.title + '</td>' +
                  '<td style="padding:10px;">' + (s.moduleCode || '-') + '</td>' +
                  '<td style="padding:10px;">' + new Date(s.date).toLocaleDateString() + '</td>' +
                  '<td style="padding:10px;">' + s.totalMessages + '</td>' +
                  '<td style="padding:10px;">' + s.activeUsers + '/' + s.totalMembers + '</td>' +
                  '<td style="padding:10px;">' + cappedParticipation + '%</td>' +
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
            data: sessions.map(function(s){ return Math.min(100, parseFloat(s.participationRate)); }),
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

    if (identityTrends && identityTrends.length > 0) {
      var idLabels = identityTrends.map(function(t) {
        return t.sessionTitle.length > 18 ? t.sessionTitle.substring(0, 18) + '...' : t.sessionTitle;
      });
      var idCtx = document.getElementById('macro-identity-trend-chart');
      if (idCtx) {
        macroChartInstances.identityTrend = new Chart(idCtx.getContext('2d'), {
          type: 'bar',
          data: {
            labels: idLabels,
            datasets: [
              { label: 'Anonymous', data: identityTrends.map(function(t){ return t.anonymous; }), backgroundColor: '#6366f1', borderRadius: 4 },
              { label: 'Pseudonymous', data: identityTrends.map(function(t){ return t.pseudonymous; }), backgroundColor: '#8b5cf6', borderRadius: 4 },
              { label: 'Identified', data: identityTrends.map(function(t){ return t.identified; }), backgroundColor: '#10b981', borderRadius: 4 }
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
    }

  } catch (error) {
    console.error('Macro dashboard error:', error);
    container.innerHTML = '<p style="text-align:center;color:#ef4444;padding:20px;">Failed to load semester analytics: ' + error.message + '</p>';
  }
}

function applyMacroFilters() {
  var moduleEl = document.getElementById('macro-module-filter');
  var fromEl = document.getElementById('macro-date-from');
  var toEl = document.getElementById('macro-date-to');
  var module = moduleEl ? moduleEl.value : '';
  var from = fromEl ? fromEl.value : '';
  var to = toEl ? toEl.value : '';
  loadMacroDashboard(module, from, to);
}

function clearMacroFilters() {
  loadMacroDashboard('', '', '');
}

loadMacroDashboard('', '', '');