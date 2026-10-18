/**
 * app.js
 * Global client script for ASE Portal:
 * - Session awareness via /api/auth/me
 * - Dynamic header auth states (User badge, Logout button, Login/Signup links)
 * - Toast notification system
 */

let currentUser = null;

// Toast notification helper
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  if (type === 'error') toast.style.borderLeftColor = 'var(--danger)';
  else if (type === 'success') toast.style.borderLeftColor = 'var(--success)';
  else toast.style.borderLeftColor = '#FFFFFF';

  toast.innerHTML = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// Initialize navbar and session state
async function initSessionState() {
  const headerAuth = document.getElementById('headerAuth');
  const activePath = window.location.pathname.replace(/\/$/, '') || '/index.html';

  // Highlight active nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === activePath || (activePath.endsWith('index.html') && href === '/') || (activePath === '' && href === '/')) {
      link.classList.add('active');
    } else if (href && activePath.endsWith(href)) {
      link.classList.add('active');
    }
  });

  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();

    if (data.authenticated && data.user) {
      currentUser = data.user;
      if (headerAuth) {
        headerAuth.innerHTML = `
          <div class="user-badge-header" title="Logged in as ${currentUser.email}">
            <span class="indicator-dot"></span>
            <span>${currentUser.fullName.split(' ')[0]}</span>
            <span class="mono" style="font-size: 0.75rem; color: var(--text-muted);">(${currentUser.sanNumber.slice(-4)})</span>
          </div>
          <button id="logoutBtn" class="btn btn-secondary btn-sm" title="Sign out of ASE">
            Logout
          </button>
        `;

        document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
      }
      window.dispatchEvent(new CustomEvent('authReady', { detail: currentUser }));
    } else {
      currentUser = null;
      if (headerAuth) {
        headerAuth.innerHTML = `
          <a href="/login.html" class="btn btn-secondary btn-sm">Log In</a>
          <a href="/signup.html" class="btn btn-primary btn-sm">Sign Up</a>
        `;
      }
      window.dispatchEvent(new CustomEvent('authReady', { detail: null }));
    }
  } catch (err) {
    console.error('Session state verification error:', err);
    if (headerAuth) {
      headerAuth.innerHTML = `
        <a href="/login.html" class="btn btn-secondary btn-sm">Log In</a>
        <a href="/signup.html" class="btn btn-primary btn-sm">Sign Up</a>
      `;
    }
  }
}

// Global logout handler
async function handleLogout() {
  try {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await res.json();
    if (result.success) {
      showToast('Logged out successfully.', 'info');
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 500);
    }
  } catch (err) {
    console.error('Logout error:', err);
    showToast('Network error during logout.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', initSessionState);
