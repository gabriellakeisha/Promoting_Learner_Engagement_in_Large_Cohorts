let userProfile = null;
let cropper = null;

// Generate colour from name
function generateColorFromName(name) {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F1948A', '#82E0AA', '#F8B500', '#00CED1', '#FF69B4',
        '#6C5CE7', '#A29BFE', '#FD79A8', '#00B894', '#E17055'
    ];

    let hash = 0;
    const str = name || 'User';
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
}

// Get initials from name
function getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Load user profile
async function loadProfile() {
    try {
        console.log('Loading profile from /api/auth/me...');

        const response = await fetch('/api/auth/me', {
            credentials: 'include'
        });

        const result = await response.json();
        console.log('Auth/me response:', result);

        if (result.success && result.user) {
            userProfile = result.user;
            // Retrieve avatar URL from database
            userProfile.avatarUrl = result.user.avatarUrl || null;

            console.log('Profile loaded:', userProfile);
            updateNavbarAvatar();
            return userProfile;
        }
    } catch (error) {
        console.error('Failed to load profile:', error);
    }
    return null;
}

// Update navbar avatar
function updateNavbarAvatar() {
    if (!userProfile) return;

    const avatarEl = document.getElementById('navbar-avatar');
    if (!avatarEl) return;

    // Force correct size
    avatarEl.style.width = '40px';
    avatarEl.style.height = '40px';
    avatarEl.style.minWidth = '40px';
    avatarEl.style.maxWidth = '40px';

    if (userProfile.avatarUrl) {
        avatarEl.innerHTML = `<img src="${userProfile.avatarUrl}" alt="Avatar">`;
        avatarEl.style.backgroundColor = 'transparent';
    } else {
        const initials = getInitials(userProfile.displayName);
        const bgColor = generateColorFromName(userProfile.displayName);
        avatarEl.innerHTML = initials;
        avatarEl.style.backgroundColor = bgColor;
        avatarEl.style.color = 'white';
        avatarEl.style.fontWeight = '700';
    }
}

// Create profile modal
function createProfileModal() {
    if (document.getElementById('profile-modal')) return;

    const modalHTML = `
    <div id="profile-modal" class="profile-modal-overlay">
      <div class="profile-modal">
        <div class="profile-modal-header">
          <h2>Edit Profile</h2>
          <button class="profile-modal-close" onclick="closeProfileModal()">&times;</button>
        </div>
        
        <div class="profile-modal-body">
          <!-- Avatar Section -->
          <div class="profile-avatar-section">
            <div id="profile-avatar-preview" class="profile-avatar-large"></div>
            <p class="avatar-note">💡 Your avatar is unique to you based on your name</p>
            <div class="profile-avatar-actions">
              <label for="avatar-upload" class="btn btn-primary">
                📷 Upload Photo
              </label>
              <input type="file" id="avatar-upload" accept="image/*" style="display: none;" onchange="openImageCropper(event)">
              <button type="button" class="btn btn-secondary" onclick="removeAvatar()">↩️ Use Initials</button>
            </div>
          </div>
          
          <!-- Display Name -->
          <div class="profile-form-group">
            <label for="profile-display-name">Display Name</label>
            <div class="profile-input-row">
              <input type="text" id="profile-display-name" class="form-input profile-text-input" placeholder="Enter your display name">
              <button type="button" class="btn btn-primary" onclick="updateDisplayName()">Save</button>
            </div>
          </div>
          
          <!-- Email (read-only) -->
          <div class="profile-form-group">
            <label>Email</label>
            <input type="email" id="profile-email" class="form-input profile-text-input" disabled readonly>
          </div>
          
          <!-- Role Badge -->
          <div class="profile-form-group">
            <label>Role</label>
            <div id="profile-role-badge" class="profile-role-badge">Loading...</div>
          </div>
          
          <!-- Change Password -->
          <div class="profile-form-group">
            <label>Change Password</label>
            <div class="password-change-form">
              <input type="password" id="current-password" class="form-input profile-text-input" placeholder="Current password">
              <input type="password" id="new-password" class="form-input profile-text-input" placeholder="New password (min 6 chars)">
              <button type="button" class="btn btn-primary" onclick="changePassword()">Update Password</button>
            </div>
          </div>
        </div>
        
        <div id="profile-status" class="profile-status"></div>
      </div>
    </div>
    
    <!-- Image Cropper Modal -->
    <div id="cropper-modal" class="cropper-modal-overlay">
      <div class="cropper-modal">
        <div class="cropper-modal-header">
          <h3>Crop & Adjust Photo</h3>
          <button class="profile-modal-close" onclick="closeCropperModal()">&times;</button>
        </div>
        <div class="cropper-container">
          <img id="cropper-image" src="" alt="Crop preview">
        </div>
        <div class="cropper-controls">
          <button type="button" class="btn btn-secondary btn-sm" onclick="rotateImage(-90)">↺ Left</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="rotateImage(90)">↻ Right</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="zoomImage(0.1)">+ Zoom</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="zoomImage(-0.1)">- Zoom</button>
        </div>
        <div class="cropper-actions">
          <button type="button" class="btn btn-secondary" onclick="closeCropperModal()">Cancel</button>
          <button type="button" class="btn btn-primary" onclick="saveCroppedImage()">✓ Save Photo</button>
        </div>
      </div>
    </div>
  `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    addProfileStyles();
    loadCropperLibrary();
}

// Load Cropper.js
function loadCropperLibrary() {
    if (!document.getElementById('cropper-css')) {
        const link = document.createElement('link');
        link.id = 'cropper-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.css';
        document.head.appendChild(link);
    }

    if (!document.getElementById('cropper-js')) {
        const script = document.createElement('script');
        script.id = 'cropper-js';
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.js';
        document.head.appendChild(script);
    }
}

// Add styles
function addProfileStyles() {
    if (document.getElementById('profile-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'profile-styles';
    styles.textContent = `
    .profile-modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      backdrop-filter: blur(4px);
    }
    .profile-modal-overlay.show { display: flex; }
    
    .profile-modal {
      background: var(--bg-primary, #fff);
      border-radius: 16px;
      width: 90%;
      max-width: 450px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      animation: modalSlideIn 0.3s ease;
    }
    
    @keyframes modalSlideIn {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .profile-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-color, #e5e7eb);
    }
    .profile-modal-header h2 {
      margin: 0;
      font-size: 20px;
      color: var(--text-primary, #1f2937);
    }
    .profile-modal-close {
      background: none;
      border: none;
      font-size: 28px;
      cursor: pointer;
      color: var(--text-secondary, #6b7280);
      line-height: 1;
    }
    .profile-modal-close:hover { color: #ef4444; }
    
    .profile-modal-body { padding: 24px; }
    
    .profile-avatar-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border-color, #e5e7eb);
    }
    
    .profile-avatar-large {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      font-weight: 700;
      color: white;
      margin-bottom: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      overflow: hidden;
    }
    .profile-avatar-large img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .avatar-note {
      font-size: 12px;
      color: var(--text-secondary, #6b7280);
      text-align: center;
      margin-bottom: 12px;
    }
    
    .profile-avatar-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }
    
    .profile-form-group {
      margin-bottom: 20px;
    }
    .profile-form-group label {
      display: block;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--text-primary, #1f2937);
      font-size: 14px;
    }
    
    .profile-text-input {
      width: 100%;
      padding: 12px 16px;
      font-size: 14px;
      border: 1px solid var(--border-color, #d1d5db);
      border-radius: 8px;
      background: var(--bg-secondary, #f9fafb);
      color: var(--text-primary, #1f2937);
      box-sizing: border-box;
    }
    .profile-text-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102,126,234,0.2);
    }
    .profile-text-input:disabled {
      background: var(--bg-secondary, #e5e7eb);
      opacity: 0.7;
      cursor: not-allowed;
    }
    
    .profile-input-row {
      display: flex;
      gap: 12px;
    }
    .profile-input-row .profile-text-input { flex: 1; }
    
    .password-change-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .password-change-form .btn { align-self: flex-start; }
    
    .profile-role-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 14px;
    }
    .profile-role-badge.lecturer {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
    }
    .profile-role-badge.student {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
    }
    
    .profile-status {
      padding: 12px 24px;
      text-align: center;
      font-size: 14px;
      font-weight: 500;
      display: none;
      border-radius: 0 0 16px 16px;
    }
    .profile-status.success {
      display: block;
      background: #d1fae5;
      color: #065f46;
    }
    .profile-status.error {
      display: block;
      background: #fee2e2;
      color: #991b1b;
    }
    
    /* Cropper Modal */
    .cropper-modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.85);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 3000;
    }
    .cropper-modal-overlay.show { display: flex; }
    
    .cropper-modal {
      background: var(--bg-primary, #fff);
      border-radius: 16px;
      width: 90%;
      max-width: 500px;
      overflow: hidden;
    }
    .cropper-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color, #e5e7eb);
    }
    .cropper-modal-header h3 {
      margin: 0;
      font-size: 18px;
    }
    
    .cropper-container {
      width: 100%;
      height: 300px;
      background: #1a1a2e;
    }
    .cropper-container img {
      max-width: 100%;
      display: block;
    }
    
    .cropper-controls {
      display: flex;
      gap: 8px;
      padding: 12px;
      justify-content: center;
      flex-wrap: wrap;
      background: var(--bg-secondary, #f3f4f6);
    }
    .cropper-controls .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
    }
    
    .cropper-actions {
      display: flex;
      gap: 12px;
      padding: 16px;
      justify-content: flex-end;
    }
    
    /* Navbar Avatar */
    .navbar-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      color: white;
      background-color: #667eea;
      transition: transform 0.2s, box-shadow 0.2s;
      flex-shrink: 0;
    }
    .navbar-avatar:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(102,126,234,0.4);
    }
    .navbar-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
.edit-profile-link,
.edit-profile-link:link,
.edit-profile-link:visited,
.edit-profile-link:active,
.edit-profile-link:hover {
  color: var(--primary-color, #667eea) !important;
  text-decoration: none !important;
  font-size: 13px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 6px;
  transition: all 0.2s;
}

.edit-profile-link:hover {
  background: rgba(102, 126, 234, 0.1);
}
    
    .navbar-user {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    /* Dark Mode */
    .dark-mode .profile-modal,
    .dark-mode .cropper-modal {
      background: var(--bg-primary, #1f2937);
    }
    .dark-mode .profile-modal-header,
    .dark-mode .cropper-modal-header {
      border-color: var(--border-color, #374151);
    }
    .dark-mode .profile-modal-header h2,
    .dark-mode .cropper-modal-header h3,
    .dark-mode .profile-form-group label {
      color: var(--text-primary, #f3f4f6);
    }
    .dark-mode .profile-text-input {
      background: var(--bg-secondary, #374151);
      border-color: var(--border-color, #4b5563);
      color: var(--text-primary, #f3f4f6);
    }
    .dark-mode .cropper-controls {
      background: var(--bg-secondary, #374151);
    }
  `;

    document.head.appendChild(styles);
}

// Open profile modal
async function openProfileModal() {
    createProfileModal();
    await loadProfile();
    updateProfileDisplay();
    document.getElementById('profile-modal').classList.add('show');
}

// Close profile modal
function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.remove('show');
}

// Update profile display
function updateProfileDisplay() {
    if (!userProfile) {
        console.warn('No userProfile');
        return;
    }

    console.log('Displaying profile:', userProfile);

    // Avatar
    const avatarPreview = document.getElementById('profile-avatar-preview');
    if (avatarPreview) {
        if (userProfile.avatarUrl) {
            avatarPreview.innerHTML = `<img src="${userProfile.avatarUrl}" alt="Avatar">`;
            avatarPreview.style.backgroundColor = 'transparent';
        } else {
            const initials = getInitials(userProfile.displayName);
            const bgColor = generateColorFromName(userProfile.displayName);
            avatarPreview.innerHTML = initials;
            avatarPreview.style.backgroundColor = bgColor;
        }
    }

    // Display name
    const displayNameInput = document.getElementById('profile-display-name');
    if (displayNameInput) {
        displayNameInput.value = userProfile.displayName || '';
    }

    // Email
    const emailInput = document.getElementById('profile-email');
    if (emailInput) {
        emailInput.value = userProfile.email || '';
    }

    // Role
    const roleBadge = document.getElementById('profile-role-badge');
    if (roleBadge) {
        const role = userProfile.role || 'student';
        roleBadge.innerHTML = role === 'lecturer' ? '👨‍🏫 Lecturer' : '🎓 Student';
        roleBadge.className = `profile-role-badge ${role}`;
    }
}

// Update display name
async function updateDisplayName() {
    const input = document.getElementById('profile-display-name');
    const displayName = input ? input.value.trim() : '';

    if (displayName.length < 2) {
        showProfileStatus('Display name must be at least 2 characters', 'error');
        return;
    }

    try {
        const response = await fetch('/api/profile/display-name', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ displayName })
        });

        const result = await response.json();

        if (result.success) {
            userProfile.displayName = displayName;
            updateProfileDisplay();
            updateNavbarAvatar();

            const navName = document.getElementById('user-name');
            if (navName) navName.textContent = displayName;

            showProfileStatus('✓ Display name updated!', 'success');
        } else {
            showProfileStatus(result.message || 'Failed to update', 'error');
        }
    } catch (error) {
        console.error('Update error:', error);
        showProfileStatus('Error updating display name', 'error');
    }
}

// Change password
async function changePassword() {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;

    if (!currentPassword || !newPassword) {
        showProfileStatus('Please fill in both password fields', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showProfileStatus('New password must be at least 6 characters', 'error');
        return;
    }

    try {
        const response = await fetch('/api/profile/password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const result = await response.json();

        if (result.success) {
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            showProfileStatus('✓ Password changed successfully!', 'success');
        } else {
            showProfileStatus(result.message || 'Incorrect current password', 'error');
        }
    } catch (error) {
        console.error('Password error:', error);
        showProfileStatus('Error changing password', 'error');
    }
}

// Image cropper
function openImageCropper(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showProfileStatus('Please select an image file', 'error');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showProfileStatus('Image must be less than 10MB', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const cropperImage = document.getElementById('cropper-image');
        cropperImage.src = e.target.result;
        document.getElementById('cropper-modal').classList.add('show');

        cropperImage.onload = function () {
            initCropper(cropperImage);
        };
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function initCropper(image) {
    if (cropper) cropper.destroy();

    if (typeof Cropper === 'undefined') {
        setTimeout(() => initCropper(image), 100);
        return;
    }

    cropper = new Cropper(image, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 0.9,
        cropBoxResizable: true,
        cropBoxMovable: true,
        guides: true,
        center: true,
        responsive: true,
    });
}

function rotateImage(degrees) {
    if (cropper) cropper.rotate(degrees);
}

function zoomImage(ratio) {
    if (cropper) cropper.zoom(ratio);
}

function closeCropperModal() {
    document.getElementById('cropper-modal').classList.remove('show');
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
}

async function saveCroppedImage() {
    if (!cropper) {
        showProfileStatus('Cropper not ready', 'error');
        return;
    }

    try {
        const canvas = cropper.getCroppedCanvas({
            width: 200,
            height: 200,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

        showProfileStatus('Saving...', 'success');
        
        const response = await fetch('/api/profile/avatar', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ avatarUrl: dataUrl })
        });

        const result = await response.json();

        if (result.success) {
            userProfile.avatarUrl = dataUrl;
            closeCropperModal();
            updateProfileDisplay();
            updateNavbarAvatar();
            showProfileStatus('✓ Photo saved!', 'success');
        } else {
            showProfileStatus(result.message || 'Failed to save', 'error');
        }

    } catch (error) {
        console.error('Save error:', error);
        showProfileStatus('Error saving image', 'error');
    }
}


// Remove avatar
async function removeAvatar() {
    if (userProfile && userProfile.id) {
        try {
            const response = await fetch('/api/profile/avatar', {
                method: 'DELETE',
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                userProfile.avatarUrl = null;
                updateProfileDisplay();
                updateNavbarAvatar();
                showProfileStatus('✓ Using initials avatar', 'success');
            } else {
                showProfileStatus(result.message || 'Failed', 'error');
            }
        } catch (error) {
            console.error('Remove error:', error);
            showProfileStatus('Error removing avatar', 'error');
        }
    }
}

// Status message
function showProfileStatus(message, type) {
    const statusEl = document.getElementById('profile-status');
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = `profile-status ${type}`;

    setTimeout(() => {
        statusEl.className = 'profile-status';
    }, 4000);
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadProfile, 300);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeProfileModal();
        closeCropperModal();
    }
});

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('profile-modal-overlay')) closeProfileModal();
    if (e.target.classList.contains('cropper-modal-overlay')) closeCropperModal();
});

// Global
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.loadProfile = loadProfile;
window.openImageCropper = openImageCropper;
window.rotateImage = rotateImage;
window.zoomImage = zoomImage;
window.closeCropperModal = closeCropperModal;
window.saveCroppedImage = saveCroppedImage;
window.removeAvatar = removeAvatar;
window.updateDisplayName = updateDisplayName;
window.changePassword = changePassword;
