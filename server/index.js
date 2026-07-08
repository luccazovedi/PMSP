import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarConsulta } from '../lib/consulta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');

const lei = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'codigo-penal.json'), 'utf8'));
const consulta = criarConsulta(lei);

const app = express();

// CORS liberado: a API é de dados públicos
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  next();
});

// Aceita também as URLs da versão estática (GitHub Pages): /api/lei.json etc.
app.use('/api', (req, res, next) => {
  req.url = req.url.replace(/\.json(?=$|\?)/, '');
  if (req.url === '/index') req.url = '/';
  next();
});

// ---------------------------------------------------------------------------
// Rotas da API
// ---------------------------------------------------------------------------

const descricao = {
  nome: 'API do Código Penal Brasileiro',
  lei: lei.meta,
  totalArtigos: lei.artigos.length,
  rotas: {
    'GET /api': 'Esta descrição',
    'GET /api/lei': 'Metadados, preâmbulo e fecho da lei',
    'GET /api/estrutura': 'Árvore hierárquica (partes, títulos, capítulos, seções) com os números dos artigos',
    'GET /api/artigos': 'Lista completa de artigos (aceita ?limit e ?offset)',
    'GET /api/artigos/:numero': 'Um artigo pelo número (ex.: 121, 121-A, art-121)',
    'GET /api/busca?q=termo': 'Busca full-text por palavra/expressão, ou por número de artigo',
  },
};

app.get('/api', (req, res) => res.json(descricao));

app.get('/api/lei', (req, res) => {
  res.json({ meta: lei.meta, preambulo: lei.preambulo, fecho: lei.fecho });
});

app.get('/api/estrutura', (req, res) => {
  res.json(lei.estrutura);
});

app.get('/api/artigos', (req, res) => {
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || lei.artigos.length));
  res.json({
    total: lei.artigos.length,
    offset,
    limit,
    artigos: lei.artigos.slice(offset, offset + limit),
  });
});

app.get('/api/artigos/:numero', (req, res) => {
  const artigo = consulta.artigo(req.params.numero);
  if (!artigo) {
    return res.status(404).json({ erro: `Artigo "${req.params.numero}" não encontrado` });
  }
  res.json(artigo);
});

app.get('/api/busca', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ erro: 'Informe o parâmetro ?q= com o termo ou número do artigo' });
  }
  res.json(consulta.buscar(q));
});

// ---------------------------------------------------------------------------
// Landing page e arquivos estáticos (mesmos caminhos relativos do GitHub Pages)
// ---------------------------------------------------------------------------
app.use(express.static(path.join(RAIZ, 'public')));
app.use('/lib', express.static(path.join(RAIZ, 'lib')));
app.use('/data', express.static(path.join(RAIZ, 'data')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Código Penal API no ar: http://localhost:${PORT}`);
  console.log(`Landing page:          http://localhost:${PORT}/`);
  console.log(`Documentação da API:   http://localhost:${PORT}/api`);
});
