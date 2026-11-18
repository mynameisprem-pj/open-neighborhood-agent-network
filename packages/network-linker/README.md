# @open-neighborhood/network-linker

Fail-closed manifest and network-schema validation, peer-policy enforcement, symbolic `links.json` resolution, and private `sly_data` context filtering.

## Quick Usage

```js
import {
  validateManifest,
  checkPeerPolicy,
  filterPrivateContext
} from '@open-neighborhood/network-linker';

const policy = checkPeerPolicy(
  callerManifest,
  'https://partner.example/assistant'
);
if (!policy.allowed) throw new Error(policy.reason);

const { filtered, strippedKeys } = filterPrivateContext(
  { dietary: 'vegan', gate_code: '4829#' },
  ['dietary']
);
```
