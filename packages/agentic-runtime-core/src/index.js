/**
 * @open-neighborhood/agentic-runtime-core
 * Attaches standardized Open Neighborhood Consent Cards, Irreversible Write Confirmations,
 * Private Context (sly_data) Boundary Previews, and Audit Telemetry directly to the
 * official neuro-san-web browser Engine.
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
      peerPolicy: mode || 'allowlist',
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

  return {
    engine,
    trace,
    actions,
    dialogs,
    audit
  };
}