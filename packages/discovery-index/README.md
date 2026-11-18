# @open-neighborhood/discovery-index

Lightweight peer discovery and live `agent-manifest.json` probing for the Open Agentic Web.

## Quick Usage

```js
import { NeighborhoodDiscoveryIndex, probeAgenticSite } from '@open-neighborhood/discovery-index';

// The browser enforces CORS; the probe validates the manifest and fails closed.
const probe = await probeAgenticSite('https://bakery.example');
if (probe.valid) {
  console.log(probe.networkUrl, probe.frontMan, probe.toolCount);
}

// Load a static neighborhood index and user-added localStorage peers.
const directory = new NeighborhoodDiscoveryIndex({ indexUrl: './neighborhood-index.json' });
await directory.loadAndProbeAll();
const matches = directory.search('vegan pizza', { category: 'food', onlineOnly: true });
```
