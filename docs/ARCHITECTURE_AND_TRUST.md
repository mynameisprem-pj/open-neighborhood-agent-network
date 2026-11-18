# Architecture, Cross-Site Linking & Trust Model

This document explains how **Open Neighborhood Agent Network** implements multi-site discovery, explicit user consent, private-context (`sly_data`) filtering, and grounded page actions in strict conformance with the [Worldwide Agentic Web Specification](https://github.com/cognizant-ai-labs/agentic-web).

---

## 1. Multi-Origin Topology & Host Isolation

The system runs as **four independent web origins**:

| Site | Local URL | Published Network URL | Role |
|---|---|---|---|
| **Oakwood Neighborhood Hub** | `http://127.0.0.1:4100` | `http://127.0.0.1:4100/neighborhood_hub` | Discovery index, multi-agent orchestrator, resident action plan |
| **Hearth & Crumb Kitchen** | `http://localhost:4101` | `http://localhost:4101/hearth_crumb_assistant` | Menu browsing, dietary filtering, live cart, confirmed orders |
| **CivicFix Local Services** | `http://localhost:4102` | `http://localhost:4102/civicfix_assistant` | Trades/errand quotes, urgency pricing, confirmed technician dispatch |
| **Oakwood Scheduling** | `http://localhost:4103` | `http://localhost:4103/oakwood_booking_assistant` | Clinic, tutoring & maker-lab slot holds, confirmed reservations |

### Why `127.0.0.1:4100` vs `localhost:4101–4103` Locally?
Browsers scope cookies by hostname (ignoring port). Serving/opening the Hub at `http://127.0.0.1:4100` while addressing the three partner businesses at `http://localhost:4101–4103` enforces **true cross-hostname origin isolation** on a single developer workstation:
- Cookies or session storage on `127.0.0.1` never reach `localhost`.
- Every cross-origin call from the Hub triggers genuine CORS preflight/header checks, loads the partner's isolated `bridge/action-bridge.html` iframe, and requires explicit visitor approval on the consent card before any network fetch occurs.

---

## 2. Linked Partner Execution & Security Boundaries

1. **Pre-Contact Consent Card:**
   - Before contacting any external origin, `engine.onConsent` mounts `@open-neighborhood/consent-policy-ui` (`<div data-onaw-trust-dialog>` inside an isolated Shadow DOM).
   - The card displays the partner's human title, exact network URL, `peer_policy.mode`, task summary (kept under 140 characters by `partner_rules`), and a live preview of which resident preference keys are **Shared** vs **Strictly Withheld**.
   - **Allow Once** permits that single call; **Allow for Session** caches approval for that origin until reload or until the visitor clicks **Reset Session Consents**; **Decline** aborts immediately with zero network traffic sent to the partner.

2. **Client-Side BYOK Execution & Isolated Action Bridge:**
   - After consent, the Hub's browser fetches the partner's `agent-manifest.json`, `<network>.network.json`, `links.json`, and loads `bridge/action-bridge.html` (which lists no action module and executes none of the partner's page scripts).
   - Model inference runs strictly in the visitor's browser against the visitor's configured BYOK router and API key—never sent to the Hub host or partner hosts.
   - Because remote callers do not receive a partner's `website_*` DOM tools, a calling site can never silently mutate a visitor's cart or booking on another origin. Instead, the partner answers what it offers and how to book, and the Hub pins a **1-Click Handoff Card** (`?prompt=...` prefill, never auto-submitted) so the visitor finishes live state changes directly on the partner's own page.
   - Note on token usage: the runtime's built-in token estimate counts the short request string; executing the partner's front agent uses additional prompt tokens (~2,000–2,500 tokens per partner call) on the visitor's key.

3. **Private Context (`sly_data`) Filtering & Zero-PII Requests:**
   - `partner_rules` instructs the Hub never to include names, emails, phone numbers, gate codes, or booking codes in partner requests, and visitors verify the exact request on the consent card.
   - `@open-neighborhood/network-linker`'s `filterPrivateContext(slyData, allowedKeys)` strips non-allowlisted fields (`home_gate_code`, `saved_payment_last4`) before any context leaves the local vault.

---

## 3. Grounded Page State & Optimistic Concurrency (`expectedVersion`)

Every vertical site (`food-restaurant`, `local-services`, `appointments-booking`) shares a single state controller (`App.page` in `script.js`) between manual UI buttons and `site-actions.js`:
- **`effect: "read"`** returns a deep-cloned snapshot including an integer `version`.
- **`effect: "write"`** performs reversible state updates (e.g., adding to cart, holding a slot, configuring an estimate), increments `version`, and notifies UI subscribers immediately.
- **`effect: "irreversible"`** (checkout, technician dispatch, confirmed reservation) validates `expectedVersion` against `state.version`—refusing stale state if the visitor modified the page mid-turn—and opens the Shadow-DOM Write Confirmation Modal (`engine.onActionConfirm`) before committing.
- **Explicit Outcome Reporting:** Tool results distinguish `"succeeded"` (`ok: true`), structured domain refusal (`ok: false, reason`), `"cancelled"` (visitor declined confirmation), and `"unknown"` (unexpected throw—never retried blindly).