import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const source = new URL('../public/social-preview.svg', import.meta.url);
const destination = new URL('../public/social-preview.png', import.meta.url);
const svg = await readFile(source, 'utf8');
const renderer = new Resvg(svg, {
  fitTo: { mode: 'original' },
  font: { defaultFontFamily: 'Arial', loadSystemFonts: true },
});
const image = renderer.render();

if (image.width !== 1280 || image.height !== 640) {
  throw new Error(`Expected a 1280 × 640 preview; rendered ${image.width} × ${image.height}.`);
}

const rendered = Buffer.from(image.asPng());

if (process.argv.includes('--check')) {
  const committed = await readFile(destination);
  if (!committed.equals(rendered)) {
    throw new Error('public/social-preview.png is not current. Run npm run assets:social.');
  }
} else {
  await writeFile(destination, rendered);
  process.stdout.write('Rendered public/social-preview.png (1280 × 640).\n');
}
