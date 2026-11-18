import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SITES_DIR = path.join(ROOT_DIR, 'sites');
const TEMPLATE_HOCON = path.join(
  ROOT_DIR,
  '.vendor',
  'agentic-web',
  'skills',
  'agentify-website',
  'templates',
  'network.hocon'
);
const BUILD_SCRIPT = path.join(
  ROOT_DIR,
  '.vendor',
  'agentic-web',
  'skills',
  'agentify-website',
  'scripts',
  'build_network.mjs'
);

async function ensureLf(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  if (raw.includes('\r\n')) {
    await fs.writeFile(filePath, raw.replace(/\r\n/g, '\n'), 'utf8');
  }
}

async function main() {
  console.log('\n🔨 Compiling Open Agentic Web HOCON networks via official build_network.mjs...\n');

  await ensureLf(TEMPLATE_HOCON);

  const siteEntries = await fs.readdir(SITES_DIR, { withFileTypes: true });
  let builtCount = 0;

  for (const entry of siteEntries) {
    if (!entry.isDirectory()) continue;
    const siteDir = path.join(SITES_DIR, entry.name);
    const files = await fs.readdir(siteDir);
    const hoconFiles = files.filter((f) => f.endsWith('.hocon'));

    for (const hoconFile of hoconFiles) {
      const hoconPath = path.join(siteDir, hoconFile);
      await ensureLf(hoconPath);
      const manifestPath = path.join(siteDir, 'agent-manifest.json');
      const runtimeDir = path.join(siteDir, 'runtime');

      console.log(`  → Building [${entry.name}] ${hoconFile} ...`);
      execFileSync(
        process.execPath,
        [BUILD_SCRIPT, hoconPath, '--manifest', manifestPath, '--runtime', runtimeDir],
        { stdio: 'inherit' }
      );
      builtCount++;
    }
  }

  console.log(`\n✅ Successfully built and checked ${builtCount} agent network(s).\n`);
}

main().catch((err) => {
  console.error('\n✖ Network build failed:', err.message);
  process.exit(1);
});