// Manage Students Modal - client/js/manage-students.js
let currentManageSessionId = null;

function createManageStudentsModal() {
  if (document.getElementById('manage-students-modal')) return;

  const modalHTML = `
    <div id="manage-students-modal" class="modal-overlay">
      <div style="background: var(--bg-primary, #1a1a2e); border-radius: 16px; width: 90%; max-width: 550px; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--border-color, #333);">
          <h3 style="margin: 0; font-size: 20px; color: var(--text-primary, #fff);">Manage Students</h3>
          <button onclick="closeManageStudentsModal()" style="background: none; border: none; font-size: 28px; cursor: pointer; color: var(--text-secondary, #888); line-height: 1;">&times;</button>
        </div>
        
        <div style="padding: 24px;">
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--bg-secondary, #252542); border-radius: 8px; margin-bottom: 24px;">
            <span id="manage-session-title" style="font-weight: 600; font-size: 15px; color: var(--text-primary, #fff);"></span>
            <span id="manage-session-code" style="font-family: monospace; font-size: 14px; padding: 6px 14px; background: #667eea; color: white; border-radius: 6px; font-weight: 600;"></span>
          </div>
          
          <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--border-color, #333);">
            <h4 style="font-size: 16px; margin: 0 0 16px 0; font-weight: 600; color: var(--text-primary, #fff);">Add Student by Email</h4>
            
            <div style="display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center;">
              <input type="email" id="add-student-email" placeholder="student@qub.ac.uk">
              <button onclick="addStudentToSession()" id="add-student-btn">+ Add</button>
            </div>
            
            <div id="add-student-status" style="margin-top: 12px; padding: 10px 14px; border-radius: 6px; font-size: 14px; display: none;"></div>
          </div>
          
          <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--border-color, #333);">
            <details>
              <summary style="cursor: pointer; color: #667eea; font-weight: 500; font-size: 14px;">Add Multiple Students</summary>
              <div style="margin-top: 12px;">
                <textarea id="bulk-emails" rows="4" placeholder="Enter emails, one per line"></textarea>
                <button onclick="bulkAddStudents()" class="btn btn-secondary" style="margin-top: 8px;">Add All</button>
              </div>
            </details>
          </div>
          
          <div>
            <h4 style="font-size: 16px; margin: 0 0 16px 0; font-weight: 600; color: var(--text-primary, #fff);">
              Enrolled Students 
              <span id="enrolled-count" style="display: inline-block; padding: 3px 12px; background: #667eea; color: white; border-radius: 12px; font-size: 13px; font-weight: 600; margin-left: 8px;">0</span>
            </h4>
            <div id="students-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color, #333); border-radius: 8px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  applyInputStyles();
}

function applyInputStyles() {
  // Add CSS for the inputs
  if (document.getElementById('ms-input-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'ms-input-styles';
  style.textContent = `
    #add-student-email {
      width: 100%;
      height: 50px;
      padding: 12px 16px;
      font-size: 16px;
      font-weight: 500;
      border: 2px solid #4b5563;
      border-radius: 8px;
      background-color: #1f2937 !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
      box-sizing: border-box;
    }
    #add-student-email:focus {
      outline: none;
      border-color: #667eea;
    }
    #add-student-email::placeholder {
      color: #9ca3af !important;
      -webkit-text-fill-color: #9ca3af !important;
      opacity: 1 !important;
    }
    
    #add-student-btn {
      height: 50px;
      padding: 0 20px;
      font-size: 14px;
      font-weight: 600;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      white-space: nowrap;
    }
    #add-student-btn:hover {
      background: #5a67d8;
    }
    
    #bulk-emails {
      width: 100%;
      min-height: 100px;
      padding: 14px;
      font-size: 14px;
      font-family: monospace;
      border: 2px solid #4b5563;
      border-radius: 8px;
      resize: vertical;
      background-color: #1f2937 !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
      box-sizing: border-box;
    }
    #bulk-emails:focus {
      outline: none;
      border-color: #667eea;
    }
    #bulk-emails::placeholder {
      color: #9ca3af !important;
      -webkit-text-fill-color: #9ca3af !important;
      opacity: 1 !important;
    }
    
    /* Light mode */
    body:not(.dark-mode) #add-student-email,
    body:not(.dark-mode) #bulk-emails {
      background-color: #ffffff !important;
      color: #1f2937 !important;
      -webkit-text-fill-color: #1f2937 !important;
      border-color: #d1d5db;
    }
    body:not(.dark-mode) #add-student-email::placeholder,
    body:not(.dark-mode) #bulk-emails::placeholder {
      color: #6b7280 !important;
      -webkit-text-fill-color: #6b7280 !important;
    }
  `;
  document.head.appendChild(style);
}

async function openManageStudentsModal(sessionId, sessionTitle, joinCode) {
  createManageStudentsModal();
  currentManageSessionId = sessionId;

  document.getElementById('manage-session-title').textContent = sessionTitle;
  document.getElementById('manage-session-code').textContent = joinCode;
  document.getElementById('add-student-email').value = '';
  
  const statusEl = document.getElementById('add-student-status');
  statusEl.style.display = 'none';

  document.getElementById('manage-students-modal').classList.add('show');
  
  await loadEnrolledStudents();
}

function closeManageStudentsModal() {
  document.getElementById('manage-students-modal').classList.remove('show');
  currentManageSessionId = null;
}

async function loadEnrolledStudents() {
  const listEl = document.getElementById('students-list');
  const countEl = document.getElementById('enrolled-count');

  listEl.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-secondary, #9ca3af); font-size: 14px;">Loading...</div>';

  try {
    const response = await fetch(`/api/sessions/${currentManageSessionId}/students`, { credentials: 'include' });
    const result = await response.json();

    if (result.success) {
      const students = result.students || [];
      countEl.textContent = students.length;

      if (students.length === 0) {
        listEl.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-secondary, #9ca3af); font-size: 14px;">No students enrolled yet</div>';
        return;
      }

      listEl.innerHTML = students.map(student => {
        const initials = getInitials(student.displayName);
        const bgColor = getColorFromName(student.displayName);
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border-color, #333);">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: white; background: ${bgColor}; flex-shrink: 0;">${initials}</div>
              <div style="display: flex; flex-direction: column;">
                <span style="font-weight: 600; font-size: 15px; color: var(--text-primary, #fff);">${student.displayName || 'Unknown'}</span>
                <span style="font-size: 13px; color: var(--text-secondary, #9ca3af);">${student.email || ''}</span>
              </div>
            </div>
            <button onclick="removeStudent('${student.id}', '${(student.displayName || '').replace(/'/g, "\\'")}')" 
              style="padding: 8px 14px; border: none; background: #fee2e2; color: #dc2626; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; flex-shrink: 0;">Remove</button>
          </div>
        `;
      }).join('');
    } else {
      listEl.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-secondary, #9ca3af); font-size: 14px;">Error: ${result.message}</div>`;
    }
  } catch (error) {
    listEl.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-secondary, #9ca3af); font-size: 14px;">Error loading students</div>';
  }
}

async function addStudentToSession() {
  const emailInput = document.getElementById('add-student-email');
  const statusEl = document.getElementById('add-student-status');
  const email = emailInput.value.trim();

  if (!email) {
    statusEl.textContent = 'Please enter a student email';
    statusEl.style.display = 'block';
    statusEl.style.background = '#fee2e2';
    statusEl.style.color = '#991b1b';
    return;
  }

  try {
    const response = await fetch(`/api/sessions/${currentManageSessionId}/add-student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email })
    });
    const result = await response.json();

    if (result.success) {
      statusEl.textContent = result.message;
      statusEl.style.display = 'block';
      statusEl.style.background = '#d1fae5';
      statusEl.style.color = '#065f46';
      emailInput.value = '';
      await loadEnrolledStudents();
    } else {
      statusEl.textContent = result.message || 'Failed to add student';
      statusEl.style.display = 'block';
      statusEl.style.background = '#fee2e2';
      statusEl.style.color = '#991b1b';
    }
  } catch (error) {
    statusEl.textContent = 'Error adding student';
    statusEl.style.display = 'block';
    statusEl.style.background = '#fee2e2';
    statusEl.style.color = '#991b1b';
  }

  setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
}

async function bulkAddStudents() {
  const textarea = document.getElementById('bulk-emails');
  const statusEl = document.getElementById('add-student-status');
  const text = textarea.value.trim();

  if (!text) {
    statusEl.textContent = 'Please enter student emails';
    statusEl.style.display = 'block';
    statusEl.style.background = '#fee2e2';
    statusEl.style.color = '#991b1b';
    return;
  }

  const emails = text.split('\n').map(e => e.trim()).filter(e => e.includes('@'));
  if (emails.length === 0) {
    statusEl.textContent = 'No valid emails found';
    statusEl.style.display = 'block';
    statusEl.style.background = '#fee2e2';
    statusEl.style.color = '#991b1b';
    return;
  }

  try {
    const response = await fetch(`/api/sessions/${currentManageSessionId}/add-students-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ emails })
    });
    const result = await response.json();

    if (result.success) {
      let msg = `Added ${result.results.added.length} student(s).`;
      if (result.results.alreadyEnrolled.length > 0) msg += ` ${result.results.alreadyEnrolled.length} already enrolled.`;
      if (result.results.notFound.length > 0) msg += ` ${result.results.notFound.length} not found.`;
      statusEl.textContent = msg;
      statusEl.style.display = 'block';
      statusEl.style.background = '#d1fae5';
      statusEl.style.color = '#065f46';
      textarea.value = '';
      await loadEnrolledStudents();
    } else {
      statusEl.textContent = result.message || 'Failed';
      statusEl.style.display = 'block';
      statusEl.style.background = '#fee2e2';
      statusEl.style.color = '#991b1b';
    }
  } catch (error) {
    statusEl.textContent = 'Error adding students';
    statusEl.style.display = 'block';
    statusEl.style.background = '#fee2e2';
    statusEl.style.color = '#991b1b';
  }

  setTimeout(() => { statusEl.style.display = 'none'; }, 5000);
}

async function removeStudent(studentId, studentName) {
  if (!confirm(`Remove ${studentName} from this session?`)) return;

  try {
    const response = await fetch(`/api/sessions/${currentManageSessionId}/remove-student/${studentId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    const result = await response.json();
    if (result.success) await loadEnrolledStudents();
    else alert(result.message || 'Error removing student');
  } catch (error) {
    alert('Error removing student');
  }
}

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(' ').filter(p => p.length > 0);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function getColorFromName(name) {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
  let hash = 0;
  for (let i = 0; i < (name || 'User').length; i++) hash = (name || 'User').charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}