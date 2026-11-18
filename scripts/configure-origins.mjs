import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const LOCAL_DEFAULTS = {
  hub: 'http://127.0.0.1:4100',
  food: 'http://localhost:4101',
  services: 'http://localhost:4102',
  booking: 'http://localhost:4103'
};

const TARGET_FILES = [
  'sites/hub/agent-manifest.json',
  'sites/hub/neighborhood_hub.hocon',
  'sites/hub/neighborhood-index.json',
  'sites/hub/script.js',
  'sites/hub/site-actions.js',
  'sites/hub/app.js',
  'sites/food-restaurant/index.html',
  'sites/food-restaurant/script.js',
  'sites/food-restaurant/hearth_crumb_assistant.hocon',
  'sites/local-services/index.html',
  'sites/local-services/script.js',
  'sites/local-services/civicfix_assistant.hocon',
  'sites/appointments-booking/index.html',
  'sites/appointments-booking/script.js',
  'sites/appointments-booking/oakwood_booking_assistant.hocon'
];

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith('--')) {
      args[key.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    }
  }
  return args;
}

async function readCurrentOrigins() {
  const indexRaw = JSON.parse(
    await fs.readFile(path.join(ROOT_DIR, 'sites/hub/neighborhood-index.json'), 'utf8')
  );
  const hubScript = await fs.readFile(path.join(ROOT_DIR, 'sites/hub/script.js'), 'utf8');
  const hubMatch = hubScript.match(/url:\s*'([^']+)'/);

  return {
    hub: hubMatch ? hubMatch[1] : 'http://localhost:4100',
    food: indexRaw.peers.find((p) => p.id === 'hearth-crumb-food')?.origin || LOCAL_DEFAULTS.food,
    services: indexRaw.peers.find((p) => p.id === 'civicfix-services')?.origin || LOCAL_DEFAULTS.services,
    booking: indexRaw.peers.find((p) => p.id === 'oakwood-booking')?.origin || LOCAL_DEFAULTS.booking
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const next =
    args.preset === 'local'
      ? { ...LOCAL_DEFAULTS }
      : {
          hub: (args.hub || LOCAL_DEFAULTS.hub).replace(/\/$/, ''),
          food: (args.food || LOCAL_DEFAULTS.food).replace(/\/$/, ''),
          services: (args.services || LOCAL_DEFAULTS.services).replace(/\/$/, ''),
          booking: (args.booking || LOCAL_DEFAULTS.booking).replace(/\/$/, '')
        };

  const current = await readCurrentOrigins();
  const replacements = [
    [current.hub, next.hub],
    ['http://localhost:4100', next.hub],
    [current.food, next.food],
    [current.services, next.services],
    [current.booking, next.booking]
  ];

  console.log('\n🔗 Updating multi-origin bindings across all 4 agentic sites...');
  console.log('  Hub       ->', next.hub);
  console.log('  Food      ->', next.food);
  console.log('  Services  ->', next.services);
  console.log('  Booking   ->', next.booking);

  for (const rel of TARGET_FILES) {
    const full = path.join(ROOT_DIR, rel);
    let content = await fs.readFile(full, 'utf8');
    for (const [fromUrl, toUrl] of replacements) {
      if (fromUrl && fromUrl !== toUrl) {
        content = content.split(fromUrl).join(toUrl);
      }
    }
    await fs.writeFile(full, content, 'utf8');
  }

  execFileSync(process.execPath, [path.join(ROOT_DIR, 'scripts/build-networks.mjs')], {
    stdio: 'inherit'
  });
}

main().catch((err) => {
  console.error('\n✖ Origin configuration failed:', err.message);
  process.exit(1);
});