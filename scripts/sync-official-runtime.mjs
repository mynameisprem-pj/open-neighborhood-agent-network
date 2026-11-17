import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const VENDOR_DIR = path.join(ROOT_DIR, '.vendor', 'agentic-web');
const REPO_URL = 'https://github.com/cognizant-ai-labs/agentic-web.git';

const SITE_DIRS = [
  'sites/hub',
  'sites/food-restaurant',
  'sites/local-services',
  'sites/appointments-booking'
];

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('\n📦 Syncing official cognizant-ai-labs/agentic-web reference runtime & compiler...\n');

  await fs.mkdir(path.join(ROOT_DIR, '.vendor'), { recursive: true });

  if (!(await exists(VENDOR_DIR))) {
    console.log(`  → Cloning ${REPO_URL} into .vendor/agentic-web ...`);
    execFileSync('git', ['clone', '--depth', '1', REPO_URL, VENDOR_DIR], { stdio: 'inherit' });
  } else {
    console.log('  → Updating existing .vendor/agentic-web snapshot...');
    execFileSync('git', ['-C', VENDOR_DIR, 'pull', '--ff-only'], { stdio: 'inherit' });
  }

  const skillRuntimeDir = path.join(VENDOR_DIR, 'skills', 'agentify-website', 'runtime');
  const buildScriptPath = path.join(VENDOR_DIR, 'skills', 'agentify-website', 'scripts', 'build_network.mjs');

  if (!(await exists(skillRuntimeDir))) {
    throw new Error(`Expected official runtime at ${skillRuntimeDir}, please check upstream structure.`);
  }

  console.log(`  ✔ Verified official runtime: ${path.relative(ROOT_DIR, skillRuntimeDir)}`);
  if (await exists(buildScriptPath)) {
    console.log(`  ✔ Verified network compiler: ${path.relative(ROOT_DIR, buildScriptPath)}`);
  }

  // Copy unmodified official browser runtime into each of our 4 independent sites
  for (const relSite of SITE_DIRS) {
    const destRuntime = path.join(ROOT_DIR, relSite, 'runtime');
    await fs.rm(destRuntime, { recursive: true, force: true });
    await fs.cp(skillRuntimeDir, destRuntime, { recursive: true });
    console.log(`  ✔ Installed unmodified runtime -> ${relSite}/runtime/`);
  }

  console.log('\n✅ Official Open Agentic Web runtime synced across all 4 sites.\n');
}

main().catch((err) => {
  console.error('\n✖ Sync failed:', err.message);
  process.exit(1);
});