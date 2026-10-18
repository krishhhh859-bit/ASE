/**
 * auth.js
 * Manages Signup and Login form workflows, 15-digit SAN validation,
 * password matching, and authenticated redirection.
 */

document.addEventListener('DOMContentLoaded', () => {
  initSignupForm();
  initLoginForm();
});

// Helper to get redirect parameter from URL
function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  return params.get('redirect') || '/index.html';
}

/**
 * Signup Form Controller
 */
function initSignupForm() {
  const form = document.getElementById('signupForm');
  const sanInput = document.getElementById('sanNumber');
  const sanHelp = document.getElementById('sanHelp');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const alertBox = document.getElementById('authAlert');
  const submitBtn = document.getElementById('signupSubmitBtn');

  if (!form) return;

  // Real-time 15-digit SAN validation feedback
  sanInput?.addEventListener('input', () => {
    const val = sanInput.value.trim();
    if (!val) {
      if (sanHelp) {
        sanHelp.textContent = 'Must be exactly 15 digits (numbers only, leading zeroes preserved).';
        sanHelp.className = 'form-help';
      }
      return;
    }

    if (/^\d{15}$/.test(val)) {
      if (sanHelp) {
        sanHelp.textContent = '✓ Valid 15-digit SAN number.';
        sanHelp.className = 'form-help';
        sanHelp.style.color = 'var(--success)';
      }
    } else {
      if (sanHelp) {
        sanHelp.textContent = `Current length: ${val.length}/15 digits. Only numbers (0-9) allowed.`;
        sanHelp.className = 'form-help invalid';
      }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(alertBox);

    const fullName = document.getElementById('fullName').value.trim();
    const sanNumber = sanInput.value.trim();
    const branch = document.getElementById('branch').value;
    const yearOfStudy = document.getElementById('yearOfStudy').value;
    const email = document.getElementById('email').value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Frontend validations
    if (!fullName) {
      showAlert(alertBox, 'Full name is required.', 'error');
      document.getElementById('fullName').focus();
      return;
    }

    // SAN Validation: Exactly 15 digits
    if (!/^\d{15}$/.test(sanNumber)) {
      showAlert(alertBox, 'SAN number must be exactly 15 digits (numbers only, leading zeroes preserved).', 'error');
      sanInput.focus();
      return;
    }

    if (!branch) {
      showAlert(alertBox, 'Please select your branch of study.', 'error');
      document.getElementById('branch').focus();
      return;
    }

    if (!yearOfStudy) {
      showAlert(alertBox, 'Please select your year of study.', 'error');
      document.getElementById('yearOfStudy').focus();
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert(alertBox, 'Please enter a valid email address.', 'error');
      document.getElementById('email').focus();
      return;
    }

    if (!password || password.length < 6) {
      showAlert(alertBox, 'Password must be at least 6 characters long.', 'error');
      passwordInput.focus();
      return;
    }

    if (password !== confirmPassword) {
      showAlert(alertBox, 'Passwords do not match. Please verify.', 'error');
      confirmPasswordInput.focus();
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Creating Account...';

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          sanNumber,
          branch,
          yearOfStudy,
          email,
          password,
          confirmPassword
        })
      });

      const result = await res.json();

      if (res.ok && result.success) {
        showAlert(alertBox, '✓ ' + result.message + ' Redirecting...', 'success');
        showToast(`Welcome to ASE, ${result.user.fullName}!`, 'success');
        setTimeout(() => {
          window.location.href = getRedirectTarget();
        }, 800);
      } else {
        showAlert(alertBox, result.error || 'Failed to create account.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Create Student Account &rarr;';
      }
    } catch (err) {
      console.error('Signup error:', err);
      showAlert(alertBox, 'Network error during account registration. Ensure server is running.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Create Student Account &rarr;';
    }
  });
}

/**
 * Login Form Controller
 */
function initLoginForm() {
  const form = document.getElementById('loginForm');
  const alertBox = document.getElementById('authAlert');
  const submitBtn = document.getElementById('loginSubmitBtn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(alertBox);

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      showAlert(alertBox, 'Please enter both your email and password.', 'error');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Authenticating...';

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await res.json();

      if (res.ok && result.success) {
        showAlert(alertBox, '✓ ' + result.message + ' Redirecting...', 'success');
        showToast(`Welcome back, ${result.user.fullName}!`, 'success');
        setTimeout(() => {
          window.location.href = getRedirectTarget();
        }, 700);
      } else {
        showAlert(alertBox, result.error || 'Invalid credentials.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Log In &rarr;';
      }
    } catch (err) {
      console.error('Login error:', err);
      showAlert(alertBox, 'Network error during login. Ensure backend server is running.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Log In &rarr;';
    }
  });
}

function showAlert(box, msg, type = 'error') {
  if (!box) return;
  box.className = `alert alert-${type}`;
  box.textContent = msg;
  box.style.display = 'block';
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearAlert(box) {
  if (!box) return;
  box.style.display = 'none';
  box.textContent = '';
}
