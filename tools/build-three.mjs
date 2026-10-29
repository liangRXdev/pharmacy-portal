import { build } from 'esbuild';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const version = JSON.parse(await readFile('node_modules/three/package.json')).version;
const result = await build({
  stdin: { contents: `export { Scene, Color, PerspectiveCamera, WebGLRenderer, HemisphereLight, DirectionalLight, BoxGeometry, Mesh, MeshStandardMaterial, Vector2, Vector3, Raycaster } from 'three'; export { OrbitControls } from 'three/addons/controls/OrbitControls.js';`, resolveDir: process.cwd(), sourcefile: 'three-entry.js' },
  bundle: true, format: 'esm', minify: true, legalComments: 'inline', target: 'es2022', write: false,
  banner: { js: `/*! Three.js ${version} | MIT License | see LICENSE-three.txt */` },
});
const output = result.outputFiles[0].contents;
const file = 'public/pharmacy/vendor/three-lite.js';
if (process.argv.includes('--check')) {
  if (!Buffer.from(output).equals(await readFile(file))) throw new Error('Three vendor differs; run npm run build:three');
  if (!(await readFile('node_modules/three/LICENSE')).equals(await readFile('public/pharmacy/vendor/LICENSE-three.txt'))) throw new Error('Three license differs');
} else {
  await writeFile(file, output);
  await copyFile('node_modules/three/LICENSE', 'public/pharmacy/vendor/LICENSE-three.txt');
}
console.log(`Three ${version}: ${output.length} bytes, gzip ${gzipSync(output).length} bytes; ${process.argv.includes('--check') ? 'reproducible' : 'built'}`);
