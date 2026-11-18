# @open-neighborhood/agentic-runtime-core

Integration wrapper that connects an Open Agentic Web site's `/runtime/index.js` (`boot`) with `@open-neighborhood/consent-policy-ui`, private-context (`sly_data`) previews, and `TrustAuditLog` telemetry.

## Quick Usage

```js
import { boot } from './runtime/index.js';
import { bootNeighborhoodSite } from '@open-neighborhood/agentic-runtime-core';

await bootNeighborhoodSite({
  bootRuntime: boot,
  mountSelector: '#assistant-root',
  siteName: 'My Local Business',
  privateContextProvider: () => ({ dietary: 'vegan', secretPin: '9999' }),
  allowedPeerContextKeys: ['dietary'],
  onAuditEvent: (events) => console.log('Latest trust event:', events[0])
});
```
