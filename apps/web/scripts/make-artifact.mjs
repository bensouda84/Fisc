// Assemble la démonstration en UNE page autonome (CSS, JS, polices et logos incorporés), prête à publier comme artefact.
// Les artefacts reçoivent le contenu de la page sans <html>, <head> ni <body> : l'hôte pose son propre squelette.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../dist-demo/', import.meta.url).pathname;
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const assets = join(dir, 'assets');
const files = readdirSync(assets);
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');
if (!js) throw new Error('Aucun script produit : lancer `vite build --mode demo` d’abord.');
const description = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '';

const safeJs = js.replaceAll('</script', '<\\/script').replaceAll('<!--', '<\\!--');
const page = `<title>mesimpo</title>
<meta name="description" content="${description}">
<style>
${css.replaceAll('</style', '<\\/style')}
</style>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`;
writeFileSync(join(dir, 'artifact.html'), page);
console.log(`artifact.html : ${(page.length / 1024).toFixed(0)} Ko (JS ${(js.length / 1024).toFixed(0)} Ko, CSS ${(css.length / 1024).toFixed(0)} Ko, ${files.length} fichiers incorporés)`);
