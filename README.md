# Open Neighborhood Agent Network

**Decentralized Multi-Site Local Commerce, Services & Scheduling on the Open Agentic Web**

Built in full conformance with the [Worldwide Agentic Web Specification (`cognizant-ai-labs/agentic-web`)](https://github.com/cognizant-ai-labs/agentic-web) — running **100% in the visitor's browser** under **Bring Your Own Key (BYOK)** with zero host inference cost, explicit cross-origin consent cards, fail-closed peer policies, private-context (`sly_data`) filtering, and optimistic-concurrency page actions.

---

## Why This Project Exists

Today, local restaurants, repair cooperatives, and community clinics are forced onto closed aggregator platforms that charge steep commissions and wall off user assistants.

**Open Neighborhood Agent Network** proves an open alternative: independent neighborhood websites publish lightweight, data-only JSON agent networks (`agent-manifest.json`, `*.network.json`, `links.json`, and `bridge/action-bridge.html`) that execute client-side and collaborate safely across web origins—only after the visitor approves each connection.

---

## Live Multi-Site Architecture (4 Independent Web Origins)

| Website | Live Production Origin | Published Network | Real Page State & Actions |
|---|---|---|---|
| **Oakwood Neighborhood Hub** (`sites/hub`) | [`https://open-neighborhood-hub.vercel.app`](https://open-neighborhood-hub.vercel.app) | `neighborhood_hub` | Live manifest discovery, Privacy Shield (`sly_data`), cross-site partner orchestration, 1-click handoff Action Plan |
| **Hearth & Crumb Kitchen** (`sites/food-restaurant`) | [`https://hearth-crumb-food.vercel.app`](https://hearth-crumb-food.vercel.app) | `hearth_crumb_assistant` | Dietary filters, live kitchen cart, pickup/delivery fee engine, confirmed checkout (`HC-XXXXXX`) |
| **CivicFix Local Services** (`sites/local-services`) | [`https://civicfix-services.vercel.app`](https://civicfix-services.vercel.app) | `civicfix_assistant` | Plumbing, electrical, cleaning, handyman & errand rate quotes, urgent dispatch toggle, confirmed work orders (`CF-XXXXXX`) |
| **Oakwood Community Scheduling** (`sites/appointments-booking`) | [`https://oakwood-booking.vercel.app`](https://oakwood-booking.vercel.app) | `oakwood_booking_assistant` | Clinic, 1-on-1 STEM tutoring & maker-lab time-slot holds, slot locking (`OK-XXXXXX`), and cancellations |

---

## Reusable Open-Source Building Blocks (`packages/`)

Any developer agentifying a website can adopt these zero-dependency ES modules directly:

1. **[`@open-neighborhood/discovery-index`](./packages/discovery-index)** — Probes `/agent-manifest.json` across origins with timeouts and schema checks, merges static JSON directories with user-added `localStorage` peers, and ranks local capabilities.
2. **[`@open-neighborhood/consent-policy-ui`](./packages/consent-policy-ui)** — Shadow-DOM `<div data-onaw-trust-dialog>` Peer Network Consent Cards (showing **Allow Once**, **Allow for Session**, **Decline**, and shared vs. withheld context keys), Write-Action Confirmation Modals, and `assistant-host.css` for unclipped `data-ns-slot` embedding.
3. **[`@open-neighborhood/network-linker`](./packages/network-linker)** — Fail-closed validator for `agent-manifest.json` and `*.network.json`, `peer_policy` + `allowed_peers` / `deny_origins` enforcement, `links.json` symbolic resolution, and `filterPrivateContext(slyData, allowedKeys)`.
4. **[`@open-neighborhood/agentic-runtime-core`](./packages/agentic-runtime-core)** — Drop-in adapter wiring the unmodified `neuro-san-web` browser `Engine` (`onConsent` & `onActionConfirm`) to standardized trust cards and live `TrustAuditLog` telemetry.

For deep architectural and security details (including token cost notes, `expectedVersion` optimistic concurrency, and isolated action bridges), see **[`docs/ARCHITECTURE_AND_TRUST.md`](./docs/ARCHITECTURE_AND_TRUST.md)**.

---

## Quick Start (Zero-Build Local Run in 60 Seconds)

**Prerequisites:** Node.js `>= 20.0.0` and Git.

```bash
# 1. Install workspace links
npm install

# 2. (Optional if cloning fresh without vendor cache) Sync official Cognizant reference compiler & runtime
npm run setup:official

# 3. Compile & check all 4 HOCON networks via official build_network.mjs
npm run build:networks

# 4. Run automated security, concurrency & live cross-origin check_partner.mjs test suite
npm test

# 5. Launch all 4 independent web origins with CORS enabled
npm run dev

#6. Anyone wanting to run offline on localhost
npm run origins:local