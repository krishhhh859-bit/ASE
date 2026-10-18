/**
 * events.js
 * Controls ASE Events:
 * - Dynamic event cards rendering
 * - Prefill from authenticated account
 * - 15-digit SAN validation
 * - Duplicate registration prevention
 */

let demoEvents = [];
let activeStudent = null;

document.addEventListener('DOMContentLoaded', () => {
  initEvents();

  // Listen for session ready
  window.addEventListener('authReady', (e) => {
    activeStudent = e.detail;
    updateEventAuthBanner();
    if (activeStudent) {
      prefillEventStudentDetails(activeStudent);
    }
  });
});

async function initEvents() {
  const form = document.getElementById('eventRegForm');
  const sanInput = document.getElementById('eventSanNumber');
  const sanHelp = document.getElementById('eventSanHelp');

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

  // Fetch events from backend
  await fetchEvents();

  // Setup form submission
  form?.addEventListener('submit', handleEventRegistration);
}

function updateEventAuthBanner() {
  const banner = document.getElementById('eventAuthNotice');
  const text = document.getElementById('eventAuthText');
  const btn = document.getElementById('eventAuthBtn');

  if (!banner || !text || !btn) return;

  if (activeStudent) {
    banner.style.display = 'flex';
    banner.style.background = 'var(--bg-surface)';
    banner.style.borderColor = 'var(--border-subtle)';
    text.innerHTML = `Signed in as <strong>${activeStudent.fullName}</strong> (SAN: <span class="mono">${activeStudent.sanNumber}</span>). Details prefilled.`;
    btn.textContent = 'Switch Account';
    btn.href = '/login.html?redirect=/events.html';
  } else {
    banner.style.display = 'flex';
    banner.style.background = 'var(--bg-surface)';
    banner.style.borderColor = 'var(--border-subtle)';
    text.innerHTML = `Note: You can <a href="/login.html?redirect=/events.html" style="color: #FFFFFF; text-decoration: underline; font-weight: 600;">Log In</a> or <a href="/signup.html?redirect=/events.html" style="color: #FFFFFF; text-decoration: underline; font-weight: 600;">Sign Up</a> to prefill your 15-digit SAN and details.`;
    btn.textContent = 'Log In First';
    btn.href = '/login.html?redirect=/events.html';
  }
}

function prefillEventStudentDetails(student) {
  const nameField = document.getElementById('eventFullName');
  const sanField = document.getElementById('eventSanNumber');
  const emailField = document.getElementById('eventEmail');

  if (nameField && !nameField.value) nameField.value = student.fullName || '';
  if (sanField && !sanField.value) {
    sanField.value = student.sanNumber || '';
    sanField.dispatchEvent(new Event('input'));
  }
  if (emailField && !emailField.value) emailField.value = student.email || '';
}

async function fetchEvents() {
  const container = document.getElementById('eventsContainer');
  const select = document.getElementById('eventSelect');
  if (!container) return;

  try {
    const res = await fetch('/api/events');
    const data = await res.json();

    if (data.success && Array.isArray(data.events)) {
      demoEvents = data.events;
      renderEvents(demoEvents);
      populateEventSelect(demoEvents);
    } else {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">
          No events available in the calendar.
        </div>
      `;
    }
  } catch (err) {
    console.error('Error fetching events:', err);
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--danger); padding: 2rem;">
        Failed to fetch events from backend. Ensure server is running.
      </div>
    `;
  }
}

function renderEvents(events) {
  const container = document.getElementById('eventsContainer');
  if (!container) return;

  container.innerHTML = events.map(evt => `
    <div class="event-card" id="card-${evt.id}">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.75rem;">
          <span class="badge">${evt.category}</span>
          <span class="badge">DEMO</span>
        </div>

        <h3 class="event-title">${evt.title}</h3>
        <p class="event-desc">${evt.description}</p>

        <ul class="event-details-list">
          <li>
            <span>📅</span>
            <span><strong>Date &amp; Time:</strong> ${evt.event_date}</span>
          </li>
          <li>
            <span>📍</span>
            <span><strong>Venue:</strong> ${evt.venue}</span>
          </li>
          <li>
            <span>👥</span>
            <span><strong>Registered Attendees:</strong> ${evt.attendeeCount || 0}</span>
          </li>
        </ul>
      </div>

      <div>
        <button class="btn btn-secondary btn-lg select-event-btn" data-event-id="${evt.id}">
          Register for this Event &darr;
        </button>
      </div>
    </div>
  `).join('');

  // Attach quick selection buttons
  document.querySelectorAll('.select-event-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const eventId = btn.getAttribute('data-event-id');
      const select = document.getElementById('eventSelect');
      if (select) {
        select.value = eventId;
      }
      document.getElementById('eventFormSection')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('eventFullName')?.focus();
    });
  });
}

function populateEventSelect(events) {
  const select = document.getElementById('eventSelect');
  if (!select) return;

  select.innerHTML = '<option value="" disabled selected>-- Choose an event from the list --</option>';
  events.forEach(evt => {
    const opt = document.createElement('option');
    opt.value = evt.id;
    opt.textContent = `${evt.title} (${evt.event_date})`;
    select.appendChild(opt);
  });
}

async function handleEventRegistration(e) {
  e.preventDefault();
  clearEventAlert();

  const eventId = document.getElementById('eventSelect').value;
  const fullName = document.getElementById('eventFullName').value.trim();
  const sanInput = document.getElementById('eventSanNumber');
  const sanNumber = sanInput.value.trim();
  const email = document.getElementById('eventEmail').value.trim();
  const submitBtn = document.getElementById('eventSubmitBtn');

  // Validations
  if (!eventId) {
    showEventAlert('Please select an event from the dropdown.', 'error');
    document.getElementById('eventSelect').focus();
    return;
  }

  if (!fullName) {
    showEventAlert('Full name is required.', 'error');
    document.getElementById('eventFullName').focus();
    return;
  }

  // Mandatory SAN validation: Exactly 15 digits
  if (!/^\d{15}$/.test(sanNumber)) {
    showEventAlert('SAN number must contain exactly 15 digits (numbers only, leading zeroes preserved).', 'error');
    sanInput.focus();
    return;
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showEventAlert('Please enter a valid email address.', 'error');
    document.getElementById('eventEmail').focus();
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Verifying &amp; Reserving Seat...';

    const res = await fetch('/api/event-registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, fullName, sanNumber, email })
    });

    const result = await res.json();

    if (res.status === 401 && result.requiresAuth) {
      showToast('Please log in or create an account to register for events.', 'amber');
      setTimeout(() => {
        window.location.href = `/login.html?redirect=${encodeURIComponent('/events.html')}`;
      }, 900);
      return;
    }

    if (res.ok && result.success) {
      displayEventConfirmation(result.registration);
      showToast('Event seat registered successfully!', 'success');
      // Refresh event cards to reflect updated attendee count
      fetchEvents();
    } else {
      showEventAlert(result.error || 'Failed to complete event registration.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Confirm Event Registration &rarr;';
    }
  } catch (err) {
    console.error('Event registration error:', err);
    showEventAlert('Network error while saving registration. Ensure backend server is running.', 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Confirm Event Registration &rarr;';
  }
}

function displayEventConfirmation(reg) {
  const formSection = document.getElementById('eventFormSection');
  const confirmCard = document.getElementById('eventConfirmationCard');
  const details = document.getElementById('eventConfirmationDetails');

  if (!formSection || !confirmCard || !details) return;

  details.innerHTML = `
    <div class="conf-row">
      <span class="conf-label">Pass ID:</span>
      <span class="conf-val mono" style="color: #FFFFFF;">${reg.passId}</span>
    </div>
    <div class="conf-row">
      <span class="conf-label">Event:</span>
      <span class="conf-val">${reg.eventTitle}</span>
    </div>
    <div class="conf-row">
      <span class="conf-label">Attendee Name:</span>
      <span class="conf-val">${reg.fullName}</span>
    </div>
    <div class="conf-row">
      <span class="conf-label">SAN Number (15 Digits):</span>
      <span class="conf-val mono">${reg.sanNumber}</span>
    </div>
    <div class="conf-row">
      <span class="conf-label">Email:</span>
      <span class="conf-val">${reg.email}</span>
    </div>
    <div class="conf-row" style="background: #1F1F1F; padding: 0.85rem; border-radius: var(--radius-sm); margin-top: 0.75rem;">
      <span class="conf-label" style="color: #FFFFFF; font-weight: 700;">Status:</span>
      <span class="conf-val" style="color: #FFFFFF; font-weight: 700;">Confirmed</span>
    </div>
  `;

  formSection.style.display = 'none';
  confirmCard.style.display = 'block';
  confirmCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showEventAlert(message, type = 'error') {
  const alert = document.getElementById('eventAlert');
  if (!alert) return;

  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  alert.style.display = 'block';
  alert.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearEventAlert() {
  const alert = document.getElementById('eventAlert');
  if (!alert) return;
  alert.style.display = 'none';
  alert.textContent = '';
}
