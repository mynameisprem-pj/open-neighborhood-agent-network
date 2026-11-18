import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PACKAGES_SRC = path.join(ROOT_DIR, 'packages');

const SITES = ['hub', 'food-restaurant', 'local-services', 'appointments-booking'];

const NETLIFY_HEADERS = `/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Accept

/bridge/*
  X-Frame-Options: ALLOWALL
`;

const VERCEL_JSON = JSON.stringify(
  {
    headers: [
      {
        source: '/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, HEAD, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Accept' }
        ]
      }
    ]
  },
  null,
  2
);

async function rewritePortableImports(siteDistDir) {
  const jsFiles = ['script.js', 'app.js'];
  for (const file of jsFiles) {
    const target = path.join(siteDistDir, file);
    try {
      let text = await fs.readFile(target, 'utf8');
      text = text
        .replaceAll('../../packages/', './packages/')
        .replaceAll("'/packages/", "'./packages/")
        .replaceAll('"/packages/', '"./packages/');
      await fs.writeFile(target, text, 'utf8');
    } catch {
      // Skip if file does not exist
    }
  }
}

async function main() {
  console.log('\n📦 Building standalone static deployment bundles in dist/...\n');
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_DIR, { recursive: true });

  for (const site of SITES) {
    const srcSite = path.join(ROOT_DIR, 'sites', site);
    const outSite = path.join(DIST_DIR, site);

    await fs.cp(srcSite, outSite, { recursive: true });
    await fs.cp(PACKAGES_SRC, path.join(outSite, 'packages'), { recursive: true });
    await rewritePortableImports(outSite);

    await fs.writeFile(path.join(outSite, '_headers'), NETLIFY_HEADERS, 'utf8');
    await fs.writeFile(path.join(outSite, 'vercel.json'), VERCEL_JSON, 'utf8');

    console.log(`  ✔ Exported self-contained bundle -> dist/${site}/`);
  }

  console.log('\n✅ All 4 static bundles ready in dist/ (deployable to Vercel, Cloudflare Pages, Netlify, or any CORS static host).\n');
}

main().catch((err) => {
  console.error('\n✖ Static export failed:', err.message);
  process.exit(1);
});