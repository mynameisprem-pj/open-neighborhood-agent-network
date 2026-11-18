import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkPeerPolicy,
  filterPrivateContext
} from '../packages/network-linker/src/index.js';
import { probeAgenticSite } from '../packages/discovery-index/src/index.js';
import { App as FoodApp } from '../sites/food-restaurant/script.js';
import { App as ServicesApp } from '../sites/local-services/script.js';
import { App as BookingApp } from '../sites/appointments-booking/script.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const CHECK_PARTNER = path.join(
  ROOT_DIR,
  '.vendor',
  'agentic-web',
  'skills',
  'agentify-website',
  'scripts',
  'check_partner.mjs'
);

test('Security: checkPeerPolicy fails closed on unapproved and denied origins', () => {
  const hubManifest = {
    allowed_peers: ['http://localhost:4101', 'http://localhost:4102'],
    peer_policy: { mode: 'closed', deny_origins: ['http://localhost:4102'] }
  };

  assert.equal(checkPeerPolicy(hubManifest, 'http://localhost:4101/hearth_crumb_assistant').allowed, true);
  assert.equal(checkPeerPolicy(hubManifest, 'http://localhost:4102/civicfix_assistant').allowed, false);
  assert.equal(checkPeerPolicy(hubManifest, 'https://untrusted.example/rogue').allowed, false);
});

test('Privacy: filterPrivateContext strips non-allowlisted sly_data secrets', () => {
  const raw = {
    neighborhood: 'Oakwood',
    dietary_preference: 'vegan',
    home_gate_code: '4829#',
    saved_payment_last4: '8842'
  };
  const { filtered, strippedKeys } = filterPrivateContext(raw, ['neighborhood', 'dietary_preference']);

  assert.deepEqual(filtered, { neighborhood: 'Oakwood', dietary_preference: 'vegan' });
  assert.deepEqual(strippedKeys.sort(), ['home_gate_code', 'saved_payment_last4']);
});

test('State Grounding: all 3 vertical sites enforce expectedVersion optimistic concurrency', () => {
  FoodApp.page.clearCart();
  const added = FoodApp.page.addItem('harvest-quinoa-bowl', 1);
  assert.equal(added.ok, true);
  const staleOrder = FoodApp.page.submitOrder({
    customerName: 'Alex',
    fulfillment: 'pickup',
    expectedVersion: added.state.version - 1
  });
  assert.equal(staleOrder.ok, false);
  assert.equal(staleOrder.field, 'expectedVersion');

  const est = ServicesApp.page.configureServiceDraft({ serviceId: 'leak-drain-plumbing', estimatedHours: 2 });
  const staleDispatch = ServicesApp.page.confirmDispatch({
    customerName: 'Jordan',
    serviceAddress: '412 Elm Street',
    expectedVersion: est.state.version + 99
  });
  assert.equal(staleDispatch.ok, false);

  const held = BookingApp.page.holdSlotSelection('clinic-today-1600');
  const staleBook = BookingApp.page.confirmBooking({
    attendeeName: 'Samira',
    expectedVersion: held.state.version - 1
  });
  assert.equal(staleBook.ok, false);
});

test('Cross-Origin Integration: live servers pass probeAgenticSite & official check_partner.mjs', async (t) => {
  const proc = spawn(process.execPath, ['scripts/dev-servers.mjs'], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  t.after(() => {
    proc.kill();
  });

  // Wait for all 4 ports to listen
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Dev servers timed out starting')), 6000);
    let output = '';
    proc.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.includes('4103')) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  const peers = [
    'http://localhost:4101/hearth_crumb_assistant',
    'http://localhost:4102/civicfix_assistant',
    'http://localhost:4103/oakwood_booking_assistant'
  ];

  for (const peerUrl of peers) {
    const origin = new URL(peerUrl).origin;
    const probe = await probeAgenticSite(origin);
    assert.equal(probe.valid, true, `Expected valid manifest at ${origin}`);

    // Run Cognizant AI Lab's official cross-origin partner verifier!
    const out = execFileSync(
      process.execPath,
      [CHECK_PARTNER, peerUrl, '--origin', 'http://127.0.0.1:4100'],
      { encoding: 'utf8' }
    );
    assert.match(out, /hearth_crumb_assistant|civicfix_assistant|oakwood_booking_assistant/);
  }
});