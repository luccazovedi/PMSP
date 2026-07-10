/**
 * Gera a versão estática do site em docs/ para publicação no GitHub Pages.
 *
 * O GitHub Pages não roda servidor, então:
 *  - a landing page (public/) busca no navegador, sobre data/<lei>.json;
 *  - a "API" vira arquivos JSON pré-gerados por lei: api/<lei>/lei.json,
 *    api/<lei>/estrutura.json, api/<lei>/artigos.json e
 *    api/<lei>/artigos/<numero>.json — as mesmas respostas do servidor
 *    Express, menos /busca (que no Pages acontece no cliente).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');
const SITE = path.join(RAIZ, 'docs');

const LEIS = {
  cp: { arquivo: 'codigo-penal.json' },
  ctb: { arquivo: 'ctb.json' },
};

fs.rmSync(SITE, { recursive: true, force: true });
fs.mkdirSync(SITE, { recursive: true });

// Landing page e lógica de consulta compartilhada
fs.cpSync(path.join(RAIZ, 'public'), SITE, { recursive: true });
fs.cpSync(path.join(RAIZ, 'lib'), path.join(SITE, 'lib'), { recursive: true });
fs.mkdirSync(path.join(SITE, 'data'), { recursive: true });

const indice = {
  nome: 'API estática de Legislação (GitHub Pages)',
  leis: {},
  rotas: {
    'GET api/index.json': 'Esta descrição',
    'GET api/<lei>/lei.json': 'Metadados, preâmbulo, fecho e anexos (lei = cp | ctb)',
    'GET api/<lei>/estrutura.json': 'Árvore hierárquica com os números dos artigos',
    'GET api/<lei>/artigos.json': 'Lista completa de artigos',
    'GET api/<lei>/artigos/<numero>.json': 'Um artigo pelo número (ex.: 121.json, 165-A.json, ANEXO-I.json)',
    busca: 'No site estático a busca roda no navegador; para busca via HTTP use o servidor Node (npm start)',
  },
};

let totalArquivos = 0;
for (const [id, cfg] of Object.entries(LEIS)) {
  const lei = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', cfg.arquivo), 'utf8'));

  // Dados completos (compactados: o Pages serve com gzip)
  fs.writeFileSync(path.join(SITE, 'data', cfg.arquivo), JSON.stringify(lei));

  const api = path.join(SITE, 'api', id);
  fs.mkdirSync(path.join(api, 'artigos'), { recursive: true });
  const gravar = (arquivo, dados) => fs.writeFileSync(path.join(api, arquivo), JSON.stringify(dados));

  gravar('lei.json', { meta: lei.meta, preambulo: lei.preambulo, fecho: lei.fecho, anexos: lei.anexos || [] });
  gravar('estrutura.json', lei.estrutura);
  gravar('artigos.json', { total: lei.artigos.length, offset: 0, limit: lei.artigos.length, artigos: lei.artigos });
  for (const artigo of lei.artigos) {
    gravar(path.join('artigos', `${artigo.numero}.json`), artigo);
  }

  indice.leis[id] = { ...lei.meta, totalArtigos: lei.artigos.length };
  totalArquivos += lei.artigos.length;
}

fs.writeFileSync(path.join(SITE, 'api', 'index.json'), JSON.stringify(indice));

// Evita o processamento Jekyll do Pages
fs.writeFileSync(path.join(SITE, '.nojekyll'), '');

console.log(`OK: site estático gerado em docs/ (${totalArquivos} artigos nas ${Object.keys(LEIS).length} leis).`);
