import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const base = process.argv[2];
if (!base) {
  throw new Error('Usage: node tools/production-media-smoke.mjs <origin>');
}

const policy = JSON.parse(fs.readFileSync(path.join(root, 'tools/site-policy.json'), 'utf8'));
const pages = fs.readdirSync(root)
  .filter((name) => name.endsWith('.html') && !policy.excludedHtml.includes(name))
  .sort();
const failures = [];

function localTargets(html) {
  return [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((target) => !/^(?:[a-z]+:|\/\/|#|%|\/|data:)/i.test(target));
}

for (const page of pages) {
  const pageUrl = new URL(page, `${base.replace(/\/$/, '')}/`);
  const response = await fetch(pageUrl, { redirect: 'follow', cache: 'no-store' });
  const contentType = response.headers.get('content-type') || '';
  const html = await response.text();

  if (!response.ok || !contentType.startsWith('text/html')) {
    failures.push(`${page}: invalid HTML response (${response.status}, ${contentType})`);
    continue;
  }

  for (const target of localTargets(html)) {
    const assetUrl = new URL(target.split(/[?#]/, 1)[0], pageUrl);
    const asset = await fetch(assetUrl, { redirect: 'follow', cache: 'no-store' });
    const assetType = asset.headers.get('content-type') || '';
    const body = await asset.arrayBuffer();
    if (!asset.ok || !assetType.startsWith('image/') || body.byteLength === 0) {
      failures.push(
        `${page}: invalid production image ${assetUrl} `
        + `(${asset.status}, ${assetType}, ${body.byteLength} bytes)`
      );
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Production media smoke passed for ${pages.length} pages`);
