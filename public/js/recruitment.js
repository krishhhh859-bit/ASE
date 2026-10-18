/**
 * recruitment.js
 * Controls Recruitment registration:
 * - Domain categorization (Technical, Creative, Management)
 * - 15-digit SAN validation & prefill from authenticated account
 * - Live interview slot availability
 * - Atomic booking submission
 */

let serverConfig = null;
let activeStudent = null;

document.addEventListener('DOMContentLoaded', () => {
  initRecruitment();

  // Listen for session state ready
  window.addEventListener('authReady', (e) => {
    activeStudent = e.detail;
    updateAuthBanner();
    if (activeStudent) {
      prefillStudentDetails(activeStudent);
    }
  });
});

async function initRecruitment() {
  const form = document.getElementById('recruitmentForm');
  const dateSelect = document.getElementById('interviewDate');
  const sanInput = document.getElementById('sanNumber');
  const sanHelp = document.getElementById('sanHelp');

  // Real-time SAN validator
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

  // Fetch server configuration
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.success) {
      serverConfig = data;
      populateBranches(data.branches);
      populateCategorizedDomains(data.domainCategories);
      populateInterviewDates(data.availableDates);

      if (activeStudent) {
        prefillStudentDetails(activeStudent);
      }
    }
  } catch (err) {
    console.error('Failed to load recruitment config:', err);
    showAlert('Failed to connect to backend configuration. Ensure server is running.', 'error');
  }

  // Interview Date Change Handler
  dateSelect?.addEventListener('change', () => {
    const selectedDate = dateSelect.value;
    if (selectedDate) {
      fetchAvailableSlots(selectedDate);
    } else {
      clearSlots();
    }
  });

  // Form Submit Handler
  form?.addEventListener('submit', handleRecruitmentSubmit);
}

function updateAuthBanner() {
  const banner = document.getElementById('authNoticeBanner');
  const text = document.getElementById('authNoticeText');
  const btn = document.getElementById('authNoticeBtn');

  if (!banner || !text || !btn) return;

  if (activeStudent) {
    banner.style.display = 'flex';
    banner.style.background = 'var(--bg-surface)';
    banner.style.borderColor = 'var(--border-subtle)';
    text.innerHTML = `Signed in as <strong>${activeStudent.fullName}</strong> (SAN: <span class="mono">${activeStudent.sanNumber}</span>). Details prefilled.`;
    btn.textContent = 'Switch Account';
    btn.href = '/login.html?redirect=/recruitment.html';
  } else {
    banner.style.display = 'flex';
    banner.style.background = 'var(--bg-surface)';
    banner.style.borderColor = 'var(--border-subtle)';
    text.innerHTML = `Note: You can <a href="/login.html?redirect=/recruitment.html" style="color: #FFFFFF; text-decoration: underline; font-weight: 600;">Log In</a> or <a href="/signup.html?redirect=/recruitment.html" style="color: #FFFFFF; text-decoration: underline; font-weight: 600;">Sign Up</a> to automatically link and prefill your registration.`;
    btn.textContent = 'Log In First';
    btn.href = '/login.html?redirect=/recruitment.html';
  }
}

function prefillStudentDetails(student) {
  const nameField = document.getElementById('fullName');
  const sanField = document.getElementById('sanNumber');
  const emailField = document.getElementById('email');
  const branchField = document.getElementById('branch');
  const yearField = document.getElementById('yearOfStudy');

  if (nameField && !nameField.value) nameField.value = student.fullName || '';
  if (sanField && !sanField.value) {
    sanField.value = student.sanNumber || '';
    sanField.dispatchEvent(new Event('input'));
  }
  if (emailField && !emailField.value) emailField.value = student.email || '';
  if (branchField && student.branch) branchField.value = student.branch;
  if (yearField && student.yearOfStudy) yearField.value = student.yearOfStudy;
}

function populateBranches(branches) {
  const select = document.getElementById('branch');
  if (!select || !branches) return;

  branches.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    select.appendChild(opt);
  });
}

function populateCategorizedDomains(categories) {
  const techContainer = document.getElementById('techDomainsContainer');
  const creativeContainer = document.getElementById('creativeDomainsContainer');
  const managementContainer = document.getElementById('managementDomainsContainer');

  if (!categories) return;

  // Technical
  if (techContainer && categories.technical) {
    techContainer.innerHTML = categories.technical.map((d, i) => `
      <label class="domain-check-label">
        <input type="checkbox" name="domains" value="${d}" id="tech_${i}">
        <span>${d}</span>
      </label>
    `).join('');
  }

  // Creative
  if (creativeContainer && categories.creative) {
    creativeContainer.innerHTML = categories.creative.map((d, i) => `
      <label class="domain-check-label">
        <input type="checkbox" name="domains" value="${d}" id="creative_${i}">
        <span>${d}</span>
      </label>
    `).join('');
  }

  // Management
  if (managementContainer && categories.management) {
    managementContainer.innerHTML = categories.management.map((d, i) => `
      <label class="domain-check-label">
        <input type="checkbox" name="domains" value="${d}" id="mgmt_${i}">
        <span>${d}</span>
      </label>
    `).join('');
  }
}

function populateInterviewDates(dates) {
  const select = document.getElementById('interviewDate');
  if (!select || !dates) return;

  dates.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = `${d} (Configured Fixed Slots)`;
    select.appendChild(opt);
  });
}

async function fetchAvailableSlots(dateStr) {
  const container = document.getElementById('slotsContainer');
  const statusMsg = document.getElementById('slotStatusMsg');
  if (!container) return;

  container.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 1.5rem; font-family: var(--font-mono); font-size: 0.9rem;">
      Checking real-time slot availability for ${dateStr}...
    </div>
  `;
  if (statusMsg) statusMsg.textContent = '(Checking slots in database...)';

  try {
    const res = await fetch(`/api/interview-slots?date=${encodeURIComponent(dateStr)}`);
    const data = await res.json();

    if (!data.success || !data.slots || data.slots.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; color: var(--danger); font-size: 0.9rem; padding: 1rem;">
          No interview slots configured for this date.
        </div>
      `;
      if (statusMsg) statusMsg.textContent = '(No slots available)';
      return;
    }

    const availableCount = data.slots.filter(s => s.isAvailable).length;
    if (statusMsg) {
      statusMsg.textContent = `(${availableCount} of ${data.slots.length} slots available)`;
      statusMsg.style.color = availableCount > 0 ? 'var(--accent-teal)' : 'var(--danger)';
    }

    container.innerHTML = data.slots.map((slot, idx) => {
      const radioId = `slot_${idx}`;
      if (slot.isAvailable) {
        return `
          <div>
            <input 
              type="radio" 
              id="${radioId}" 
              name="interviewTime" 
              value="${slot.time}" 
              class="slot-radio" 
              required
            >
            <label for="${radioId}" class="slot-btn">
              <span>${slot.time}</span>
              <span class="slot-status available">Available</span>
            </label>
          </div>
        `;
      } else {
        return `
          <div>
            <input 
              type="radio" 
              id="${radioId}" 
              name="interviewTime" 
              value="${slot.time}" 
              class="slot-radio" 
              disabled
            >
            <label for="${radioId}" class="slot-btn disabled" title="This slot is already booked">
              <span>${slot.time}</span>
              <span class="slot-status booked">Booked</span>
            </label>
          </div>
        `;
      }
    }).join('');

  } catch (err) {
    console.error('Error fetching slots:', err);
    container.innerHTML = `
      <div style="grid-column: 1/-1; color: var(--danger); font-size: 0.9rem;">
        Failed to fetch slots. Ensure Express backend is running.
      </div>
    `;
  }
}

function clearSlots() {
  const container = document.getElementById('slotsContainer');
  const statusMsg = document.getElementById('slotStatusMsg');
  if (container) container.innerHTML = '';
  if (statusMsg) {
    statusMsg.textContent = '(Please select a date first)';
    statusMsg.style.color = 'var(--text-muted)';
  }
}

async function handleRecruitmentSubmit(e) {
  e.preventDefault();
  clearAlert();

  const sanInput = document.getElementById('sanNumber');
  const sanNumber = sanInput.value.trim();
  const fullName = document.getElementById('fullName').value.trim();
  const branch = document.getElementById('branch').value;
  const yearOfStudy = document.getElementById('yearOfStudy').value;
  const email = document.getElementById('email').value.trim();
  const interviewDate = document.getElementById('interviewDate').value;
  const submitBtn = document.getElementById('recruitmentSubmitBtn');

  // Domains
  const checkedDomains = [];
  document.querySelectorAll('input[name="domains"]:checked').forEach(cb => {
    checkedDomains.push(cb.value);
  });

  // Selected Slot
  const selectedSlotRadio = document.querySelector('input[name="interviewTime"]:checked');
  const interviewTime = selectedSlotRadio ? selectedSlotRadio.value : '';

  // Mandatory Validations
  if (!/^\d{15}$/.test(sanNumber)) {
    showAlert('SAN number must contain exactly 15 digits (numbers only, leading zeroes preserved).', 'error');
    sanInput.focus();
    return;
  }

  if (!fullName) {
    showAlert('Full name is required.', 'error');
    document.getElementById('fullName').focus();
    return;
  }

  if (!branch) {
    showAlert('Please select your branch of study.', 'error');
    document.getElementById('branch').focus();
    return;
  }

  if (!yearOfStudy) {
    showAlert('Please select your year of study.', 'error');
    document.getElementById('yearOfStudy').focus();
    return;
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAlert('Please enter a valid email address.', 'error');
    document.getElementById('email').focus();
    return;
  }

  if (checkedDomains.length === 0) {
    showAlert('Please select at least one domain preference.', 'error');
    document.getElementById('techDomainsContainer')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (!interviewDate) {
    showAlert('Please select an interview date.', 'error');
    document.getElementById('interviewDate').focus();
    return;
  }

  if (!interviewTime) {
    showAlert('Please select an available interview time slot.', 'error');
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Verifying Slot &amp; Saving Registration...';

    const res = await fetch('/api/recruitment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sanNumber,
        fullName,
        branch,
        yearOfStudy,
        email,
        domains: checkedDomains,
        interviewDate,
        interviewTime
      })
    });

    const result = await res.json();

    if (res.status === 401 && result.requiresAuth) {
      showToast('Please log in or create an account to submit your registration.', 'amber');
      setTimeout(() => {
        window.location.href = `/login.html?redirect=${encodeURIComponent('/recruitment.html')}`;
      }, 900);
      return;
    }

    if (res.ok && result.success) {
      displayConfirmation(result.registration);
      showToast('Interview slot successfully confirmed!', 'success');
    } else {
      showAlert(result.error || 'Failed to submit recruitment registration.', 'error');
      // If slot conflict, refresh slots so the candidate sees updated availability
      if (res.status === 409 && interviewDate) {
        fetchAvailableSlots(interviewDate);
      }
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Confirm &amp; Book Interview Slot &rarr;';
    }
  } catch (err) {
    console.error('Recruitment submit error:', err);
    showAlert('Network error while saving registration. Check backend connection.', 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Confirm &amp; Book Interview Slot &rarr;';
  }
}

function displayConfirmation(reg) {
  const formSection = document.getElementById('formSection');
  const confirmCard = document.getElementById('confirmationCard');
  const details = document.getElementById('confirmationDetails');

  if (!formSection || !confirmCard || !details) return;

  details.innerHTML = `
    <div class="conf-row">
      <span class="conf-label">Reference ID:</span>
      <span class="conf-val mono" style="color: #FFFFFF;">${reg.referenceId}</span>
    </div>
    <div class="conf-row">
      <span class="conf-label">Candidate Name:</span>
      <span class="conf-val">${reg.fullName}</span>
    </div>
    <div class="conf-row">
      <span class="conf-label">SAN Number (15 Digits):</span>
      <span class="conf-val mono">${reg.sanNumber}</span>
    </div>
    <div class="conf-row">
      <span class="conf-label">Branch &amp; Year:</span>
      <span class="conf-val">${reg.branch} (${reg.yearOfStudy})</span>
    </div>
    <div class="conf-row">
      <span class="conf-label">Email Address:</span>
      <span class="conf-val">${reg.email}</span>
    </div>
    <div class="conf-row">
      <span class="conf-label">Domain Preferences:</span>
      <span class="conf-val">${(reg.domains || []).join(', ')}</span>
    </div>
    <div class="conf-row" style="background: #1F1F1F; padding: 0.85rem; border-radius: var(--radius-sm); margin-top: 0.75rem;">
      <span class="conf-label" style="color: #FFFFFF; font-weight: 700;">Interview Appointment:</span>
      <span class="conf-val mono" style="color: #FFFFFF; font-weight: 700;">${reg.interviewDate} @ ${reg.interviewTime}</span>
    </div>
  `;

  formSection.style.display = 'none';
  confirmCard.style.display = 'block';
  confirmCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showAlert(message, type = 'error') {
  const alert = document.getElementById('recruitmentAlert');
  if (!alert) return;

  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  alert.style.display = 'block';
  alert.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearAlert() {
  const alert = document.getElementById('recruitmentAlert');
  if (!alert) return;
  alert.style.display = 'none';
  alert.textContent = '';
}
