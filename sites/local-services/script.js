/**
 * CivicFix Local Services & Errands — State & Estimate Engine
 * Single source of truth shared by manual UI controls and website_* agent tools.
 */

const STORAGE_KEY = 'civicfix_services_state_v1';

const SERVICE_CATALOG = [
  {
    id: 'leak-drain-plumbing',
    name: 'Licensed Leak & Drain Plumbing',
    category: 'Plumbing',
    calloutFee: 45,
    hourlyRate: 85,
    minHours: 1,
    windows: ['Today 2:00 PM – 4:00 PM', 'Tomorrow 9:00 AM – 11:00 AM', 'Tomorrow 1:00 PM – 3:00 PM'],
    summary: 'Faucet replacements, under-sink pipe leaks, clogged drains, running toilets, and shutoff valves.'
  },
  {
    id: 'fixture-outlet-electrical',
    name: 'SafeHome Outlet & Lighting Electrical',
    category: 'Electrical',
    calloutFee: 50,
    hourlyRate: 95,
    minHours: 1,
    windows: ['Today 4:00 PM – 6:00 PM', 'Tomorrow 10:00 AM – 12:00 PM'],
    summary: 'GFCI outlet replacement, dimmer switches, ceiling light fixtures, and tripping breaker diagnostics.'
  },
  {
    id: 'deep-eco-cleaning',
    name: 'GreenLeaf Apartment & Home Cleaning',
    category: 'Cleaning',
    calloutFee: 20,
    hourlyRate: 55,
    minHours: 2,
    windows: ['Tomorrow 9:00 AM – 12:00 PM', 'Thursday 1:00 PM – 4:00 PM', 'Saturday 10:00 AM – 1:00 PM'],
    summary: 'Non-toxic plant-based kitchen, bath, floor, and surface refresh for studios to 3-bedroom homes.'
  },
  {
    id: 'furniture-mount-handyman',
    name: 'Oakwood Handyman & Assembly',
    category: 'Repairs & Assembly',
    calloutFee: 30,
    hourlyRate: 65,
    minHours: 1,
    windows: ['Today 3:30 PM – 5:30 PM', 'Tomorrow 11:00 AM – 1:00 PM', 'Friday 2:00 PM – 4:00 PM'],
    summary: 'Wall shelf anchoring, TV mounting, sticky door planing, drywall patching, and flat-pack furniture.'
  },
  {
    id: 'neighborhood-errand-runner',
    name: 'Neighborhood Cargo-Bike Errand Runner',
    category: 'Errands',
    calloutFee: 12,
    hourlyRate: 38,
    minHours: 1,
    windows: ['Today within 90 mins', 'Tomorrow 9:30 AM – 11:00 AM'],
    summary: 'Local package drop-offs, hardware store pickups, dry-cleaning runs, and heavy grocery carry-ups.'
  }
];

const PROVIDER_INFO = {
  name: 'CivicFix Local Services & Errands',
  url: 'https://civicfix-services.vercel.app',
  phone: '(555) 018-4490',
  office: '88 Cedar Avenue, Oakwood Cooperative',
  hours: 'Mon–Sat 7:30 AM – 8:00 PM',
  urgentSurcharge: 35,
  unsupportedFeatures: [
    'Major structural remodeling or roof replacement permits',
    'Gas main utility line excavation (call municipal utility emergency 911/311)',
    'Hazardous waste or mold remediation',
    'Out-of-city long-haul moving trucks'
  ],
  hubUrl: 'https://open-neighborhood-hub.vercel.app'
};

class CivicFixPage {
  constructor() {
    this.listeners = new Set();
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
      draft: null,
      activeDispatches: []
    };
  }

  _saveAndNotify() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore quota errors
    }
    for (const fn of this.listeners) fn(this.getState());
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  serviceIds() {
    return SERVICE_CATALOG.map((s) => s.id);
  }

  _computeEstimate(draft) {
    if (!draft) return null;
    const svc = SERVICE_CATALOG.find((s) => s.id === draft.serviceId);
    if (!svc) return null;
    const labor = Number((svc.hourlyRate * draft.estimatedHours).toFixed(2));
    const urgentFee = draft.urgency === 'urgent_same_day' ? PROVIDER_INFO.urgentSurcharge : 0;
    const estimatedTotal = Number((svc.calloutFee + labor + urgentFee).toFixed(2));
    return {
      calloutFee: svc.calloutFee,
      hourlyRate: svc.hourlyRate,
      estimatedHours: draft.estimatedHours,
      labor,
      urgentFee,
      estimatedTotal
    };
  }

  getState() {
    return {
      provider: structuredClone(PROVIDER_INFO),
      services: structuredClone(SERVICE_CATALOG),
      version: this.state.version,
      draft: structuredClone(this.state.draft),
      estimate: this._computeEstimate(this.state.draft),
      activeDispatches: structuredClone(this.state.activeDispatches)
    };
  }

  configureServiceDraft({ serviceId, estimatedHours, preferredWindow, urgency = 'standard', issueNotes = '' }) {
    const svc = SERVICE_CATALOG.find((s) => s.id === serviceId);
    if (!svc) {
      return { ok: false, field: 'serviceId', reason: `Unknown service "${serviceId}".` };
    }
    const hrs = Number(estimatedHours ?? svc.minHours);
    if (!Number.isInteger(hrs) || hrs < svc.minHours || hrs > 8) {
      return {
        ok: false,
        field: 'estimatedHours',
        reason: `${svc.name} requires between ${svc.minHours} and 8 hours per booking.`
      };
    }
    if (urgency !== 'standard' && urgency !== 'urgent_same_day') {
      return { ok: false, field: 'urgency', reason: 'Urgency must be "standard" or "urgent_same_day".' };
    }
    const chosenWindow = preferredWindow && svc.windows.includes(preferredWindow)
      ? preferredWindow
      : svc.windows[0];

    this.state.draft = {
      serviceId: svc.id,
      serviceName: svc.name,
      category: svc.category,
      estimatedHours: hrs,
      preferredWindow: chosenWindow,
      urgency,
      issueNotes: String(issueNotes || '').trim().slice(0, 200)
    };
    this.state.version += 1;
    this._saveAndNotify();
    return { ok: true, state: this.getState() };
  }

  clearDraft() {
    this.state.draft = null;
    this.state.version += 1;
    this._saveAndNotify();
    return { ok: true, state: this.getState() };
  }

  confirmDispatch({ customerName, serviceAddress, contactPhone = '', expectedVersion }) {
    if (typeof expectedVersion === 'number' && expectedVersion !== this.state.version) {
      return {
        ok: false,
        field: 'expectedVersion',
        reason: `Estimate draft changed (expected version ${expectedVersion}, current is ${this.state.version}). Please review the updated estimate first.`
      };
    }
    if (!this.state.draft) {
      return {
        ok: false,
        field: 'draft',
        reason: 'No service estimate is configured yet. Select a service and hours first.'
      };
    }
    const cleanName = String(customerName || '').trim();
    if (cleanName.length < 2 || cleanName.length > 80) {
      return { ok: false, field: 'customerName', reason: 'Please provide a contact name (2–80 characters).' };
    }
    const cleanAddr = String(serviceAddress || '').trim();
    if (cleanAddr.length < 5 || cleanAddr.length > 160) {
      return { ok: false, field: 'serviceAddress', reason: 'Please provide the street address where service is needed.' };
    }

    const estimate = this._computeEstimate(this.state.draft);
    const ticketNumber = `CF-${String(Math.floor(100000 + Math.random() * 900000))}`;
    const dispatchRecord = {
      ticketNumber,
      status: 'technician_scheduled',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customerName: cleanName,
      serviceAddress: cleanAddr,
      contactPhone: String(contactPhone || '').trim().slice(0, 30),
      ...structuredClone(this.state.draft),
      estimate
    };

    this.state.activeDispatches.unshift(dispatchRecord);
    this.state.draft = null;
    this.state.version += 1;
    this._saveAndNotify();

    return { ok: true, dispatch: dispatchRecord, newVersion: this.state.version };
  }
}

export const App = {
  page: new CivicFixPage()
};