import { App } from './script.js';
import { boot } from './runtime/index.js';
import { bootNeighborhoodSite } from '../../packages/agentic-runtime-core/src/index.js';

const peerGrid = document.getElementById('peer-grid');
const planContainer = document.getElementById('plan-container');
const planVersionEl = document.getElementById('plan-version');
const sharedBox = document.getElementById('priv-shared-list');
const blockedBox = document.getElementById('priv-blocked-list');
const auditListEl = document.getElementById('audit-list');
const refreshPeersBtn = document.getElementById('refresh-peers-btn');
const resetConsentBtn = document.getElementById('reset-consent-btn');
const customPeerForm = document.getElementById('custom-peer-form');

const SAMPLE_PROMPTS_BY_CAT = {
  food: 'Ask Hearth & Crumb Kitchen what kinds of dishes and vegan/gluten-free options it offers, then pin it to my plan.',
  services: 'Ask CivicFix Local Services what home repairs and errand services it offers, then pin it to my plan.',
  appointments: 'Ask Oakwood Community Scheduling what clinic, tutoring, and equipment bookings it offers, then pin it to my plan.'
};

function sendPromptToChat(text) {
  const input = document.querySelector('#assistant-root textarea, #assistant-root input[type="text"]');
  if (!input) return;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
}

function renderSnapshot(snap = App.page.getSnapshot()) {
  planVersionEl.textContent = `plan v${snap.version}`;

  // 1. Render Probed Neighborhood Directory
  peerGrid.innerHTML = snap.directory
    .map((p) => {
      const online = p.status === 'online';
      const prompt = SAMPLE_PROMPTS_BY_CAT[p.category] || `Ask ${p.title} what it offers.`;
      return `
        <article class="peer-card">
          <div>
            <div class="peer-top">
              <span class="cat-tag">${p.category}</span>
              <span class="status-dot ${online ? 'status-online' : 'status-offline'}">
                ${online ? '● Manifest Verified' : '○ Offline'}
              </span>
            </div>
            <h3>${p.title}</h3>
            <p class="peer-summary">${p.summary}</p>
            <div class="peer-meta">${p.networkUrl}</div>
          </div>
          <div class="peer-actions">
            <button type="button" class="btn btn-ask" data-ask-prompt="${prompt.replace(/"/g, '&quot;')}">
              Ask via Hub
            </button>
            <a class="btn btn-visit" href="${p.siteUrl}" target="_blank" rel="noopener">
              Open Site ↗
            </a>
          </div>
        </article>
      `;
    })
    .join('');

  // 2. Render Saved Action Plan Handoffs
  if (snap.planItems.length === 0) {
    planContainer.innerHTML = `<p style="color:var(--muted);font-size:13px;margin:0;">Your multi-site action plan is empty. Ask the Hub assistant to consult local partners and pin options here!</p>`;
  } else {
    planContainer.innerHTML = snap.planItems
      .map(
        (item) => `
        <div class="plan-item">
          <div style="max-width:68%;">
            <div class="cat-tag">${item.category} • Saved ${item.createdAt}</div>
            <strong style="font-size:15px;">${item.businessTitle}</strong>
            <div style="font-size:13px;color:var(--muted);margin-top:2px;">${item.summary}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <a class="plan-cta" href="${item.handoffUrl}" target="_blank" rel="noopener">
              Continue on Site →
            </a>
            <button type="button" data-remove-plan="${item.id}" style="border:1px solid var(--border);background:#fff;border-radius:8px;padding:7px 10px;cursor:pointer;font-size:12px;">✕</button>
          </div>
        </div>
      `
      )
      .join('');
  }

  // 3. Render Privacy Vault (sly_data Filter)
  const raw = snap.rawResidentProfile || {};
  const allowSet = new Set(snap.allowedPeerContextKeys || []);
  sharedBox.innerHTML = Object.entries(raw)
    .filter(([k]) => allowSet.has(k))
    .map(([k, v]) => `<div>✓ <strong>${k}:</strong> ${v}</div>`)
    .join('');
  blockedBox.innerHTML = Object.entries(raw)
    .filter(([k]) => !allowSet.has(k))
    .map(([k, v]) => `<div>✕ <strong>${k}:</strong> ${v}</div>`)
    .join('');
}

peerGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-ask-prompt]');
  if (btn) sendPromptToChat(btn.dataset.askPrompt);
});

planContainer.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove-plan]');
  if (btn) App.page.removePlanItem(btn.dataset.removePlan);
});

refreshPeersBtn.addEventListener('click', () => App.page.refreshDirectory());

customPeerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('peer-title').value;
  const origin = document.getElementById('peer-origin').value;
  const category = document.getElementById('peer-cat').value;
  const res = await App.page.addCustomSite({ title, origin, category });
  if (res.ok) customPeerForm.reset();
});

App.page.subscribe(renderSnapshot);

// Probe all local business manifests immediately, then boot Hub runtime
await App.page.refreshDirectory();

const runtimeCtx = await bootNeighborhoodSite({
  bootRuntime: boot,
  mountSelector: '#assistant-root',
  siteName: 'Oakwood Neighborhood Hub',
  privateContextProvider: () => App.page.getSnapshot().rawResidentProfile,
  allowedPeerContextKeys: App.page.getSnapshot().allowedPeerContextKeys,
  peerTitlesByOrigin: {
    'http://localhost:4101': 'Hearth & Crumb Kitchen',
    'http://localhost:4102': 'CivicFix Local Services',
    'http://localhost:4103': 'Oakwood Community Scheduling'
  },
  onAuditEvent: (events) => {
    auditListEl.innerHTML = events
      .slice(0, 6)
      .map(
        (ev) => `
        <li class="audit-item">
          <span><strong>${ev.type.replace(/_/g, ' ')}</strong> ${ev.peerTitle ? `• ${ev.peerTitle}` : ''}</span>
          <span style="color:var(--muted);">${ev.outcome}</span>
        </li>
      `
      )
      .join('');
  }
});

resetConsentBtn.addEventListener('click', () => {
  runtimeCtx.dialogs.clearSessionConsents();
  runtimeCtx.engine.consent?.clear?.();
  auditListEl.innerHTML = `<li class="audit-item"><span>Session peer consents reset — next partner call will prompt again.</span></li>`;
});