/**
 * @open-neighborhood/discovery-index
 * Lightweight, standards-aligned peer discovery & live manifest probing
 * for the Open Agentic Web.
 */

import { validateManifest } from '../../network-linker/src/index.js';

const USER_PEERS_STORAGE_KEY = 'onaw_custom_neighborhood_peers_v1';

/**
 * Probes an independent origin's /agent-manifest.json and returns verified metadata.
 * Fails closed if CORS, HTTP status, or manifest schema validation fails.
 */
export async function probeAgenticSite(originOrBaseUrl, { fetchImpl = fetch, timeoutMs = 4500 } = {}) {
  const cleanBase = String(originOrBaseUrl).replace(/\/$/, '');
  const manifestUrl = `${cleanBase}/agent-manifest.json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(manifestUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    if (!res.ok) {
      return { reachable: false, valid: false, baseUrl: cleanBase, error: `HTTP ${res.status}` };
    }
    const manifest = await res.json();
    const check = validateManifest(manifest, manifestUrl);
    if (!check.valid) {
      return { reachable: true, valid: false, baseUrl: cleanBase, error: check.errors.join('; ') };
    }

    const primaryNet = manifest.networks[0];
    const networkUrl = `${cleanBase}/${primaryNet.name}`;
    const actionTools = manifest?.actions?.agentTools || [];

    return {
      reachable: true,
      valid: true,
      baseUrl: cleanBase,
      manifestUrl,
      networkUrl,
      networkName: primaryNet.name,
      frontMan: primaryNet.front_man,
      description: primaryNet.description || manifest.description || '',
      peerPolicy: manifest.peer_policy,
      toolCount: actionTools.length,
      manifest
    };
  } catch (err) {
    return {
      reachable: false,
      valid: false,
      baseUrl: cleanBase,
      error: err?.name === 'AbortError' ? 'Probe timed out' : err.message
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Loads a static neighborhood directory JSON index + any user-registered peers,
 * probes them in parallel, and provides keyword/category search.
 */
export class NeighborhoodDiscoveryIndex {
  constructor({ indexUrl = './neighborhood-index.json', storage = globalThis.localStorage } = {}) {
    this.indexUrl = indexUrl;
    this.storage = storage;
    this.entries = [];
  }

  getCustomPeers() {
    try {
      return JSON.parse(this.storage?.getItem(USER_PEERS_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  addCustomPeer(peerEntry) {
    if (!peerEntry?.origin || !peerEntry?.id) {
      throw new Error('Custom peer requires at least { id, origin, title, category }.');
    }
    const list = this.getCustomPeers().filter((p) => p.origin !== peerEntry.origin);
    list.push({ ...peerEntry, source: 'user_added' });
    this.storage?.setItem(USER_PEERS_STORAGE_KEY, JSON.stringify(list));
    return list;
  }

  removeCustomPeer(origin) {
    const list = this.getCustomPeers().filter((p) => p.origin !== origin);
    this.storage?.setItem(USER_PEERS_STORAGE_KEY, JSON.stringify(list));
    return list;
  }

  async loadAndProbeAll({ fetchImpl = fetch } = {}) {
    let basePeers = [];
    if (this.indexUrl) {
      const res = await fetchImpl(this.indexUrl, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const doc = await res.json();
        basePeers = Array.isArray(doc.peers) ? doc.peers.map((p) => ({ ...p, source: 'directory' })) : [];
      }
    }

    const merged = [...basePeers];
    for (const custom of this.getCustomPeers()) {
      if (!merged.some((m) => m.origin === custom.origin)) {
        merged.push(custom);
      }
    }

    const probed = await Promise.all(
      merged.map(async (entry) => {
        const probe = await probeAgenticSite(entry.origin, { fetchImpl });
        return {
          ...entry,
          status: probe.valid ? 'online' : 'offline',
          probe
        };
      })
    );

    this.entries = probed;
    return probed;
  }

  /**
   * Matches peers against natural language query or category filter.
   */
  search(query = '', { category = 'all', onlineOnly = false } = {}) {
    const terms = String(query)
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return this.entries
      .filter((item) => {
        if (onlineOnly && item.status !== 'online') return false;
        if (category !== 'all' && item.category !== category) return false;
        if (terms.length === 0) return true;

        const haystack = [
          item.title,
          item.category,
          item.summary,
          ...(item.capabilities || []),
          ...(item.tags || []),
          item.probe?.description || ''
        ]
          .join(' ')
          .toLowerCase();

        return terms.some((t) => haystack.includes(t));
      })
      .map((item) => {
        if (terms.length === 0) return { ...item, score: 1 };
        const haystack = [item.title, ...(item.tags || []), ...(item.capabilities || [])]
          .join(' ')
          .toLowerCase();
        const score = terms.reduce((acc, t) => acc + (haystack.includes(t) ? 2 : 0), 1);
        return { ...item, score };
      })
      .sort((a, b) => b.score - a.score);
  }
}