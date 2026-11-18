/**
 * Open Neighborhood Hub — Directory State, Privacy Vault, & Multi-Site Task Plan
 * Shared by manual Hub UI and website_* Hub agent tools.
 */

import { NeighborhoodDiscoveryIndex } from '/packages/discovery-index/src/index.js';

const STORAGE_KEY = 'open_neighborhood_hub_state_v1';

class NeighborhoodHubPage {
  constructor() {
    this.listeners = new Set();
    this.discovery = new NeighborhoodDiscoveryIndex({ indexUrl: './neighborhood-index.json' });
    this.peers = [];
    this.state = this._loadState();
  }

  _loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.version === 'number') return parsed;
      }
    } catch {
      // Fall back to defaults
    }
    return {
      version: 1,
      residentProfile: {
        neighborhood: 'Oakwood',
        dietary_preference: 'Vegan & Gluten-Free friendly',
        preferred_day_window: 'Late Afternoon (After 2:00 PM)',
        home_gate_code: '4829# (Private — Never Share)',
        saved_payment_last4: 'Visa •••• 8842 (Private — Never Share)'
      },
      allowedPeerContextKeys: ['neighborhood', 'dietary_preference', 'preferred_day_window'],
      planItems: []
    };
  }

  _saveAndNotify() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage quota errors
    }
    for (const fn of this.listeners) fn(this.getSnapshot());
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async refreshDirectory() {
    this.peers = await this.discovery.loadAndProbeAll();
    for (const fn of this.listeners) fn(this.getSnapshot());
    return this.peers;
  }

  async addCustomSite({ title, category = 'services', origin, summary = '' }) {
    const cleanOrigin = String(origin || '').trim().replace(/\/$/, '');
    if (!cleanOrigin.startsWith('http://') && !cleanOrigin.startsWith('https://')) {
      return { ok: false, reason: 'Peer URL must start with http:// or https://.' };
    }
    this.discovery.addCustomPeer({
      id: `custom-${Date.now()}`,
      title: String(title || cleanOrigin).trim(),
      category,
      origin: cleanOrigin,
      summary: String(summary || 'User-added neighborhood agentic site.').trim(),
      capabilities: ['custom peer'],
      tags: [category]
    });
    await this.refreshDirectory();
    return { ok: true, peers: this.peers };
  }

  updatePrivacyProfile(updates = {}) {
    this.state.residentProfile = {
      ...this.state.residentProfile,
      ...updates
    };
    this.state.version += 1;
    this._saveAndNotify();
    return { ok: true, state: this.getPublicStateForAgent() };
  }

  /**
   * Returns ONLY public directory + filtered non-sensitive preferences to the LLM!
   * Private fields (home_gate_code, saved_payment_last4) are withheld even from tool reads.
   */
  getPublicStateForAgent() {
    const safePreferences = {};
    for (const key of this.state.allowedPeerContextKeys) {
      if (key in this.state.residentProfile) {
        safePreferences[key] = this.state.residentProfile[key];
      }
    }

    return {
      hub: {
        name: 'Oakwood Neighborhood Hub',
        url: 'http://localhost:4100',
        unsupportedFeatures: [
          'Direct payment card processing inside the Hub (checkout always happens on each business site)',
          'Emergency 911 police/fire/medical dispatch',
          'Modifying another website’s cart or booking without opening that site'
        ]
      },
      version: this.state.version,
      sharedResidentPreferences: safePreferences,
      withheldPrivateFieldNames: Object.keys(this.state.residentProfile).filter(
        (k) => !this.state.allowedPeerContextKeys.includes(k)
      ),
      directory: this.peers.map((p) => ({
        id: p.id,
        title: p.title,
        category: p.category,
        siteUrl: p.origin,
        networkUrl: p.probe?.networkUrl || `${p.origin}/${p.networkName || ''}`,
        status: p.status,
        summary: p.summary,
        capabilities: p.capabilities
      })),
      planItems: structuredClone(this.state.planItems)
    };
  }

  getSnapshot() {
    return {
      ...this.getPublicStateForAgent(),
      rawResidentProfile: structuredClone(this.state.residentProfile),
      allowedPeerContextKeys: [...this.state.allowedPeerContextKeys]
    };
  }

  addPlanHandoff({ businessTitle, category, targetSiteUrl, summary, suggestedPrompt = '' }) {
    const cleanTitle = String(businessTitle || '').trim();
    const cleanUrl = String(targetSiteUrl || '').trim().replace(/\/$/, '');
    if (!cleanTitle || !cleanUrl.startsWith('http')) {
      return { ok: false, field: 'targetSiteUrl', reason: 'Valid businessTitle and targetSiteUrl are required.' };
    }
    const cleanPrompt = String(suggestedPrompt || '').trim().slice(0, 220);
    const handoffUrl = cleanPrompt
      ? `${cleanUrl}/?prompt=${encodeURIComponent(cleanPrompt)}`
      : cleanUrl;

    const item = {
      id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      businessTitle: cleanTitle,
      category: String(category || 'local').trim(),
      targetSiteUrl: cleanUrl,
      summary: String(summary || '').trim().slice(0, 260),
      suggestedPrompt: cleanPrompt,
      handoffUrl
    };

    this.state.planItems.unshift(item);
    this.state.version += 1;
    this._saveAndNotify();
    return { ok: true, addedItem: item, planItems: structuredClone(this.state.planItems), newVersion: this.state.version };
  }

  removePlanItem(id) {
    const idx = this.state.planItems.findIndex((p) => p.id === id);
    if (idx === -1) {
      return { ok: false, field: 'id', reason: `Plan item "${id}" not found.` };
    }
    this.state.planItems.splice(idx, 1);
    this.state.version += 1;
    this._saveAndNotify();
    return { ok: true, planItems: structuredClone(this.state.planItems), newVersion: this.state.version };
  }

  clearPlan() {
    this.state.planItems = [];
    this.state.version += 1;
    this._saveAndNotify();
    return { ok: true, newVersion: this.state.version };
  }
}

export const App = {
  page: new NeighborhoodHubPage()
};