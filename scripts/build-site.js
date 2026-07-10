/**
 * Gera a versão estática do site em docs/ para publicação no GitHub Pages.
 *
 * O GitHub Pages não roda servidor, então:
 *  - a landing page (public/) busca no navegador, sobre data/codigo-penal.json;
 *  - a "API" vira arquivos JSON pré-gerados: api/lei.json, api/estrutura.json,
 *    api/artigos.json e api/artigos/<numero>.json — as mesmas respostas que o
 *    servidor Express dá, menos /api/busca (que no Pages acontece no cliente).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');
const SITE = path.join(RAIZ, 'docs');

const lei = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'codigo-penal.json'), 'utf8'));

fs.rmSync(SITE, { recursive: true, force: true });
fs.mkdirSync(SITE, { recursive: true });

// Landing page e lógica de consulta compartilhada
fs.cpSync(path.join(RAIZ, 'public'), SITE, { recursive: true });
fs.cpSync(path.join(RAIZ, 'lib'), path.join(SITE, 'lib'), { recursive: true });

// Dados completos (compactados: o Pages serve com gzip)
fs.mkdirSync(path.join(SITE, 'data'), { recursive: true });
fs.writeFileSync(path.join(SITE, 'data', 'codigo-penal.json'), JSON.stringify(lei));

// "API" estática
const api = path.join(SITE, 'api');
fs.mkdirSync(path.join(api, 'artigos'), { recursive: true });

const gravar = (arquivo, dados) =>
  fs.writeFileSync(path.join(api, arquivo), JSON.stringify(dados));

gravar('index.json', {
  nome: 'API estática do Código Penal Brasileiro (GitHub Pages)',
  lei: lei.meta,
  totalArtigos: lei.artigos.length,
  rotas: {
    'GET api/index.json': 'Esta descrição',
    'GET api/lei.json': 'Metadados, preâmbulo e fecho da lei',
    'GET api/estrutura.json': 'Árvore hierárquica com os números dos artigos',
    'GET api/artigos.json': 'Lista completa de artigos',
    'GET api/artigos/<numero>.json': 'Um artigo pelo número (ex.: 121.json, 121-A.json)',
    busca: 'No site estático a busca por palavra roda no navegador; para busca via HTTP use o servidor Node (npm start)',
  },
});

gravar('lei.json', { meta: lei.meta, preambulo: lei.preambulo, fecho: lei.fecho });
gravar('estrutura.json', lei.estrutura);
gravar('artigos.json', {
  total: lei.artigos.length,
  offset: 0,
  limit: lei.artigos.length,
  artigos: lei.artigos,
});

for (const artigo of lei.artigos) {
  gravar(path.join('artigos', `${artigo.numero}.json`), artigo);
}

// Evita o processamento Jekyll do Pages
fs.writeFileSync(path.join(SITE, '.nojekyll'), '');

const total = fs.readdirSync(path.join(api, 'artigos')).length;
console.log(`OK: site estático gerado em docs/ (${total} artigos na API estática).`);
