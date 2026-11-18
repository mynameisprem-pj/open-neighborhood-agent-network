# @open-neighborhood/consent-policy-ui

Accessible Shadow DOM peer-consent cards, write-action confirmation dialogs, and composed assistant CSS for Open Agentic Web sites.

## Quick Usage

```js
import { createTrustDialogs } from '@open-neighborhood/consent-policy-ui';

const dialogs = createTrustDialogs();

const consent = await dialogs.requestPeerConsent({
  peerUrl: 'https://bakery.example/hearth_crumb_assistant',
  peerTitle: 'Hearth & Crumb Kitchen',
  peerPolicy: 'closed (allowlisted)',
  taskSummary: 'Ask what vegan and gluten-free dishes are offered.',
  sharedContextKeys: ['dietary_preference'],
  strippedContextKeys: ['home_gate_code', 'saved_payment_last4']
});
// consent -> { approved: true|false, scope: 'once'|'session'|'declined' }
```

Include `src/assistant-host.css` in your site to mount the official `neuro-san-web` UI cleanly in `<div data-ns-slot="...">` containers without horizontal clipping.
