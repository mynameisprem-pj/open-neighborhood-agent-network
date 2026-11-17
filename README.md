# Open Neighborhood Agent Network

An interconnected, multi-site ecosystem built for the **Open Agentic Web**, demonstrating how everyday people can discover local businesses and complete real-world tasks across independent websites—entirely in their browser, under their own LLM keys (BYOK), with explicit consent and strict privacy controls.

Conforms to the [Worldwide Agentic Web MVP Specification](https://github.com/cognizant-ai-labs/agentic-web).

## Vision & Product Architecture

Instead of locking local businesses inside a closed aggregator platform, **Open Neighborhood Agent Network** lets independent neighborhood websites publish portable, data-only JSON agent networks (`agent-manifest.json`, `*.network.json`, `links.json`) that run client-side and collaborate safely across origins.

### 1. Four Live Agentic Websites (`sites/`)
- **`sites/hub` — Neighborhood Hub:** Central discovery and task orchestration assistant for residents. Discovers local peers, requests explicit user approval before loading external networks, filters private context, hands off structured tasks, and synthesizes results.
- **`sites/food-restaurant` — Hearth & Crumb Kitchen:** Full menu browsing, dietary filtering, live cart state synchronization, and confirmed checkout.
- **`sites/local-services` — CivicFix Local Errands & Repairs:** Plumbing, electrical, cleaning, and handyman service quotes, availability checks, and dispatch requests.
- **`sites/appointments-booking` — Oakwood Community Scheduling:** Clinic visits, tutoring sessions, and tool-library bookings with live slot updates and confirmation gates.

### 2. Reusable Open-Source Building Blocks (`packages/`)
- **`packages/discovery-index`:** Lightweight, standards-aligned client helper and JSON index format for discovering peer agent manifests by capability and locality.
- **`packages/consent-policy-ui`:** Drop-in accessible web component for displaying peer network capabilities, trust policies, context-sharing boundaries, and write-action confirmation dialogs.
- **`packages/network-linker`:** Fail-closed cross-site composition utilities for resolving `links.json`, enforcing private-context filtering, handling structured handoffs, and distinguishing confirmed success from unknown/aborted outcomes.
- **`packages/agentic-runtime-core`:** Shared browser runtime integration and BYOK LLM provider configuration (supporting OpenRouter, Mozilla Otari, OpenAI, Anthropic, and local endpoints).

## Core Principles
- **100% Browser-Executed & Zero Host Inference Cost:** Runs in the visitor's tab using their own API keys/router (BYOK).
- **Real Page State Grounding:** Agents read live DOM/application state and propose structured actions; irreversible/write actions always require human confirmation.
- **Trust & Fail-Closed Safety:** No silent third-party network loading, no unfiltered context leakage, and explicit outcome reporting.

## License
MIT