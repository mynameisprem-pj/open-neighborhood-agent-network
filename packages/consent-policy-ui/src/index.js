/**
 * @open-neighborhood/consent-policy-ui
 * Reusable Shadow-DOM Peer Network Consent & Write-Action Confirmation UI
 * for the Open Agentic Web.
 */

const STYLES = `
  :host {
    all: initial;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.58);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 2147483646;
    animation: fadeIn 140ms ease-out;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .card {
    background: #ffffff;
    color: #0f172a;
    width: 100%;
    max-width: 460px;
    border-radius: 16px;
    box-shadow: 0 24px 48px -12px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(15, 23, 42, 0.08);
    overflow: hidden;
  }
  .header {
    padding: 20px 22px 14px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .badge-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
  }
  .badge-peer { background: #eff6ff; color: #1d4ed8; }
  .badge-write { background: #fef3c7; color: #b45309; }
  .title-wrap h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    line-height: 1.3;
  }
  .subtitle {
    margin: 4px 0 0;
    font-size: 13px;
    color: #475569;
  }
  .body {
    padding: 16px 22px;
    font-size: 14px;
    line-height: 1.5;
    color: #334155;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .origin-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 8px 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    color: #0f172a;
    word-break: break-all;
  }
  .section-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 10px 12px;
  }
  .section-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
    margin-bottom: 6px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    font-size: 12px;
    padding: 3px 8px;
    border-radius: 999px;
    font-weight: 500;
  }
  .chip-shared { background: #dcfce7; color: #166534; }
  .chip-blocked { background: #fee2e2; color: #991b1b; }
  .chip-neutral { background: #e2e8f0; color: #334155; }
  .kv-list {
    margin: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    font-size: 13px;
  }
  .kv-key { font-weight: 600; color: #475569; }
  .kv-val { color: #0f172a; word-break: break-word; }
  .footer {
    padding: 14px 22px 18px;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  }
  button {
    appearance: none;
    border-radius: 9px;
    padding: 9px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background 120ms ease, transform 80ms ease;
  }
  button:active { transform: scale(0.98); }
  .btn-cancel {
    background: #ffffff;
    border-color: #cbd5e1;
    color: #334155;
  }
  .btn-cancel:hover { background: #f1f5f9; }
  .btn-secondary {
    background: #eff6ff;
    border-color: #bfdbfe;
    color: #1d4ed8;
  }
  .btn-secondary:hover { background: #dbeafe; }
  .btn-primary {
    background: #0f172a;
    color: #ffffff;
  }
  .btn-primary:hover { background: #1e293b; }
`;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createTrustDialogs({ sessionStore = window.sessionStorage } = {}) {
  const SESSION_KEY = 'onaw_session_consented_peers_v1';

  function getSessionPeers() {
    try {
      return new Set(JSON.parse(sessionStore?.getItem(SESSION_KEY) || '[]'));
    } catch {
      return new Set();
    }
  }

  function rememberSessionPeer(peerKey) {
    try {
      const peers = getSessionPeers();
      peers.add(peerKey);
      sessionStore?.setItem(SESSION_KEY, JSON.stringify([...peers]));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }

  function mountModal(innerHtml, bindHandlers) {
    return new Promise((resolve) => {
      const host = document.createElement('div');
      host.setAttribute('data-onaw-trust-dialog', 'true');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `<style>${STYLES}</style><div class="backdrop" role="dialog" aria-modal="true">${innerHtml}</div>`;
      document.body.appendChild(host);

      const cleanup = (result) => {
        window.removeEventListener('keydown', onKey);
        host.remove();
        resolve(result);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') cleanup({ approved: false, reason: 'escape_pressed' });
      };
      window.addEventListener('keydown', onKey);
      bindHandlers(shadow, cleanup);
    });
  }

  /**
   * Prompts the visitor before loading or delegating to an external peer network.
   * Compatible with both boolean expectations and rich structured decision inspectability.
   */
  async function requestPeerConsent(req = {}) {
    const peerUrl = req.peerUrl || req.url || req.targetUrl || 'Unknown peer URL';
    const peerTitle = req.peerTitle || req.networkName || req.name || 'Neighborhood Partner Service';
    const policyMode = req.peerPolicy || 'allowlist';
    const taskSummary = req.taskSummary || req.reason || 'Check live availability and options for your request.';
    const sharedKeys = Array.isArray(req.sharedContextKeys) ? req.sharedContextKeys : [];
    const strippedKeys = Array.isArray(req.strippedContextKeys) ? req.strippedContextKeys : [];

    if (getSessionPeers().has(peerUrl)) {
      return { approved: true, scope: 'session_cached', peerUrl };
    }

    const sharedMarkup = sharedKeys.length
      ? sharedKeys.map((k) => `<span class="chip chip-shared">✓ Shared: ${escapeHtml(k)}</span>`).join('')
      : `<span class="chip chip-neutral">Public prompt only (no private profile fields shared)</span>`;

    const strippedMarkup = strippedKeys.length
      ? strippedKeys.map((k) => `<span class="chip chip-blocked">✕ Withheld: ${escapeHtml(k)}</span>`).join('')
      : '';

    const html = `
      <div class="card">
        <div class="header">
          <div class="badge-icon badge-peer">🛡️</div>
          <div class="title-wrap">
            <h2>Connect to ${escapeHtml(peerTitle)}?</h2>
            <p class="subtitle">Explicit Peer Network Handoff • Policy: <strong>${escapeHtml(policyMode)}</strong></p>
          </div>
        </div>
        <div class="body">
          <div>Your assistant wants to load this independent website's agent network in your browser:</div>
          <div class="origin-pill">🔗 ${escapeHtml(peerUrl)}</div>
          <div class="section-box">
            <div class="section-label">Task to Delegate</div>
            <div>${escapeHtml(taskSummary)}</div>
          </div>
          <div class="section-box">
            <div class="section-label">Private Context Boundary (sly_data Filter)</div>
            <div class="chips">${sharedMarkup}${strippedMarkup}</div>
          </div>
        </div>
        <div class="footer">
          <button type="button" class="btn-cancel" data-action="decline">Decline</button>
          <button type="button" class="btn-secondary" data-action="session">Allow for Session</button>
          <button type="button" class="btn-primary" data-action="once">Allow Once</button>
        </div>
      </div>
    `;

    return mountModal(html, (shadow, cleanup) => {
      shadow.querySelector('[data-action="decline"]').addEventListener('click', () => {
        cleanup({ approved: false, scope: 'declined', peerUrl });
      });
      shadow.querySelector('[data-action="once"]').addEventListener('click', () => {
        cleanup({ approved: true, scope: 'once', peerUrl });
      });
      shadow.querySelector('[data-action="session"]').addEventListener('click', () => {
        rememberSessionPeer(peerUrl);
        cleanup({ approved: true, scope: 'session', peerUrl });
      });
    });
  }

  /**
   * Prompts the visitor before executing any write / irreversible site action.
   */
  async function requestWriteConfirmation(actionReq = {}) {
    const title = actionReq.title || actionReq.toolName || actionReq.name || 'Confirm Site Action';
    const siteName = actionReq.siteName || window.location.host;
    const summary = actionReq.summary || actionReq.description || 'This action will update live state on this page.';
    const params = actionReq.args || actionReq.parameters || {};

    const entries = Object.entries(params);
    const detailsHtml = entries.length
      ? `<dl class="kv-list">${entries
          .map(
            ([k, v]) =>
              `<dt class="kv-key">${escapeHtml(k)}</dt><dd class="kv-val">${escapeHtml(
                typeof v === 'object' ? JSON.stringify(v) : v
              )}</dd>`
          )
          .join('')}</dl>`
      : `<div>No additional parameters.</div>`;

    const html = `
      <div class="card">
        <div class="header">
          <div class="badge-icon badge-write">✍️</div>
          <div class="title-wrap">
            <h2>${escapeHtml(title)}</h2>
            <p class="subtitle">Confirmation Required • ${escapeHtml(siteName)}</p>
          </div>
        </div>
        <div class="body">
          <div>${escapeHtml(summary)}</div>
          <div class="section-box">
            <div class="section-label">Action Details</div>
            ${detailsHtml}
          </div>
        </div>
        <div class="footer">
          <button type="button" class="btn-cancel" data-action="cancel">Cancel</button>
          <button type="button" class="btn-primary" data-action="confirm">Confirm & Apply</button>
        </div>
      </div>
    `;

    return mountModal(html, (shadow, cleanup) => {
      shadow.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        cleanup({ confirmed: false });
      });
      shadow.querySelector('[data-action="confirm"]').addEventListener('click', () => {
        cleanup({ confirmed: true });
      });
    });
  }

  function clearSessionConsents() {
    sessionStore?.removeItem(SESSION_KEY);
  }

  return {
    requestPeerConsent,
    requestWriteConfirmation,
    clearSessionConsents
  };
}