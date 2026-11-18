import { App } from './script.js';
import { boot } from './runtime/index.js';
import { bootNeighborhoodSite } from '/packages/agentic-runtime-core/src/index.js';

const filterPills = document.getElementById('filter-pills');
const providerList = document.getElementById('provider-list');
const heldPanel = document.getElementById('held-panel');
const bookingForm = document.getElementById('booking-form');
const bookingsContainer = document.getElementById('bookings-container');
const versionEl = document.getElementById('state-version');
const formErrorEl = document.getElementById('form-error');
const auditStatusEl = document.getElementById('audit-status');

let activeCategory = 'all';

function renderAll(state = App.page.getState()) {
  versionEl.textContent = `state v${state.version}`;

  bookingsContainer.innerHTML = state.bookings
    .map(
      (b) => `
      <div class="booking-banner">
        <div>
          <strong>✓ Booking ${b.confirmationCode} Confirmed (${b.bookedAt})</strong><br>
          <strong>${b.providerName}</strong> • ${b.slotLabel} (${b.durationMinutes}m • $${b.fee}) for <strong>${b.attendeeName}</strong>
          ${b.visitReason ? `<br><span>Note: "${b.visitReason}"</span>` : ''}
        </div>
        <button type="button" class="btn-cancel-booking" data-cancel-code="${b.confirmationCode}">Cancel Slot</button>
      </div>
    `
    )
    .join('');

  const filtered =
    activeCategory === 'all'
      ? state.providers
      : state.providers.filter((p) => p.category === activeCategory);

  providerList.innerHTML = filtered
    .map(
      (p) => `
      <article class="provider-card">
        <div class="prov-cat">${p.category} • ${p.durationMinutes} mins • $${p.fee}</div>
        <h3>${p.name}</h3>
        <div class="prov-meta">📍 ${p.location} — ${p.prepNote}</div>
        <div class="slot-row">
          ${p.slots
            .map((s) => {
              const isHeld = state.selectedSlot?.slotId === s.slotId;
              return `<button type="button" class="slot-btn ${isHeld ? 'selected' : ''}" data-slot-id="${s.slotId}" ${
                !s.available ? 'disabled' : ''
              }>${s.label}${!s.available ? ' (Booked)' : isHeld ? ' ✓ Held' : ''}</button>`;
            })
            .join('')}
        </div>
      </article>
    `
    )
    .join('');

  if (!state.selectedSlot) {
    heldPanel.innerHTML = `<p style="color:var(--muted);font-size:13px;margin:0;">Click any open time slot above (or ask the assistant) to hold it for confirmation.</p>`;
    bookingForm.style.display = 'none';
    return;
  }

  const sel = state.selectedSlot;
  heldPanel.innerHTML = `
    <div class="held-box">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>Held Slot: ${sel.slotLabel}</strong>
        <button type="button" id="release-slot-btn" style="border:none;background:none;color:#991b1b;cursor:pointer;font-size:12px;font-weight:600;">Release</button>
      </div>
      <div style="margin-top:4px;">${sel.providerName} • <strong>$${sel.fee}</strong> (${sel.durationMinutes} mins)</div>
      <div style="font-size:12px;color:var(--muted);margin-top:2px;">📍 ${sel.location}</div>
    </div>
  `;
  bookingForm.style.display = 'grid';
  document.getElementById('release-slot-btn')?.addEventListener('click', () => App.page.clearSelection());
}

filterPills.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-cat]');
  if (!btn) return;
  activeCategory = btn.dataset.cat;
  for (const el of filterPills.querySelectorAll('.pill')) el.classList.toggle('active', el === btn);
  renderAll();
});

providerList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-slot-id]');
  if (!btn || btn.disabled) return;
  App.page.holdSlotSelection(btn.dataset.slotId);
});

bookingsContainer.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-cancel-code]');
  if (!btn) return;
  App.page.cancelBooking(btn.dataset.cancelCode);
});

bookingForm.addEventListener('submit', (e) => {
  e.preventDefault();
  formErrorEl.textContent = '';
  const state = App.page.getState();
  const res = App.page.confirmBooking({
    attendeeName: document.getElementById('attendee-name').value,
    attendeeContact: document.getElementById('attendee-contact').value,
    visitReason: document.getElementById('visit-reason').value,
    expectedVersion: state.version
  });
  if (!res.ok) formErrorEl.textContent = res.reason;
  else bookingForm.reset();
});

App.page.subscribe(renderAll);
renderAll();

bootNeighborhoodSite({
  bootRuntime: boot,
  mountSelector: '#assistant-root',
  siteName: 'Oakwood Community Scheduling',
  onAuditEvent: (events) => {
    if (events[0] && auditStatusEl) {
      auditStatusEl.textContent = `Last check: ${events[0].type.replace(/_/g, ' ')}`;
    }
  }
});