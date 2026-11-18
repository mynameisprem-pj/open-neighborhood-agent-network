import { App } from './script.js';
import { boot } from './runtime/index.js';
import { bootNeighborhoodSite } from '/packages/agentic-runtime-core/src/index.js';

const serviceGrid = document.getElementById('service-grid');
const draftPanel = document.getElementById('draft-panel');
const dispatchesContainer = document.getElementById('dispatches-container');
const versionEl = document.getElementById('state-version');
const dispatchForm = document.getElementById('dispatch-form');
const formErrorEl = document.getElementById('form-error');
const auditStatusEl = document.getElementById('audit-status');

function renderAll(state = App.page.getState()) {
  versionEl.textContent = `state v${state.version}`;

  dispatchesContainer.innerHTML = state.activeDispatches
    .map(
      (d) => `
      <div class="dispatch-banner">
        <strong>✓ Ticket ${d.ticketNumber} Scheduled (${d.createdAt})</strong><br>
        <strong>${d.serviceName}</strong> (${d.estimatedHours}h • ${d.preferredWindow}) for <strong>${d.customerName}</strong> at ${d.serviceAddress} •
        Est. Total: <strong>$${d.estimate.estimatedTotal.toFixed(2)}</strong>
      </div>
    `
    )
    .join('');

  serviceGrid.innerHTML = state.services
    .map(
      (s) => `
      <article class="svc-card">
        <div>
          <div class="svc-cat">${s.category}</div>
          <h3>${s.name}</h3>
          <div class="svc-rate">$${s.calloutFee} callout + $${s.hourlyRate}/hr (min ${s.minHours}h)</div>
          <p class="svc-desc">${s.summary}</p>
          <div>${s.windows.map((w) => `<span class="win-chip">${w}</span>`).join('')}</div>
        </div>
        <button type="button" class="btn-select" data-svc-id="${s.id}">Configure Estimate</button>
      </article>
    `
    )
    .join('');

  if (!state.draft || !state.estimate) {
    draftPanel.innerHTML = `<p style="color:var(--muted);font-size:13px;margin:0;">No active service estimate yet. Select a service card above or ask the CivicFix assistant to build a quote.</p>`;
    dispatchForm.style.display = 'none';
    return;
  }

  const d = state.draft;
  const e = state.estimate;
  const svc = state.services.find((s) => s.id === d.serviceId);

  draftPanel.innerHTML = `
    <div class="estimate-box">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>${d.serviceName}</strong>
        <button type="button" id="clear-draft-btn" style="border:none;background:none;color:#b91c1c;cursor:pointer;font-size:12px;font-weight:600;">Clear</button>
      </div>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr; margin-top:10px;">
        <label style="font-size:12px;">Hours
          <input type="number" id="draft-hours" min="${svc.minHours}" max="8" value="${d.estimatedHours}">
        </label>
        <label style="font-size:12px;">Window
          <select id="draft-window">
            ${svc.windows.map((w) => `<option value="${w}" ${w === d.preferredWindow ? 'selected' : ''}>${w}</option>`).join('')}
          </select>
        </label>
        <label style="font-size:12px;">Priority
          <select id="draft-urgency">
            <option value="standard" ${d.urgency === 'standard' ? 'selected' : ''}>Standard ($0)</option>
            <option value="urgent_same_day" ${d.urgency === 'urgent_same_day' ? 'selected' : ''}>Urgent Same-Day (+$35)</option>
          </select>
        </label>
      </div>
      ${d.issueNotes ? `<div style="margin-top:8px;font-size:12px;color:var(--muted);">Task note: "${d.issueNotes}"</div>` : ''}
      <div style="margin-top:10px;padding-top:8px;border-top:1px dashed var(--border);display:flex;justify-content:space-between;font-weight:800;font-size:15px;">
        <span>Upfront Estimate ($${e.calloutFee} callout + $${e.labor} labor${e.urgentFee ? ' + $35 urgent' : ''})</span>
        <span>$${e.estimatedTotal.toFixed(2)}</span>
      </div>
    </div>
  `;
  dispatchForm.style.display = 'grid';

  document.getElementById('clear-draft-btn')?.addEventListener('click', () => App.page.clearDraft());
  const syncDraft = () => {
    App.page.configureServiceDraft({
      serviceId: d.serviceId,
      estimatedHours: Number(document.getElementById('draft-hours').value),
      preferredWindow: document.getElementById('draft-window').value,
      urgency: document.getElementById('draft-urgency').value,
      issueNotes: d.issueNotes
    });
  };
  document.getElementById('draft-hours')?.addEventListener('change', syncDraft);
  document.getElementById('draft-window')?.addEventListener('change', syncDraft);
  document.getElementById('draft-urgency')?.addEventListener('change', syncDraft);
}

serviceGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-svc-id]');
  if (!btn) return;
  const svc = App.page.getState().services.find((s) => s.id === btn.dataset.svcId);
  if (svc) {
    App.page.configureServiceDraft({ serviceId: svc.id, estimatedHours: svc.minHours });
  }
});

dispatchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  formErrorEl.textContent = '';
  const state = App.page.getState();
  const res = App.page.confirmDispatch({
    customerName: document.getElementById('cust-name').value,
    serviceAddress: document.getElementById('cust-address').value,
    contactPhone: document.getElementById('cust-phone').value,
    expectedVersion: state.version
  });
  if (!res.ok) formErrorEl.textContent = res.reason;
  else dispatchForm.reset();
});

App.page.subscribe(renderAll);
renderAll();

bootNeighborhoodSite({
  bootRuntime: boot,
  mountSelector: '#assistant-root',
  siteName: 'CivicFix Local Services',
  onAuditEvent: (events) => {
    if (events[0] && auditStatusEl) {
      auditStatusEl.textContent = `Last check: ${events[0].type.replace(/_/g, ' ')}`;
    }
  }
}).then(() => {
  const prefill = new URLSearchParams(window.location.search).get('prompt');
  if (prefill) {
    const input = document.querySelector('#assistant-root textarea, #assistant-root input[type="text"]');
    if (input) {
      input.value = prefill;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
  }
});