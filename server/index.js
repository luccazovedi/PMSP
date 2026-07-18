import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarConsulta } from '../lib/consulta.js';
import { REGISTRO_LEIS } from '../lib/leis.js';
import { PALAVRAS_CHAVE } from '../lib/palavras-chave.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');

const LEIS = Object.fromEntries(
  Object.entries(REGISTRO_LEIS).map(([id, cfg]) => [id, { ...cfg }]),
);

for (const [id, cfg] of Object.entries(LEIS)) {
  cfg.dados = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', cfg.arquivo), 'utf8'));
  cfg.consulta = criarConsulta(cfg.dados, PALAVRAS_CHAVE[id] || {});
}

const app = express();

// CORS liberado: a API é de dados públicos
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  next();
});

// Normaliza URLs: aceita os caminhos da versão estática (".json") e as rotas
// antigas sem o prefixo da lei (ex.: /api/artigos/121 -> /api/cp/artigos/121)
app.use('/api', (req, res, next) => {
  req.url = req.url.replace(/\.json(?=$|\?)/, '');
  if (req.url === '/index') req.url = '/';
  const primeiro = req.url.split('/')[1];
  if (primeiro && primeiro !== '' && !LEIS[primeiro]) {
    req.url = '/cp' + req.url;
  }
  next();
});

// ---------------------------------------------------------------------------
// Rotas da API
// ---------------------------------------------------------------------------

app.get('/api', (req, res) => {
  res.json({
    nome: 'API de Legislação — CP, CPP, CPM, CTB e RDPM da PMESP',
    leis: Object.fromEntries(
      Object.entries(LEIS).map(([id, cfg]) => [id, { ...cfg.dados.meta, totalArtigos: cfg.dados.artigos.length }]),
    ),
    rotas: {
      'GET /api': 'Esta descrição',
      'GET /api/:lei/lei': 'Metadados, preâmbulo, fecho e anexos (lei = cp | cpp | cpm | ctb | rdpm)',
      'GET /api/:lei/estrutura': 'Árvore hierárquica com os números dos artigos',
      'GET /api/:lei/artigos': 'Lista completa de artigos (aceita ?limit e ?offset)',
      'GET /api/:lei/artigos/:numero': 'Um artigo pelo número (ex.: 121, 165-A, anexo-i)',
      'GET /api/:lei/busca?q=termo': 'Busca full-text por palavra/expressão, ou por número de artigo',
      compatibilidade: 'Rotas sem o prefixo da lei respondem pelo Código Penal (ex.: /api/artigos/121)',
    },
  });
});

function comLei(handler) {
  return (req, res) => {
    const cfg = LEIS[req.params.lei];
    if (!cfg) return res.status(404).json({ erro: `Lei "${req.params.lei}" desconhecida. Use: ${Object.keys(LEIS).join(', ')}` });
    handler(cfg, req, res);
  };
}

app.get('/api/:lei', comLei((cfg, req, res) => {
  res.json({ meta: cfg.dados.meta, totalArtigos: cfg.dados.artigos.length });
}));

app.get('/api/:lei/lei', comLei((cfg, req, res) => {
  res.json({
    meta: cfg.dados.meta,
    preambulo: cfg.dados.preambulo,
    fecho: cfg.dados.fecho,
    anexos: cfg.dados.anexos || [],
  });
}));

app.get('/api/:lei/estrutura', comLei((cfg, req, res) => {
  res.json(cfg.dados.estrutura);
}));

app.get('/api/:lei/artigos', comLei((cfg, req, res) => {
  const artigos = cfg.dados.artigos;
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || artigos.length));
  res.json({ total: artigos.length, offset, limit, artigos: artigos.slice(offset, offset + limit) });
}));

app.get('/api/:lei/artigos/:numero', comLei((cfg, req, res) => {
  const artigo = cfg.consulta.artigo(req.params.numero);
  if (!artigo) {
    return res.status(404).json({ erro: `Artigo "${req.params.numero}" não encontrado` });
  }
  res.json(artigo);
}));

app.get('/api/:lei/busca', comLei((cfg, req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ erro: 'Informe o parâmetro ?q= com o termo ou número do artigo' });
  }
  res.json(cfg.consulta.buscar(q));
}));

app.get('/api/:lei/sugestoes', comLei((cfg, req, res) => {
  const q = String(req.query.q || '').trim();
  res.json({ consulta: q, sugestoes: cfg.consulta.sugerir(q, Math.min(20, parseInt(req.query.limit, 10) || 8)) });
}));

// ---------------------------------------------------------------------------
// Landing page e arquivos estáticos (mesmos caminhos relativos do GitHub Pages)
// ---------------------------------------------------------------------------
app.use(express.static(path.join(RAIZ, 'public')));
app.use('/lib', express.static(path.join(RAIZ, 'lib')));
app.use('/data', express.static(path.join(RAIZ, 'data')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Legislação API no ar:  http://localhost:${PORT}`);
  console.log(`Landing page:          http://localhost:${PORT}/`);
  console.log(`Documentação da API:   http://localhost:${PORT}/api`);
});
