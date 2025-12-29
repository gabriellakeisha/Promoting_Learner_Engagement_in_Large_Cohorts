// Dark mode toggle functionality
(function() {
  // Check for saved dark mode preference
  const darkModeEnabled = localStorage.getItem('darkMode') === 'true';
  
  // Apply dark mode if previously enabled
  if (darkModeEnabled) {
    document.body.classList.add('dark-mode');
  }
  
  // Create toggle button
  const toggleButton = document.createElement('button');
  toggleButton.className = 'dark-mode-toggle';
  toggleButton.setAttribute('aria-label', 'Toggle dark mode');
  toggleButton.innerHTML = darkModeEnabled ? '☀️' : '🌙';
  toggleButton.title = darkModeEnabled ? 'Switch to light mode' : 'Switch to dark mode';
  
  // Add button to page
  document.body.appendChild(toggleButton);
  
  // Toggle functionality
  toggleButton.addEventListener('click', function() {
    const isDark = document.body.classList.toggle('dark-mode');
    
    // Update button icon and title
    toggleButton.innerHTML = isDark ? '☀️' : '🌙';
    toggleButton.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    
    // Save preference
    localStorage.setItem('darkMode', isDark);
    
    // Optional: Show toast notification
    showToast(isDark ? 'Dark mode enabled' : 'Light mode enabled');
  });
  
  // Simple toast notification (optional)
  function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--primary-color);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Fade in
    setTimeout(() => toast.style.opacity = '1', 10);
    
    // Fade out and remove
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 2000);
  }
})();
