/**
 * @open-neighborhood/network-linker
 * Conforms to the Worldwide Agentic Web MVP Specification (cognizant-ai-labs/agentic-web)
 */

export const HANDOFF_OUTCOME = Object.freeze({
  CONFIRMED_SUCCESS: 'confirmed_success',
  USER_DECLINED: 'user_declined',
  POLICY_BLOCKED: 'policy_blocked',
  UNKNOWN_OUTCOME: 'unknown_outcome'
});

const VALID_PEER_POLICIES = new Set(['strict', 'allowlist', 'open']);

/**
 * Validates an agent-manifest.json object. Fails closed on missing or unsafe fields.
 */
export function validateManifest(manifest, sourceLabel = 'agent-manifest.json') {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: [`${sourceLabel}: Root must be a JSON object.`] };
  }

  if (!Array.isArray(manifest.networks) || manifest.networks.length === 0) {
    errors.push(`${sourceLabel}: "networks" must be a non-empty array.`);
  } else {
    manifest.networks.forEach((net, idx) => {
      if (!net.name || typeof net.name !== 'string') {
        errors.push(`${sourceLabel}: networks[${idx}].name is required.`);
      }
      if (!net.front_man || typeof net.front_man !== 'string') {
        errors.push(`${sourceLabel}: networks[${idx}].front_man (public entry agent) is required.`);
      }
      if (!net.hocon || typeof net.hocon !== 'string' || !net.hocon.endsWith('.json')) {
        errors.push(`${sourceLabel}: networks[${idx}].hocon must point to a published .network.json file.`);
      }
    });
  }

  if (!manifest.peer_policy || !VALID_PEER_POLICIES.has(manifest.peer_policy)) {
    errors.push(`${sourceLabel}: "peer_policy" must be one of "strict", "allowlist", or "open".`);
  }

  if (manifest.peer_policy === 'allowlist' && !Array.isArray(manifest.allowed_peers)) {
    errors.push(`${sourceLabel}: "allowed_peers" array is required when peer_policy is "allowlist".`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a resolved *.network.json graph and verifies front_man exists.
 */
export function validateNetworkDefinition(networkDoc, expectedFrontMan, sourceLabel = 'network.json') {
  const errors = [];
  if (!networkDoc || typeof networkDoc !== 'object' || Array.isArray(networkDoc)) {
    return { valid: false, errors: [`${sourceLabel}: Root must be a JSON object.`] };
  }

  if (!Array.isArray(networkDoc.agents) || networkDoc.agents.length === 0) {
    errors.push(`${sourceLabel}: "agents" must be a non-empty array of data-only agent definitions.`);
  } else {
    const agentNames = new Set();
    for (const agent of networkDoc.agents) {
      if (!agent.name || typeof agent.name !== 'string') {
        errors.push(`${sourceLabel}: Every agent must have a string "name".`);
      } else {
        agentNames.add(agent.name);
      }
      if (typeof agent.instructions !== 'string' || agent.instructions.trim().length === 0) {
        errors.push(`${sourceLabel}: Agent "${agent.name || '?'}" must have non-empty "instructions".`);
      }
      if (agent.tools !== undefined && !Array.isArray(agent.tools)) {
        errors.push(`${sourceLabel}: Agent "${agent.name || '?'}" "tools" must be an array.`);
      }
    }
    if (expectedFrontMan && !agentNames.has(expectedFrontMan)) {
      errors.push(`${sourceLabel}: Declared front_man "${expectedFrontMan}" does not exist in agents[].`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parses a canonical peer network URL (e.g. "http://localhost:4101/hearth_crumb_assistant")
 * into { origin, siteBaseUrl, networkName, manifestUrl } per MVP Spec Section 1.2.
 */
export function parsePeerNetworkUrl(peerNetworkUrl) {
  const parsed = new URL(peerNetworkUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported protocol "${parsed.protocol}" in peer network URL.`);
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    throw new Error(`Peer network URL "${peerNetworkUrl}" must end with the published network name.`);
  }
  const networkName = segments[segments.length - 1];
  const baseSegments = segments.slice(0, -1);
  const basePath = baseSegments.length > 0 ? `/${baseSegments.join('/')}` : '';
  const siteBaseUrl = `${parsed.origin}${basePath}`;

  return {
    origin: parsed.origin,
    siteBaseUrl,
    networkName,
    manifestUrl: `${siteBaseUrl}/agent-manifest.json`
  };
}

/**
 * Enforces caller peer_policy ("strict" | "allowlist" | "open") Fail-Closed.
 */
export function checkPeerPolicy(callerManifest, targetPeerUrl) {
  try {
    const { origin } = parsePeerNetworkUrl(targetPeerUrl);
    const policy = callerManifest?.peer_policy ?? 'strict';

    if (policy === 'open') {
      return { allowed: true, origin, reason: 'Caller peer_policy is open.' };
    }
    if (policy === 'strict') {
      return { allowed: false, origin, reason: 'Caller peer_policy is strict (external peers disabled).' };
    }
    if (policy === 'allowlist') {
      const allowedOrigins = Array.isArray(callerManifest.allowed_peers) ? callerManifest.allowed_peers : [];
      if (allowedOrigins.includes(origin)) {
        return { allowed: true, origin, reason: `Origin ${origin} is explicitly allowlisted.` };
      }
      return { allowed: false, origin, reason: `Origin ${origin} is NOT in caller allowed_peers.` };
    }
    return { allowed: false, origin, reason: `Unknown peer_policy "${policy}" — failing closed.` };
  } catch (err) {
    return { allowed: false, origin: null, reason: `Invalid peer URL — failing closed: ${err.message}` };
  }
}

/**
 * Filters private context (sly_data) so ONLY explicitly allowlisted keys cross boundaries.
 */
export function filterPrivateContext(slyData = {}, allowedKeys = []) {
  if (!slyData || typeof slyData !== 'object' || !Array.isArray(allowedKeys) || allowedKeys.length === 0) {
    return { filtered: {}, strippedKeys: Object.keys(slyData || {}) };
  }
  const allowSet = new Set(allowedKeys);
  const filtered = {};
  const strippedKeys = [];

  for (const [key, value] of Object.entries(slyData)) {
    if (allowSet.has(key)) {
      filtered[key] = structuredClone(value);
    } else {
      strippedKeys.push(key);
    }
  }
  return { filtered, strippedKeys };
}

/**
 * Resolves a symbolic link name via publisher links.json and optional user browser overrides.
 */
export function resolveSymbolicLink(symbol, publisherLinks = {}, userOverrides = {}) {
  if (userOverrides && typeof userOverrides[symbol] === 'string') {
    return { url: userOverrides[symbol], source: 'user_override' };
  }
  const bindings = publisherLinks?.links || publisherLinks || {};
  if (typeof bindings[symbol] === 'string') {
    return { url: bindings[symbol], source: 'publisher_links' };
  }
  return { url: null, source: 'unresolved' };
}