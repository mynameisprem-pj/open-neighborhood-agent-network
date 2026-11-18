/**
 * Hearth & Crumb Kitchen — Storefront State & Manual UI Controller
 * Single source of truth shared by both manual clicks and website_* agent tools.
 */

const STORAGE_KEY = 'hearth_crumb_state_v1';

const MENU_ITEMS = [
  {
    id: 'margherita-sourdough',
    name: 'Wood-Fired Margherita Sourdough Pizza',
    category: 'Wood-Fired Pizza',
    price: 16.5,
    prepMinutes: 18,
    dietary: ['vegetarian', 'nut-free'],
    description: '72-hour fermented sourdough crust, crushed San Marzano tomatoes, fresh mozzarella, sweet basil.'
  },
  {
    id: 'wild-mushroom-pizza',
    name: 'Roasted Wild Mushroom & Thyme Pizza',
    category: 'Wood-Fired Pizza',
    price: 18.0,
    prepMinutes: 20,
    dietary: ['vegan', 'nut-free'],
    description: 'Oyster & cremini mushrooms, caramelized onion confit, cashew herb crema, fresh thyme.'
  },
  {
    id: 'harvest-quinoa-bowl',
    name: 'Autumn Harvest Quinoa & Chickpea Bowl',
    category: 'Nourish Bowls',
    price: 14.25,
    prepMinutes: 12,
    dietary: ['vegan', 'gluten-free', 'nut-free'],
    description: 'Warm tri-color quinoa, spiced roasted chickpeas, charred broccoli, pickled red cabbage, lemon-tahini drizzle.'
  },
  {
    id: 'herbed-rotisserie-plate',
    name: 'Rosemary Chicken & Fingerling Plate',
    category: 'Nourish Bowls',
    price: 17.75,
    prepMinutes: 15,
    dietary: ['gluten-free', 'nut-free'],
    description: 'Free-range rosemary chicken breast, crispy garlic fingerlings, baby greens, citrus jus.'
  },
  {
    id: 'cardamom-morning-bun',
    name: 'Warm Swedish Cardamom Morning Bun',
    category: 'Artisan Bakery',
    price: 5.25,
    prepMinutes: 5,
    dietary: ['vegetarian', 'nut-free'],
    description: 'Flaky laminated pastry swirled with freshly ground green cardamom and pearl sugar.'
  },
  {
    id: 'flourless-olive-oil-cake',
    name: 'Citrus & Almond Olive Oil Cake Slice',
    category: 'Artisan Bakery',
    price: 6.75,
    prepMinutes: 5,
    dietary: ['vegetarian', 'gluten-free'],
    description: 'Moist almond-flour cake baked with extra-virgin olive oil and blood orange zest (contains almonds).'
  },
  {
    id: 'ginger-yuzu-spritz',
    name: 'House Ginger-Yuzu Botanical Spritz',
    category: 'Drinks',
    price: 4.75,
    prepMinutes: 3,
    dietary: ['vegan', 'gluten-free', 'nut-free'],
    description: 'Cold-pressed ginger root, Japanese yuzu juice, sparkling mineral water, mint sprig.'
  }
];

const RESTAURANT_INFO = {
  name: 'Hearth & Crumb Kitchen',
  url: 'http://localhost:4101',
  phone: '(555) 014-2280',
  address: '214 Maple Street, Oakwood Neighborhood',
  hours: 'Daily 8:00 AM – 9:30 PM',
  pickupNote: 'Pickup at counter & local neighborhood courier delivery ($3.50 flat fee, free on orders $35+).',
  unsupportedFeatures: [
    'Promo/coupon codes',
    'Third-party live GPS driver map tracking',
    'Retroactive card refunds (call the kitchen directly for order issues)',
    'Alcohol sales'
  ],
  hubUrl: 'http://127.0.0.1:4100'
};

class HearthCrumbPage {
  constructor() {
    this.listeners = new Set();
    this.activeFilter = 'all';
    this.state = this._loadState();
  }

  _loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.version === 'number' && Array.isArray(parsed.cart)) {
          return parsed;
        }
      }
    } catch {
      // Fall back to fresh state
    }
    return {
      version: 1,
      fulfillment: 'pickup',
      cart: [],
      lastOrder: null
    };
  }

  _saveAndNotify() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore private browsing quota errors
    }
    for (const fn of this.listeners) fn(this.getState());
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  catalogIds() {
    return MENU_ITEMS.map((item) => item.id);
  }

  _computeTotals(cart, fulfillment) {
    const subtotal = Number(
      cart.reduce((sum, entry) => sum + entry.unitPrice * entry.quantity, 0).toFixed(2)
    );
    const deliveryFee =
      fulfillment === 'delivery' && subtotal > 0 && subtotal < 35 ? 3.5 : 0;
    const tax = Number((subtotal * 0.08).toFixed(2));
    const total = Number((subtotal + deliveryFee + tax).toFixed(2));
    const estimatedMinutes = cart.length
      ? Math.max(...cart.map((c) => c.prepMinutes)) + (fulfillment === 'delivery' ? 15 : 0)
      : 0;
    return { subtotal, deliveryFee, tax, total, estimatedMinutes };
  }

  getState() {
    const totals = this._computeTotals(this.state.cart, this.state.fulfillment);
    return {
      restaurant: structuredClone(RESTAURANT_INFO),
      menu: structuredClone(MENU_ITEMS),
      version: this.state.version,
      fulfillment: this.state.fulfillment,
      cart: structuredClone(this.state.cart),
      totals,
      lastOrder: structuredClone(this.state.lastOrder)
    };
  }

  setFulfillment(mode) {
    if (mode !== 'pickup' && mode !== 'delivery') {
      return { ok: false, field: 'fulfillment', reason: 'Fulfillment must be "pickup" or "delivery".' };
    }
    this.state.fulfillment = mode;
    this.state.version += 1;
    this._saveAndNotify();
    return { ok: true, state: this.getState() };
  }

  addItem(id, quantity = 1, specialNote = '') {
    const item = MENU_ITEMS.find((m) => m.id === id);
    if (!item) {
      return { ok: false, field: 'id', reason: `Unknown menu item "${id}".` };
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 25) {
      return { ok: false, field: 'quantity', reason: 'Quantity must be a whole number between 1 and 25.' };
    }
    const cleanNote = String(specialNote || '').trim().slice(0, 120);
    const existing = this.state.cart.find((c) => c.id === id);

    if (existing) {
      if (existing.quantity + qty > 25) {
        return { ok: false, field: 'quantity', reason: 'Maximum 25 of any single menu item per order.' };
      }
      existing.quantity += qty;
      if (cleanNote) existing.specialNote = cleanNote;
    } else {
      this.state.cart.push({
        id: item.id,
        name: item.name,
        unitPrice: item.price,
        prepMinutes: item.prepMinutes,
        quantity: qty,
        specialNote: cleanNote
      });
    }

    this.state.version += 1;
    this._saveAndNotify();
    return { ok: true, state: this.getState() };
  }

  updateItemQuantity(id, quantity) {
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 0 || qty > 25) {
      return { ok: false, field: 'quantity', reason: 'Quantity must be between 0 (remove) and 25.' };
    }
    const idx = this.state.cart.findIndex((c) => c.id === id);
    if (idx === -1) {
      return { ok: false, field: 'id', reason: `Item "${id}" is not currently in the cart.` };
    }
    if (qty === 0) {
      this.state.cart.splice(idx, 1);
    } else {
      this.state.cart[idx].quantity = qty;
    }
    this.state.version += 1;
    this._saveAndNotify();
    return { ok: true, state: this.getState() };
  }

  clearCart() {
    this.state.cart = [];
    this.state.version += 1;
    this._saveAndNotify();
    return { ok: true, state: this.getState() };
  }

  submitOrder({ customerName, fulfillment, deliveryAddress = '', expectedVersion }) {
    if (typeof expectedVersion === 'number' && expectedVersion !== this.state.version) {
      return {
        ok: false,
        field: 'expectedVersion',
        reason: `Cart changed before checkout (expected version ${expectedVersion}, current version is ${this.state.version}). Read the latest cart and confirm totals first.`
      };
    }
    if (this.state.cart.length === 0) {
      return { ok: false, field: 'cart', reason: 'Your cart is empty. Add at least one item before placing an order.' };
    }
    const cleanName = String(customerName || '').trim();
    if (cleanName.length < 2 || cleanName.length > 80) {
      return { ok: false, field: 'customerName', reason: 'Please provide a customer name (2–80 characters).' };
    }
    const mode = fulfillment || this.state.fulfillment;
    if (mode !== 'pickup' && mode !== 'delivery') {
      return { ok: false, field: 'fulfillment', reason: 'Fulfillment must be "pickup" or "delivery".' };
    }
    const cleanAddress = String(deliveryAddress || '').trim();
    if (mode === 'delivery' && cleanAddress.length < 5) {
      return {
        ok: false,
        field: 'deliveryAddress',
        reason: 'A local street address is required for delivery orders.'
      };
    }

    this.state.fulfillment = mode;
    const totals = this._computeTotals(this.state.cart, mode);
    const orderNumber = `HC-${String(Math.floor(100000 + Math.random() * 900000))}`;

    const receipt = {
      orderNumber,
      status: 'confirmed_preparing',
      placedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customerName: cleanName,
      fulfillment: mode,
      deliveryAddress: mode === 'delivery' ? cleanAddress : 'Counter Pickup — 214 Maple Street',
      items: structuredClone(this.state.cart),
      totals
    };

    this.state.lastOrder = receipt;
    this.state.cart = [];
    this.state.version += 1;
    this._saveAndNotify();

    return { ok: true, receipt, newVersion: this.state.version };
  }
}

export const App = {
  page: new HearthCrumbPage()
};