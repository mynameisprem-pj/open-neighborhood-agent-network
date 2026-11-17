import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateManifest,
  validateNetworkDefinition,
  checkPeerPolicy,
  filterPrivateContext
} from '../packages/network-linker/src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SITES_DIR = path.join(ROOT_DIR, 'sites');

async function runSelfTest() {
  // Quick built-in sanity check of fail-closed peer policy & sly_data filtering
  const policyCheck = checkPeerPolicy(
    { peer_policy: 'allowlist', allowed_peers: ['http://localhost:4101'] },
    'http://evil.example.com/rogue_net'
  );
  if (policyCheck.allowed) {
    throw new Error('Self-test failed: unauthorized origin was not blocked!');
  }

  const { filtered, strippedKeys } = filterPrivateContext(
    { dietary_preference: 'vegetarian', credit_card_token: 'secret_123', home_gate_code: '9941' },
    ['dietary_preference']
  );
  if ('credit_card_token' in filtered || !strippedKeys.includes('credit_card_token')) {
    throw new Error('Self-test failed: private sly_data leaked across boundary!');
  }
  console.log('  ✔ Fail-closed peer_policy & sly_data filter self-tests passed');
}

async function validateAllSites() {
  console.log('\n🔍 Validating Open Agentic Web Conformance...\n');
  await runSelfTest();

  const entries = await fs.readdir(SITES_DIR, { withFileTypes: true });
  let checkedCount = 0;
  let hasErrors = false;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const siteDir = path.join(SITES_DIR, entry.name);
    const manifestPath = path.join(siteDir, 'agent-manifest.json');

    try {
      await fs.access(manifestPath);
    } catch {
      console.log(`  ℹ [${entry.name}] No agent-manifest.json yet (pending agentification)`);
      continue;
    }

    checkedCount++;
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    const mRes = validateManifest(manifest, `${entry.name}/agent-manifest.json`);
    if (!mRes.valid) {
      hasErrors = true;
      mRes.errors.forEach((e) => console.error(`  ✖ ${e}`));
      continue;
    }

    for (const net of manifest.networks) {
      const netPath = path.join(siteDir, net.hocon);
      const netDoc = JSON.parse(await fs.readFile(netPath, 'utf8'));
      const nRes = validateNetworkDefinition(netDoc, net.front_man, `${entry.name}/${net.hocon}`);
      if (!nRes.valid) {
        hasErrors = true;
        nRes.errors.forEach((e) => console.error(`  ✖ ${e}`));
      }
    }

    if (!hasErrors) {
      console.log(`  ✔ [${entry.name}] Manifest & network graph conform to MVP spec`);
    }
  }

  if (hasErrors) {
    process.exitCode = 1;
  } else {
    console.log(`\n✅ Validation complete (${checkedCount} site(s) agentified so far, 0 errors).\n`);
  }
}

validateAllSites();