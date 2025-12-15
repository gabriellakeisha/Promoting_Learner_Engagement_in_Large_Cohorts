document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
});

async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const btn = document.getElementById('login-btn');
  
  // Disable button
  btn.disabled = true;
  btn.textContent = 'Logging in...';
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showAlert('Login successful! Redirecting...', 'success');
      
      // Redirect based on role
      setTimeout(() => {
        if (result.user.role === 'lecturer') {
          window.location.href = '/lecturer-dashboard';
        } else {
          window.location.href = '/student-dashboard';
        }
      }, 1000);
    } else {
      showAlert(result.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Login';
    }
  } catch (error) {
    console.error('Login error:', error);
    showAlert('An error occurred. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Login';
  }
}

function showAlert(message, type) {
  const container = document.getElementById('alert-container');
  const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
  container.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    container.innerHTML = '';
  }, 5000);
}
