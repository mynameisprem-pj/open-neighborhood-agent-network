/**
 * Oakwood Community Scheduling — Live Slot Calendar & Reservation Engine
 * Single source of truth shared by manual UI interactions and website_* agent tools.
 */

const STORAGE_KEY = 'oakwood_booking_state_v1';

const INITIAL_PROVIDERS = [
  {
    id: 'clinic-wellness-np',
    name: 'Oakwood Care Clinic — Nurse Practitioner Visit',
    category: 'Clinic',
    durationMinutes: 30,
    fee: 35,
    location: 'Suite 102, Oakwood Health Commons',
    prepNote: 'Bring photo ID and current medication list; arrive 10 minutes early.',
    slots: [
      { slotId: 'clinic-today-1430', label: 'Today • 2:30 PM', available: true },
      { slotId: 'clinic-today-1600', label: 'Today • 4:00 PM', available: true },
      { slotId: 'clinic-tmw-0930', label: 'Tomorrow • 9:30 AM', available: true },
      { slotId: 'clinic-tmw-1100', label: 'Tomorrow • 11:00 AM', available: false }
    ]
  },
  {
    id: 'physio-mobility-consult',
    name: 'ActiveOak Physical Therapy & Ergonomics Consult',
    category: 'Clinic',
    durationMinutes: 45,
    fee: 55,
    location: 'Suite 108, Oakwood Health Commons',
    prepNote: 'Wear comfortable movement clothing.',
    slots: [
      { slotId: 'physio-tmw-1000', label: 'Tomorrow • 10:00 AM', available: true },
      { slotId: 'physio-tmw-1500', label: 'Tomorrow • 3:00 PM', available: true },
      { slotId: 'physio-fri-1330', label: 'Friday • 1:30 PM', available: true }
    ]
  },
  {
    id: 'stem-math-tutor',
    name: '1-on-1 Math, Python & Study Skills Tutoring',
    category: 'Tutoring',
    durationMinutes: 60,
    fee: 28,
    location: 'Room B, Oakwood Library Annex (or Video Link)',
    prepNote: 'Bring your current syllabus, assignment sheet, or laptop.',
    slots: [
      { slotId: 'tutor-today-1700', label: 'Today • 5:00 PM', available: true },
      { slotId: 'tutor-tmw-1630', label: 'Tomorrow • 4:30 PM', available: true },
      { slotId: 'tutor-sat-1030', label: 'Saturday • 10:30 AM', available: true }
    ]
  },
  {
    id: 'maker-laser-cutter',
    name: 'Maker Lab Laser Cutter & 3D Printer Bay',
    category: 'Equipment',
    durationMinutes: 90,
    fee: 15,
    location: 'Workshop Bay 2, 40 Pine Street',
    prepNote: 'Closed-toe shoes required; bring SVG/DXF or STL files on USB.',
    slots: [
      { slotId: 'maker-today-1800', label: 'Today • 6:00 PM', available: true },
      { slotId: 'maker-tmw-1400', label: 'Tomorrow • 2:00 PM', available: true },
      { slotId: 'maker-sat-1300', label: 'Saturday • 1:00 PM', available: true }
    ]
  },
  {
    id: 'tool-washer-kit',
    name: 'Electric Pressure Washer & Garden Kit Rental',
    category: 'Equipment',
    durationMinutes: 240,
    fee: 22,
    location: 'Tool Shed Counter, 40 Pine Street',
    prepNote: '4-hour neighborhood loan block; fits standard car trunk.',
    slots: [
      { slotId: 'washer-tmw-0830', label: 'Tomorrow • 8:30 AM (4h block)', available: true },
      { slotId: 'washer-sat-0900', label: 'Saturday • 9:00 AM (4h block)', available: true }
    ]
  }
];

const CENTER_INFO = {
  name: 'Oakwood Community Scheduling',
  url: 'http://localhost:4103',
  phone: '(555) 019-7730',
  address: '40 Pine Street & Oakwood Health Commons',
  hours: 'Mon–Sat 8:00 AM – 7:30 PM',
  unsupportedFeatures: [
    'Emergency acute medical care (dial 911 or visit City General ER)',
    'Controlled prescription refills without an in-person exam',
    'Insurance claim pre-authorization adjudications',
    'Multi-week commercial heavy-machinery leases'
  ],
  hubUrl: 'http://localhost:4100'
};

class OakwoodBookingPage {
  constructor() {
    this.listeners = new Set();
    this.state = this._loadState();
  }

  _loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.version === 'number' && Array.isArray(parsed.providers)) {
          return parsed;
        }
      }
    } catch {
      // Fall back to fresh calendar
    }
    return {
      version: 1,
      providers: structuredClone(INITIAL_PROVIDERS),
      selectedSlot: null,
      bookings: []
    };
  }

  _saveAndNotify() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage quota errors
    }
    for (const fn of this.listeners) fn(this.getState());
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  allSlotIds() {
    return INITIAL_PROVIDERS.flatMap((p) => p.slots.map((s) => s.slotId));
  }

  _findSlot(slotId) {
    for (const provider of this.state.providers) {
      const slot = provider.slots.find((s) => s.slotId === slotId);
      if (slot) return { provider, slot };
    }
    return null;
  }

  getState() {
    return {
      center: structuredClone(CENTER_INFO),
      version: this.state.version,
      providers: structuredClone(this.state.providers),
      selectedSlot: structuredClone(this.state.selectedSlot),
      bookings: structuredClone(this.state.bookings)
    };
  }

  holdSlotSelection(slotId, visitReason = '') {
    const found = this._findSlot(slotId);
    if (!found) {
      return { ok: false, field: 'slotId', reason: `Unknown slotId "${slotId}".` };
    }
    if (!found.slot.available) {
      return {
        ok: false,
        field: 'slotId',
        reason: `Slot "${found.slot.label}" for ${found.provider.name} is already booked. Choose an available slot.`
      };
    }

    this.state.selectedSlot = {
      slotId: found.slot.slotId,
      slotLabel: found.slot.label,
      providerId: found.provider.id,
      providerName: found.provider.name,
      category: found.provider.category,
      durationMinutes: found.provider.durationMinutes,
      fee: found.provider.fee,
      location: found.provider.location,
      prepNote: found.provider.prepNote,
      visitReason: String(visitReason || '').trim().slice(0, 180)
    };
    this.state.version += 1;
    this._saveAndNotify();
    return { ok: true, state: this.getState() };
  }

  clearSelection() {
    this.state.selectedSlot = null;
    this.state.version += 1;
    this._saveAndNotify();
    return { ok: true, state: this.getState() };
  }

  confirmBooking({ attendeeName, attendeeContact = '', visitReason = '', expectedVersion }) {
    if (typeof expectedVersion === 'number' && expectedVersion !== this.state.version) {
      return {
        ok: false,
        field: 'expectedVersion',
        reason: `Schedule state changed (expected version ${expectedVersion}, current is ${this.state.version}). Read the latest availability before confirming.`
      };
    }
    if (!this.state.selectedSlot) {
      return {
        ok: false,
        field: 'selectedSlot',
        reason: 'No time slot is currently selected. Hold an available slot first.'
      };
    }

    const found = this._findSlot(this.state.selectedSlot.slotId);
    if (!found || !found.slot.available) {
      return {
        ok: false,
        field: 'slotId',
        reason: 'That time slot is no longer available. Please pick another open slot.'
      };
    }

    const cleanName = String(attendeeName || '').trim();
    if (cleanName.length < 2 || cleanName.length > 80) {
      return { ok: false, field: 'attendeeName', reason: 'Please provide an attendee name (2–80 characters).' };
    }

    found.slot.available = false;
    const confirmationCode = `OK-${String(Math.floor(100000 + Math.random() * 900000))}`;
    const booking = {
      confirmationCode,
      status: 'confirmed',
      bookedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attendeeName: cleanName,
      attendeeContact: String(attendeeContact || '').trim().slice(0, 80),
      ...structuredClone(this.state.selectedSlot),
      visitReason: String(visitReason || this.state.selectedSlot.visitReason || '').trim().slice(0, 180)
    };

    this.state.bookings.unshift(booking);
    this.state.selectedSlot = null;
    this.state.version += 1;
    this._saveAndNotify();

    return { ok: true, booking, newVersion: this.state.version };
  }

  cancelBooking(confirmationCode) {
    const idx = this.state.bookings.findIndex((b) => b.confirmationCode === confirmationCode);
    if (idx === -1) {
      return { ok: false, field: 'confirmationCode', reason: `No active booking found with code "${confirmationCode}".` };
    }
    const [removed] = this.state.bookings.splice(idx, 1);
    const found = this._findSlot(removed.slotId);
    if (found) found.slot.available = true;

    this.state.version += 1;
    this._saveAndNotify();
    return { ok: true, cancelledCode: confirmationCode, reopenedSlot: removed.slotId, state: this.getState() };
  }
}

export const App = {
  page: new OakwoodBookingPage()
};