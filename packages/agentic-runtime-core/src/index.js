/**
 * @open-neighborhood/agentic-runtime-core
 * Connects official neuro-san-web browser runtime with Open Neighborhood
 * trust dialogs, live page state reactivity, and audit logging.
 */

import { createTrustDialogs } from '../../consent-policy-ui/src/index.js';
import {
  checkPeerPolicy,
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
 * Boots a site's local /runtime/index.js and enhances it with Open Neighborhood
 * human-friendly trust dialogs, write confirmations, and audit telemetry.
 */
export async function bootNeighborhoodSite({
  bootRuntime,
  mountSelector = '#assistant-root',
  siteName = document.title,
  privateContextProvider = () => ({}),
  allowedPeerContextKeys = [],
  onAuditEvent = null
} = {}) {
  if (typeof bootRuntime !== 'function') {
    throw new Error('bootNeighborhoodSite requires the site runtime boot() function.');
  }

  const dialogs = createTrustDialogs();
  const audit = new TrustAuditLog(onAuditEvent);
  const booted = await bootRuntime(mountSelector);
  const { engine, trace, actions } = booted;

  // Wrap registerHelper so irreversible/write actions also record clear audit receipts
  function registerSiteAction(definition, { requiresWriteConfirm = false, humanTitle = '' } = {}) {
    const wrappedHandler = async (args, ctx) => {
      if (requiresWriteConfirm) {
        const decision = await dialogs.requestWriteConfirmation({
          title: humanTitle || definition.title || definition.name,
          siteName,
          summary: definition.description || 'Please confirm before updating your live order/booking on this page.',
          args
        });
        if (!decision.confirmed) {
          audit.record('write_cancelled', {
            tool: definition.name,
            outcome: HANDOFF_OUTCOME.USER_DECLINED
          });
          return {
            ok: false,
            status: HANDOFF_OUTCOME.USER_DECLINED,
            message: 'The visitor cancelled this action in the confirmation dialog. Page state was NOT modified.'
          };
        }
      }

      try {
        const result = await definition.handler(args, ctx);
        audit.record(requiresWriteConfirm ? 'write_confirmed' : 'read_action', {
          tool: definition.name,
          outcome: HANDOFF_OUTCOME.CONFIRMED_SUCCESS
        });
        return result;
      } catch (err) {
        audit.record('action_error', {
          tool: definition.name,
          outcome: HANDOFF_OUTCOME.UNKNOWN_OUTCOME,
          error: err.message
        });
        throw err;
      }
    };

    return actions.register({
      ...definition,
      handler: wrappedHandler
    });
  }

  /**
   * Evaluates peer policy + sly_data filtering + explicit user consent card
   * before loading/delegating to an external peer network.
   */
  async function authorizePeerHandoff({ targetPeerUrl, peerTitle, taskSummary }) {
    const manifest = engine?.top?.manifest || { peer_policy: 'strict' };
    const policyRes = checkPeerPolicy(manifest, targetPeerUrl);

    if (!policyRes.allowed) {
      audit.record('peer_blocked', {
        peerUrl: targetPeerUrl,
        reason: policyRes.reason,
        outcome: HANDOFF_OUTCOME.POLICY_BLOCKED
      });
      return {
        approved: false,
        outcome: HANDOFF_OUTCOME.POLICY_BLOCKED,
        reason: policyRes.reason,
        filteredContext: {}
      };
    }

    const rawPrivate = privateContextProvider() || {};
    const { filtered, strippedKeys } = filterPrivateContext(rawPrivate, allowedPeerContextKeys);

    const consent = await dialogs.requestPeerConsent({
      peerUrl: targetPeerUrl,
      peerTitle,
      peerPolicy: manifest.peer_policy,
      taskSummary,
      sharedContextKeys: Object.keys(filtered),
      strippedContextKeys: strippedKeys
    });

    if (!consent.approved) {
      audit.record('peer_declined', {
        peerUrl: targetPeerUrl,
        outcome: HANDOFF_OUTCOME.USER_DECLINED
      });
      return {
        approved: false,
        outcome: HANDOFF_OUTCOME.USER_DECLINED,
        reason: 'Visitor declined peer network connection.',
        filteredContext: {}
      };
    }

    audit.record('peer_consented', {
      peerUrl: targetPeerUrl,
      scope: consent.scope,
      sharedKeys: Object.keys(filtered),
      strippedKeys,
      outcome: HANDOFF_OUTCOME.CONFIRMED_SUCCESS
    });

    return {
      approved: true,
      outcome: HANDOFF_OUTCOME.CONFIRMED_SUCCESS,
      scope: consent.scope,
      filteredContext: filtered,
      strippedKeys
    };
  }

  return {
    engine,
    trace,
    actions,
    dialogs,
    audit,
    registerSiteAction,
    authorizePeerHandoff
  };
}