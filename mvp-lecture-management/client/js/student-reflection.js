let reflectionModal = null;
let currentReflectionSessionId = null;

function initStudentReflection() {
  createReflectionModal();
  addReflectionButton();
}

function createReflectionModal() {
  const modal = document.createElement('div');
  modal.id = 'reflection-modal';
  modal.className = 'reflection-overlay';
  modal.innerHTML = `
    <div class="reflection-container">
      <div class="reflection-header">
        <h2>📊 My Self-Reflection</h2>
        <button class="reflection-close-btn" onclick="closeReflectionModal()">×</button>
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

async function openReflectionModal() {
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
    <!-- Engagement Overview -->
    <div class="reflection-section">
      <h3>📈 My Engagement Overview</h3>
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

    <!-- Message Types -->
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

    <!-- Participation Timeline -->
    <div class="reflection-section">
      <h3>⏱️ My Participation Timeline</h3>
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

    <!-- Goal Setting -->
    <div class="reflection-section">
      <h3>🎯 My Session Goal</h3>
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

    <!-- Reflection Prompts -->
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
  `;
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

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initStudentReflection, 1000);
});