import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/data', { recursive: true });
for (const file of ['index.html', 'app.js', 'styles.css']) {
  await cp(file, `dist/${file}`);
}
await cp('data/hotspots.json', 'dist/data/hotspots.json');
console.log('Built GitHub Pages site in dist/');
