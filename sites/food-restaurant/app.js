import { App } from './script.js';
import { boot } from './runtime/index.js';
import { bootNeighborhoodSite } from '/packages/agentic-runtime-core/src/index.js';

const menuGrid = document.getElementById('menu-grid');
const filterPills = document.getElementById('filter-pills');
const cartItemsEl = document.getElementById('cart-items');
const cartTotalsEl = document.getElementById('cart-totals');
const cartVersionEl = document.getElementById('cart-version');
const receiptContainer = document.getElementById('receipt-container');
const modePickupBtn = document.getElementById('mode-pickup');
const modeDeliveryBtn = document.getElementById('mode-delivery');
const addressInput = document.getElementById('delivery-address');
const checkoutForm = document.getElementById('checkout-form');
const formErrorEl = document.getElementById('form-error');
const auditStatusEl = document.getElementById('audit-status');

let activeDietary = 'all';

function renderMenu(state) {
  const filtered =
    activeDietary === 'all'
      ? state.menu
      : state.menu.filter((item) => item.dietary.includes(activeDietary));

  menuGrid.innerHTML = filtered
    .map(
      (item) => `
      <article class="menu-item">
        <div>
          <div class="menu-category">${item.category} • ~${item.prepMinutes}m</div>
          <div class="menu-title-row">
            <h3>${item.name}</h3>
            <span class="price">$${item.price.toFixed(2)}</span>
          </div>
          <p class="menu-desc">${item.description}</p>
          <div class="tag-row">
            ${item.dietary.map((t) => `<span class="diet-tag">${t}</span>`).join('')}
          </div>
        </div>
        <button type="button" class="btn-add" data-add-id="${item.id}">+ Add to Cart</button>
      </article>
    `
    )
    .join('');
}

function renderCartAndReceipt(state) {
  cartVersionEl.textContent = `state v${state.version}`;
  modePickupBtn.classList.toggle('active', state.fulfillment === 'pickup');
  modeDeliveryBtn.classList.toggle('active', state.fulfillment === 'delivery');
  addressInput.style.display = state.fulfillment === 'delivery' ? 'block' : 'none';

  if (state.lastOrder) {
    const o = state.lastOrder;
    receiptContainer.innerHTML = `
      <div class="receipt-banner">
        <strong>✓ Order ${o.orderNumber} Confirmed (${o.placedAt})</strong><br>
        For <strong>${o.customerName}</strong> • ${o.fulfillment.toUpperCase()} (${o.deliveryAddress}) •
        Total: <strong>$${o.totals.total.toFixed(2)}</strong>
      </div>
    `;
  } else {
    receiptContainer.innerHTML = '';
  }

  if (state.cart.length === 0) {
    cartItemsEl.innerHTML = `<p style="color:var(--muted);font-size:13px;margin:6px 0;">Your kitchen cart is empty. Click an item or ask the assistant!</p>`;
    cartTotalsEl.innerHTML = '';
    return;
  }

  cartItemsEl.innerHTML = state.cart
    .map(
      (c) => `
      <div class="cart-row">
        <div>
          <strong>${c.name}</strong>
          <div style="font-size:12px;color:var(--muted);">$${c.unitPrice.toFixed(2)} each ${
            c.specialNote ? `• "${c.specialNote}"` : ''
          }</div>
        </div>
        <div class="qty-controls">
          <button type="button" class="qty-btn" data-qty-id="${c.id}" data-qty="${c.quantity - 1}">−</button>
          <span>${c.quantity}</span>
          <button type="button" class="qty-btn" data-qty-id="${c.id}" data-qty="${c.quantity + 1}">+</button>
        </div>
      </div>
    `
    )
    .join('');

  const t = state.totals;
  cartTotalsEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>$${t.subtotal.toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between;"><span>Delivery Fee</span><span>$${t.deliveryFee.toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between;"><span>Tax (8%)</span><span>$${t.tax.toFixed(2)}</span></div>
    <div class="total-final" style="display:flex;justify-content:space-between;">
      <span>Total (~${t.estimatedMinutes} mins)</span><span>$${t.total.toFixed(2)}</span>
    </div>
  `;
}

function renderAll(state = App.page.getState()) {
  renderMenu(state);
  renderCartAndReceipt(state);
}

filterPills.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-diet]');
  if (!btn) return;
  activeDietary = btn.dataset.diet;
  for (const el of filterPills.querySelectorAll('.pill')) {
    el.classList.toggle('active', el === btn);
  }
  renderMenu(App.page.getState());
});

menuGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add-id]');
  if (!btn) return;
  App.page.addItem(btn.dataset.addId, 1);
});

cartItemsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-qty-id]');
  if (!btn) return;
  App.page.updateItemQuantity(btn.dataset.qtyId, Number(btn.dataset.qty));
});

modePickupBtn.addEventListener('click', () => App.page.setFulfillment('pickup'));
modeDeliveryBtn.addEventListener('click', () => App.page.setFulfillment('delivery'));

checkoutForm.addEventListener('submit', (e) => {
  e.preventDefault();
  formErrorEl.textContent = '';
  const state = App.page.getState();
  const customerName = document.getElementById('customer-name').value;
  const deliveryAddress = addressInput.value;
  const res = App.page.submitOrder({
    customerName,
    fulfillment: state.fulfillment,
    deliveryAddress,
    expectedVersion: state.version
  });
  if (!res.ok) {
    formErrorEl.textContent = res.reason;
  } else {
    checkoutForm.reset();
  }
});

App.page.subscribe(renderAll);
renderAll();

// Boot the official Open Agentic Web browser runtime + Trust Dialogs
bootNeighborhoodSite({
  bootRuntime: boot,
  mountSelector: '#assistant-root',
  siteName: 'Hearth & Crumb Kitchen',
  onAuditEvent: (events) => {
    const latest = events[0];
    if (latest && auditStatusEl) {
      auditStatusEl.textContent = `Last check: ${latest.type.replace(/_/g, ' ')}`;
    }
  }
});