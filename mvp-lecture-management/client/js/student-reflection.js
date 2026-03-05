let reflectionModal = null;
let currentReflectionSessionId = null;

function initStudentReflection() {
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'lecturer') {
    return;
  }

  createReflectionModal();
  addReflectionButton();
}

function createReflectionModal() {
  if (document.getElementById('reflection-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'reflection-modal';
  modal.className = 'reflection-overlay';
  modal.innerHTML = `
    <div class="reflection-container">
      <div class="reflection-header">
        <h2>📊 My Self-Reflection Dashboard</h2>
        <button class="reflection-close-btn" onclick="closeReflectionModal()">×</button>
      </div>
      <div style="display:flex;gap:8px;padding:12px 24px 16px 24px;border-bottom:1px solid var(--border-color,#e5e7eb);flex-wrap:wrap;">
        <button class="btn btn-secondary btn-small reflection-tab active" data-tab="session" onclick="switchReflectionTab('session')">This Session</button>
        <button class="btn btn-secondary btn-small reflection-tab" data-tab="history" onclick="switchReflectionTab('history')">Session History</button>
        <button class="btn btn-secondary btn-small reflection-tab" data-tab="semester" onclick="switchReflectionTab('semester')">Semester Trend</button>
      </div>
      <div id="reflection-content" class="reflection-content">
        <div class="spinner"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  reflectionModal = modal;
}

function addReflectionButton() {
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'lecturer') {
    return;
  }

  const header = document.querySelector('.chat-header');
  if (header && !document.getElementById('reflection-btn')) {
    const btn = document.createElement('button');
    btn.id = 'reflection-btn';
    btn.className = 'btn btn-secondary btn-small';
    btn.innerHTML = '📊 My Progress';
    btn.onclick = openReflectionModal;
    btn.style.marginLeft = '8px';
    header.appendChild(btn);
  }
}

function switchReflectionTab(tab) {
  document.querySelectorAll('.reflection-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelector('.reflection-tab[data-tab="' + tab + '"]').classList.add('active');

  if (tab === 'session') {
    openReflectionModal();
  } else if (tab === 'history') {
    loadSessionHistory();
  } else if (tab === 'semester') {
    loadSemesterTrend();
  }
}

async function openReflectionModal() {
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'lecturer') {
    return;
  }

  if (!reflectionModal) createReflectionModal();

  currentReflectionSessionId = sessionId;
  reflectionModal.classList.add('show');
  document.getElementById('reflection-content').innerHTML = '<div class="spinner"></div>';

  try {
    const response = await fetch(`/api/reflection/student/${sessionId}`, {
      credentials: 'include'
    });
    const result = await response.json();

    if (result.success) {
      displayReflectionContent(result.analytics);
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    document.getElementById('reflection-content').innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
        <p>Error loading reflection data: ${error.message}</p>
      </div>
    `;
  }
}

function closeReflectionModal() {
  if (reflectionModal) {
    reflectionModal.classList.remove('show');
  }
}

function displayReflectionContent(analytics) {
  const { personal, class: classData, comparison, timeline, goal, goalProgress, reflection } = analytics;

  const container = document.getElementById('reflection-content');

  container.innerHTML = `
    <div class="reflection-section">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <h3 style="margin:0;">📈 My Engagement Overview</h3>
        <span style="font-size:11px;color:var(--text-secondary);background:rgba(59,130,246,0.1);padding:3px 8px;border-radius:12px;">SRL: Self-Reflection Phase</span>
      </div>
      <div class="reflection-stats-grid">
        <div class="reflection-stat ${comparison.aboveAverage ? 'stat-positive' : 'stat-negative'}">
          <div class="stat-number">${personal.messageCount}</div>
          <div class="stat-label">My Messages</div>
        </div>
        <div class="reflection-stat">
          <div class="stat-number">${classData.average}</div>
          <div class="stat-label">Class Average</div>
        </div>
        <div class="reflection-stat">
          <div class="stat-number">${personal.rank ? `#${personal.rank}` : '-'}</div>
          <div class="stat-label">My Rank</div>
        </div>
        <div class="reflection-stat">
          <div class="stat-number">${personal.percentile ? `${personal.percentile}%` : '-'}</div>
          <div class="stat-label">Percentile</div>
        </div>
      </div>
      <div class="comparison-badge ${comparison.aboveAverage ? 'badge-positive' : 'badge-negative'}">
        ${comparison.aboveAverage
          ? `✅ You're ${comparison.difference} messages above average!`
          : `📈 You're ${Math.abs(comparison.difference)} messages below average`}
      </div>
    </div>

    <div class="reflection-section">
      <h3>💬 My Message Types</h3>
      <div class="type-breakdown">
        <div class="type-item">
          <span class="type-icon">❓</span>
          <span class="type-label">Questions</span>
          <span class="type-count">${personal.messagesByType.QUESTION}</span>
        </div>
        <div class="type-item">
          <span class="type-icon">💬</span>
          <span class="type-label">Comments</span>
          <span class="type-count">${personal.messagesByType.COMMENT}</span>
        </div>
        <div class="type-item">
          <span class="type-icon">😕</span>
          <span class="type-label">Confusion</span>
          <span class="type-count">${personal.messagesByType.CONFUSION}</span>
        </div>
      </div>
    </div>

    <div class="reflection-section">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <h3 style="margin:0;">⏱️ My Participation Timeline</h3>
        <span style="font-size:11px;color:var(--text-secondary);background:rgba(16,185,129,0.1);padding:3px 8px;border-radius:12px;">SRL: Performance Phase</span>
      </div>
      ${timeline.length > 0 ? `
        <div class="timeline-chart">
          ${timeline.map(t => `
            <div class="timeline-bar" style="height: ${Math.min(100, t.count * 20)}px;" title="${t.time}: ${t.count} messages">
              <span class="timeline-count">${t.count}</span>
            </div>
          `).join('')}
        </div>
        <div class="timeline-labels">
          ${timeline.map(t => `<span>${t.time}</span>`).join('')}
        </div>
        <p class="timeline-insight">
          ${getTimelineInsight(timeline)}
        </p>
      ` : `
        <p style="color: var(--text-secondary); text-align: center;">
          No participation data yet. Send some messages to see your timeline!
        </p>
      `}
    </div>

    <div class="reflection-section">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <h3 style="margin:0;">🎯 My Session Goal</h3>
        <span style="font-size:11px;color:var(--text-secondary);background:rgba(245,158,11,0.1);padding:3px 8px;border-radius:12px;">SRL: Forethought Phase</span>
      </div>
      ${goal ? `
        <div class="goal-display">
          <p class="goal-text">${goal.text}</p>
          <div class="goal-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${goalProgress?.percentage || 0}%"></div>
            </div>
            <span class="progress-text">${goalProgress?.achieved || 0}/${goalProgress?.target || goal.targetCount} questions</span>
          </div>
          ${goalProgress?.completed ? `
            <div class="goal-achieved">🎉 Goal Achieved!</div>
          ` : ''}
        </div>
      ` : `
        <div class="goal-setter">
          <p>Set a goal to stay engaged during this session:</p>
          <div class="goal-input-group">
            <label>I want to ask</label>
            <select id="goal-target">
              <option value="1">1</option>
              <option value="2" selected>2</option>
              <option value="3">3</option>
              <option value="5">5</option>
            </select>
            <label>questions this session</label>
          </div>
          <button class="btn btn-primary" onclick="saveGoal()">Set Goal</button>
        </div>
      `}
    </div>

    <div class="reflection-section">
      <h3>💭 Quick Reflection</h3>
      ${reflection?.submittedAt ? `
        <div class="reflection-submitted">
          <p><strong>Understanding:</strong> ${'⭐'.repeat(reflection.understanding)}${'☆'.repeat(5 - reflection.understanding)}</p>
          ${reflection.confusingTopic ? `<p><strong>Confusing topic:</strong> ${reflection.confusingTopic}</p>` : ''}
          ${reflection.improvement ? `<p><strong>Next time:</strong> ${reflection.improvement}</p>` : ''}
          <p class="reflection-date">Submitted: ${new Date(reflection.submittedAt).toLocaleString()}</p>
        </div>
      ` : `
        <div class="reflection-form">
          <div class="form-group">
            <label>Rate your understanding (1-5):</label>
            <div class="star-rating" id="understanding-rating">
              ${[1,2,3,4,5].map(i => `
                <span class="star" data-value="${i}" onclick="setRating(${i})">☆</span>
              `).join('')}
            </div>
          </div>
          <div class="form-group">
            <label>What confused you most?</label>
            <input type="text" id="confusing-topic" class="reflection-input" placeholder="e.g., recursion, pointers...">
          </div>
          <div class="form-group">
            <label>What will you do differently next time?</label>
            <input type="text" id="improvement" class="reflection-input" placeholder="e.g., ask more questions early...">
          </div>
          <button class="btn btn-primary" onclick="saveReflection()">Submit Reflection</button>
        </div>
      `}
    </div>

    <div class="reflection-section">
      <h3>🏆 Achievements</h3>
      <div class="achievements-grid">
        ${getAchievementBadges(personal, comparison, timeline, goal, goalProgress)}
      </div>
    </div>

    <div class="reflection-section">
      <h3>💡 Personalised Tips</h3>
      <div class="tips-container">
        ${getPersonalisedTips(personal, comparison, timeline)}
      </div>
    </div>
  `;
}

async function loadSessionHistory() {
  const container = document.getElementById('reflection-content');
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const response = await fetch('/api/reflection/history', { credentials: 'include' });
    const result = await response.json();

    if (!result.success || !result.history || result.history.length === 0) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary);">No session history available yet. Join and participate in sessions to build your history.</div>';
      return;
    }

    const history = result.history;

    let prevMessages = null;
    const rows = history.map(function(h) {
      let changeIndicator = '';
      if (prevMessages !== null) {
        const diff = h.myMessages - prevMessages;
        if (diff > 0) changeIndicator = '<span style="color:#10b981;font-size:11px;"> ↑' + diff + '</span>';
        else if (diff < 0) changeIndicator = '<span style="color:#ef4444;font-size:11px;"> ↓' + Math.abs(diff) + '</span>';
        else changeIndicator = '<span style="color:var(--text-secondary);font-size:11px;"> →</span>';
      }
      prevMessages = h.myMessages;

      return '<tr style="border-bottom:1px solid var(--border-color,#e5e7eb);">' +
        '<td style="padding:10px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + h.title + '</td>' +
        '<td style="padding:10px;">' + (h.moduleCode || '-') + '</td>' +
        '<td style="padding:10px;">' + new Date(h.date).toLocaleDateString() + '</td>' +
        '<td style="padding:10px;font-weight:600;">' + h.myMessages + changeIndicator + '</td>' +
        '<td style="padding:10px;">' + (h.myTypes ? (h.myTypes.QUESTION || 0) + 'Q / ' + (h.myTypes.COMMENT || 0) + 'C / ' + (h.myTypes.CONFUSION || 0) + 'X' : '-') + '</td>' +
        '<td style="padding:10px;">' + h.classAverage + '</td>' +
        '<td style="padding:10px;">' + (h.rank ? '#' + h.rank : '-') + '</td>' +
        '<td style="padding:10px;">' + (h.aboveAverage ? '<span style="color:#10b981;">Above</span>' : '<span style="color:#f59e0b;">Below</span>') + '</td>' +
        '<td style="padding:10px;">' + (h.understanding ? '⭐'.repeat(h.understanding) : '-') + '</td>' +
      '</tr>';
    }).join('');

    container.innerHTML = `
      <div class="reflection-section">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <h3 style="margin:0;">📋 Session-by-Session History</h3>
          <span style="font-size:11px;color:var(--text-secondary);background:rgba(59,130,246,0.1);padding:3px 8px;border-radius:12px;">SRL: Self-Reflection Phase</span>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">Track your engagement across all attended sessions. Compare your participation to the class average and monitor your progress over time.</p>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="border-bottom:2px solid var(--border-color,#e5e7eb);text-align:left;">
                <th style="padding:10px;">Session</th>
                <th style="padding:10px;">Module</th>
                <th style="padding:10px;">Date</th>
                <th style="padding:10px;">My Msgs</th>
                <th style="padding:10px;">Types</th>
                <th style="padding:10px;">Class Avg</th>
                <th style="padding:10px;">Rank</th>
                <th style="padding:10px;">vs Avg</th>
                <th style="padding:10px;min-width:75px;">Rating</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;">Error loading history: ' + error.message + '</div>';
  }
}

async function loadSemesterTrend() {
  const container = document.getElementById('reflection-content');
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const response = await fetch('/api/reflection/semester-trend', { credentials: 'include' });
    const result = await response.json();

    if (!result.success || !result.trend || result.trend.length === 0) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary);">No semester data available yet. Participate in multiple sessions to see your engagement trend.</div>';
      return;
    }

    const trend = result.trend;

    const totalMsgs = trend.reduce(function(s, t) { return s + t.myMessages; }, 0);
    const avgMsgs = (totalMsgs / trend.length).toFixed(1);
    const firstCount = trend[0].myMessages;
    const lastCount = trend[trend.length - 1].myMessages;
    const trendDirection = lastCount > firstCount ? 'increasing' : (lastCount < firstCount ? 'decreasing' : 'stable');

    let insightText = '';
    if (trendDirection === 'increasing') {
      insightText = 'Your engagement is trending upward! You sent ' + (lastCount - firstCount) + ' more messages in your latest session compared to your first.';
    } else if (trendDirection === 'decreasing') {
      insightText = 'Your engagement has decreased over time. Consider setting goals to stay more active in upcoming sessions.';
    } else {
      insightText = 'Your engagement has been consistent across sessions. Average of ' + avgMsgs + ' messages per session.';
    }

    container.innerHTML = `
      <div class="reflection-section">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <h3 style="margin:0;">📈 Semester Engagement Trend</h3>
          <span style="font-size:11px;color:var(--text-secondary);background:rgba(59,130,246,0.1);padding:3px 8px;border-radius:12px;">SRL: Self-Reflection Phase</span>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">Your message count per session over the semester compared to the class average. Recognise patterns in your own engagement.</p>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
          <div style="background:var(--card-bg,var(--bg-secondary,#374151));border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:var(--text-color);">${totalMsgs}</div>
            <div style="font-size:12px;color:var(--text-secondary);">Total Messages</div>
          </div>
          <div style="background:var(--card-bg,var(--bg-secondary,#374151));border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:var(--text-color);">${avgMsgs}</div>
            <div style="font-size:12px;color:var(--text-secondary);">Avg per Session</div>
          </div>
          <div style="background:var(--card-bg,var(--bg-secondary,#374151));border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:${trendDirection === 'increasing' ? '#10b981' : (trendDirection === 'decreasing' ? '#ef4444' : 'var(--text-color)')};">${trendDirection === 'increasing' ? '↑' : (trendDirection === 'decreasing' ? '↓' : '→')}</div>
            <div style="font-size:12px;color:var(--text-secondary);">Trend: ${trendDirection}</div>
          </div>
        </div>

        <div style="height:260px;margin-bottom:16px;">
          <canvas id="semester-trend-chart"></canvas>
        </div>

        <div style="padding:10px 14px;background:rgba(59,130,246,0.08);border-left:3px solid #3b82f6;border-radius:0 8px 8px 0;font-size:12px;color:var(--text-secondary);">
          ${insightText}
        </div>
      </div>
    `;

    setTimeout(function() {
      var ctx = document.getElementById('semester-trend-chart');
      if (!ctx) return;

      var labels = trend.map(function(t) {
        return t.sessionTitle.length > 15 ? t.sessionTitle.substring(0, 15) + '...' : t.sessionTitle;
      });

      new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'My Messages',
              data: trend.map(function(t) { return t.myMessages; }),
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59,130,246,0.1)',
              fill: true,
              tension: 0.3,
              pointRadius: 6,
              pointBackgroundColor: '#3b82f6',
              borderWidth: 2,
            },
            {
              label: 'Class Average',
              data: trend.map(function(t) { return t.classAverage; }),
              borderColor: '#9ca3af',
              backgroundColor: 'transparent',
              borderDash: [5, 5],
              tension: 0.3,
              pointRadius: 4,
              pointBackgroundColor: '#9ca3af',
              borderWidth: 2,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 } } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { maxRotation: 45 } },
            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' } }
          }
        }
      });
    }, 150);

  } catch (error) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;">Error loading semester trend: ' + error.message + '</div>';
  }
}

function getTimelineInsight(timeline) {
  if (timeline.length === 0) return '';

  const maxBucket = timeline.reduce((max, t) => t.count > max.count ? t : max, timeline[0]);
  const firstHalf = timeline.slice(0, Math.ceil(timeline.length / 2));
  const secondHalf = timeline.slice(Math.ceil(timeline.length / 2));

  const firstHalfCount = firstHalf.reduce((sum, t) => sum + t.count, 0);
  const secondHalfCount = secondHalf.reduce((sum, t) => sum + t.count, 0);

  if (firstHalfCount > secondHalfCount * 1.5) {
    return "💡 You're most active at the start! Try staying engaged throughout.";
  } else if (secondHalfCount > firstHalfCount * 1.5) {
    return "💡 You engaged more towards the end. Consider participating earlier too!";
  } else {
    return `💡 Your peak activity was at ${maxBucket.time}. Great consistent engagement!`;
  }
}

let currentRating = 3;

function setRating(value) {
  currentRating = value;
  const stars = document.querySelectorAll('#understanding-rating .star');
  stars.forEach((star, i) => {
    star.textContent = i < value ? '⭐' : '☆';
  });
}

async function saveGoal() {
  const targetCount = parseInt(document.getElementById('goal-target').value);

  try {
    const response = await fetch(`/api/reflection/goal/${currentReflectionSessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        text: `Ask ${targetCount} questions this session`,
        targetCount
      })
    });

    const result = await response.json();
    if (result.success) {
      openReflectionModal();
    } else {
      alert('Failed to save goal');
    }
  } catch (error) {
    alert('Error saving goal: ' + error.message);
  }
}

async function saveReflection() {
  const confusingTopic = document.getElementById('confusing-topic').value;
  const improvement = document.getElementById('improvement').value;

  try {
    const response = await fetch(`/api/reflection/reflection/${currentReflectionSessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        understanding: currentRating,
        confusingTopic,
        improvement
      })
    });

    const result = await response.json();
    if (result.success) {
      openReflectionModal();
    } else {
      alert('Failed to save reflection');
    }
  } catch (error) {
    alert('Error saving reflection: ' + error.message);
  }
}

function getAchievementBadges(personal, comparison, timeline, goal, goalProgress) {
  const badges = [];

  // Active Participant badge
  if (personal.messageCount >= 5) {
    badges.push({
      icon: '💬',
      title: 'Active Participant',
      desc: '5+ messages sent',
      earned: true
    });
  } else {
    badges.push({
      icon: '💬',
      title: 'Active Participant',
      desc: `${personal.messageCount}/5 messages`,
      earned: false
    });
  }

  // Above Average badge
  if (comparison.aboveAverage) {
    badges.push({
      icon: '📈',
      title: 'Above Average',
      desc: 'More than class average',
      earned: true
    });
  }

  // Question Asker badge
  if (personal.messagesByType.QUESTION >= 2) {
    badges.push({
      icon: '❓',
      title: 'Curious Mind',
      desc: '2+ questions asked',
      earned: true
    });
  } else {
    badges.push({
      icon: '❓',
      title: 'Curious Mind',
      desc: `${personal.messagesByType.QUESTION}/2 questions`,
      earned: false
    });
  }

  // Goal Achiever badge
  if (goalProgress?.completed) {
    badges.push({
      icon: '🎯',
      title: 'Goal Achiever',
      desc: 'Session goal completed',
      earned: true
    });
  }

  // Early Bird badge
  if (timeline.length > 0 && parseInt(timeline[0].time) <= 5) {
    badges.push({
      icon: '🐦',
      title: 'Early Bird',
      desc: 'Engaged in first 5 mins',
      earned: true
    });
  }

  // Top 10 badge
  if (personal.percentile && personal.percentile >= 90) {
    badges.push({
      icon: '🏆',
      title: 'Top 10%',
      desc: 'Among most active',
      earned: true
    });
  }

  return badges.map(b => `
    <div class="achievement-badge ${b.earned ? 'earned' : 'locked'}">
      <span class="badge-icon">${b.icon}</span>
      <div class="badge-info">
        <span class="badge-title">${b.title}</span>
        <span class="badge-desc">${b.desc}</span>
      </div>
    </div>
  `).join('');
}

function getPersonalisedTips(personal, comparison, timeline) {
  const tips = [];

  // Tip based on message count
  if (personal.messageCount === 0) {
    tips.push({
      icon: '👋',
      text: "You haven't sent any messages yet. Try starting with a simple comment or question!"
    });
  } else if (personal.messageCount < 3) {
    tips.push({
      icon: '💪',
      text: "You're getting started! Research shows active participants retain 20% more information."
    });
  }

  // Tip based on comparison
  if (!comparison.aboveAverage && personal.messageCount > 0) {
    tips.push({
      icon: '📊',
      text: `You're ${Math.abs(comparison.difference)} messages below average. Try asking one more question before the session ends!`
    });
  }

  // Tip based on question count
  if (personal.messagesByType.QUESTION === 0 && personal.messageCount > 0) {
    tips.push({
      icon: '❓',
      text: "Try asking a question! Even simple clarifications help reinforce your understanding."
    });
  }

  // Tip based on timeline
  if (timeline.length > 0) {
    const firstHalf = timeline.slice(0, Math.ceil(timeline.length / 2));
    const secondHalf = timeline.slice(Math.ceil(timeline.length / 2));
    const firstHalfCount = firstHalf.reduce((s, t) => s + t.count, 0);
    const secondHalfCount = secondHalf.reduce((s, t) => s + t.count, 0);

    if (firstHalfCount === 0 && secondHalfCount > 0) {
      tips.push({
        icon: '⏰',
        text: "You engaged later in the session. Try participating earlier next time to build momentum!"
      });
    }
  }

  // Confusion tip
  if (personal.messagesByType.CONFUSION > personal.messagesByType.QUESTION) {
    tips.push({
      icon: '💡',
      text: "When confused, try formulating it as a question. This helps you think through the problem!"
    });
  }

  // Default positive tip if doing well
  if (tips.length === 0) {
    tips.push({
      icon: '⭐',
      text: "Great job staying engaged! Keep up the active participation."
    });
  }

  return tips.map(t => `
    <div class="tip-item">
      <span class="tip-icon">${t.icon}</span>
      <span class="tip-text">${t.text}</span>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    initStudentReflection();
  }, 1500);
});