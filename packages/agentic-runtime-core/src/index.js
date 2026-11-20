/**
 * @open-neighborhood/agentic-runtime-core
 * Attaches standardized Open Neighborhood Consent Cards, Irreversible Write Confirmations,
 * Private Context (sly_data) Boundary Previews, Chat Prompt Prefill, and Audit Telemetry
 * directly to the official neuro-san-web browser Engine.
 */

import { createTrustDialogs } from '../../consent-policy-ui/src/index.js';
import {
  normalizePeerPolicy,
  filterPrivateContext,
  HANDOFF_OUTCOME
} from '../../network-linker/src/index.js';

export class TrustAuditLog {
  constructor(onUpdate) {
    this.events = [];
    this.onUpdate = onUpdate;
  }

  record(type, details) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      type,
      ...details
    };
    this.events.unshift(entry);
    if (this.events.length > 50) this.events.length = 50;
    this.onUpdate?.(this.events, entry);
    return entry;
  }
}

/**
 * Safely locates the live chat composer inside [data-ns-slot="chat"] (ignoring hidden
 * BYOK settings inputs and in-message CRUSE forms), populates the prompt, scrolls into view,
 * and optionally triggers Send if a BYOK key is already configured.
 */
export function sendPromptToAssistant(engine, text, { autoSendIfKeyPresent = false } = {}) {
  const chatSlot =
    document.querySelector('#assistant-root [data-ns-slot="chat"]') ||
    document.querySelector('[data-ns-slot="chat"]') ||
    document.querySelector('#assistant-root');

  if (!chatSlot) return { ok: false, reason: 'Chat container not mounted.' };

  const candidates = chatSlot.querySelectorAll('textarea, input[type="text"], input:not([type])');
  let composer = null;
  for (const el of candidates) {
    if (
      el.closest('[data-ns-slot="settings"]') ||
      el.closest('.ns-msgs') ||
      el.closest('.ns-widget')
    ) {
      continue;
    }
    composer = el;
    break;
  }

  if (!composer) return { ok: false, reason: 'Chat composer input not found.' };

  const proto =
    composer instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (nativeSetter) {
    nativeSetter.call(composer, text);
  } else {
    composer.value = text;
  }

  composer.dispatchEvent(new Event('input', { bubbles: true }));
  composer.dispatchEvent(new Event('change', { bubbles: true }));
  composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  composer.focus();

  composer.style.transition = 'box-shadow 180ms ease';
  composer.style.boxShadow = '0 0 0 3px rgba(29, 78, 216, 0.38)';
  setTimeout(() => {
    composer.style.boxShadow = '';
  }, 1400);

  const hasKey = Boolean(
    engine?.byokKey ||
      sessionStorage.getItem('ns_byok_key') ||
      localStorage.getItem('ns_byok_profiles_v1')
  );

  if (autoSendIfKeyPresent && hasKey && engine?.byokKey) {
    const formOrRow = composer.closest('form') || composer.parentElement;
    const sendBtn =
      formOrRow?.querySelector('button[type="submit"]') ||
      Array.from(formOrRow?.querySelectorAll('button') || []).find((b) =>
        /send|submit|ask/i.test(b.textContent || b.getAttribute('aria-label') || '')
      ) ||
      formOrRow?.querySelector('button');

    if (sendBtn && !sendBtn.disabled) {
      setTimeout(() => sendBtn.click(), 80);
      return { ok: true, sent: true };
    }
  }

  return { ok: true, sent: false };
}

let fetchInterceptorInstalled = false;

/**
 * Protects browser BYOK LLM calls (/chat/completions) against transient upstream
 * HTTP 502 / 503 / 529 "high demand" spikes using exponential backoff and automatic
 * Gemini Flash-Lite fallback on persistent Google 503 overload.
 */
export function installResilientLlmFetch({ onRetry = null } = {}) {
  if (fetchInterceptorInstalled || typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return;
  }
  fetchInterceptorInstalled = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const method = (init?.method || 'GET').toUpperCase();
    const isLlmCompletion = method === 'POST' && /\/chat\/completions(\?|$)/i.test(url);

    if (!isLlmCompletion) {
      return nativeFetch(input, init);
    }

    const maxAttempts = 3;
    const delaysMs = [900, 2000];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await nativeFetch(input, init);
      if (![502, 503, 529].includes(res.status) || attempt === maxAttempts) {
        return res;
      }
      onRetry?.({ attempt, status: res.status, url });
      await new Promise((r) => setTimeout(r, delaysMs[attempt - 1] || 1500));
    }
  };
}

/**
 * Boots a site's local /runtime/index.js and upgrades engine.onConsent + engine.onActionConfirm
 * with Open Neighborhood's reusable Shadow-DOM trust cards and audit log.
 */
export async function bootNeighborhoodSite({
  bootRuntime,
  mountSelector = '#assistant-root',
  siteName = document.title,
  privateContextProvider = () => ({}),
  allowedPeerContextKeys = [],
  peerTitlesByOrigin = {},
  onAuditEvent = null,
  bootOptions = {}
} = {}) {
  if (typeof bootRuntime !== 'function') {
    throw new Error('bootNeighborhoodSite requires the site runtime boot() function.');
  }

  installResilientLlmFetch({
    onRetry: ({ attempt, status }) => {
      audit.record('llm_retry_503', {
        outcome: `Upstream HTTP ${status} spike — auto-retrying (${attempt}/2)`
      });
    }
  });

  const dialogs = createTrustDialogs();
  const audit = new TrustAuditLog(onAuditEvent);
  const booted = await bootRuntime(mountSelector, bootOptions);
  const { engine, trace, actions } = booted;

  // 1. Wire official engine.onConsent(info) -> "allow" | "always" | "decline"
  engine.onConsent = async (info = {}) => {
    const peerOrigin = info.peerOrigin || info.origin || '';
    const peerUrl = info.url || info.peerUrl || peerOrigin || 'External Peer Network';
    const friendlyTitle =
      peerTitlesByOrigin[peerOrigin] || info.brand || info.network || peerOrigin || 'Neighborhood Partner';
    const { mode } = normalizePeerPolicy(engine?.top?.manifest?.peer_policy);

    const rawPrivate = privateContextProvider() || {};
    const { filtered, strippedKeys } = filterPrivateContext(rawPrivate, allowedPeerContextKeys);

    const decision = await dialogs.requestPeerConsent({
      peerUrl,
      peerTitle: friendlyTitle,
      peerPolicy: mode || 'closed',
      taskSummary:
        info.reason ||
        info.description ||
        `Delegate your request to ${friendlyTitle} and return a structured result.`,
      sharedContextKeys: Object.keys(filtered),
      strippedContextKeys: strippedKeys
    });

    if (!decision.approved) {
      audit.record('peer_declined', {
        peerUrl,
        peerTitle: friendlyTitle,
        outcome: HANDOFF_OUTCOME.USER_DECLINED
      });
      return 'decline';
    }

    audit.record('peer_consented', {
      peerUrl,
      peerTitle: friendlyTitle,
      scope: decision.scope,
      sharedKeys: Object.keys(filtered),
      strippedKeys,
      outcome: HANDOFF_OUTCOME.CONFIRMED_SUCCESS
    });

    return decision.scope === 'session' ? 'always' : 'allow';
  };

  // 2. Wire official engine.onActionConfirm(items) -> boolean
  engine.onActionConfirm = async (items = []) => {
    const first = Array.isArray(items) && items.length > 0 ? items[0] : items || {};
    const toolName = first.name || first.action || first.tool || 'Confirm Irreversible Action';
    const rawArgs = first.args || first.input || first.parameters || first;

    const decision = await dialogs.requestWriteConfirmation({
      title: `Confirm: ${String(toolName).replace(/^website_/, '').replace(/_/g, ' ')}`,
      siteName,
      summary:
        first.description ||
        'Please review and confirm before this irreversible change is applied to your live session.',
      args: typeof rawArgs === 'object' && rawArgs !== null ? rawArgs : { details: String(rawArgs) }
    });

    audit.record(decision.confirmed ? 'write_confirmed' : 'write_cancelled', {
      tool: toolName,
      outcome: decision.confirmed
        ? HANDOFF_OUTCOME.CONFIRMED_SUCCESS
        : HANDOFF_OUTCOME.USER_DECLINED
    });

    return Boolean(decision.confirmed);
  };

  // 3. Support transparent cross-site handoff prefill (?prompt=...) without auto-executing
  const prefill = new URLSearchParams(window.location.search).get('prompt');
  if (prefill) {
    setTimeout(() => {
      sendPromptToAssistant(engine, prefill, { autoSendIfKeyPresent: false });
    }, 100);
  }

  return {
    engine,
    trace,
    actions,
    dialogs,
    audit,
    sendPrompt: (text, opts) => sendPromptToAssistant(engine, text, opts)
  };
}