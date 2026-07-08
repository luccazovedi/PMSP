import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'data', 'codigo-penal.json');

const lei = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

// Remove acentos e normaliza caixa para busca insensível a acentuação
function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Normaliza um número de artigo digitado pelo usuário: "121", "art 121",
// "Art. 121-A", "121a", "1º" etc. -> chave canônica como "121" ou "121-A"
function chaveArtigo(entrada) {
  let s = normalizar(String(entrada))
    .replace(/^art(igo)?\.?\s*/i, '')
    .replace(/[ºo°]\s*$/, '')
    .trim();
  const m = s.match(/^(\d+)\s*[-.\s]?\s*([a-z])?$/i);
  if (!m) return null;
  return m[2] ? `${m[1]}-${m[2].toUpperCase()}` : m[1];
}

// Índice por número de artigo
const porNumero = new Map();
for (const artigo of lei.artigos) {
  porNumero.set(artigo.numero.toUpperCase(), artigo);
}

// Texto normalizado pré-computado para busca
const indiceBusca = lei.artigos.map((artigo) => ({
  artigo,
  textoNorm: normalizar(artigo.texto),
  rubricasNorm: normalizar(artigo.rubricas.join(' ')),
}));

const app = express();
app.use(express.json());

// CORS liberado: a API é de dados públicos
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  next();
});

// ---------------------------------------------------------------------------
// Rotas da API
// ---------------------------------------------------------------------------

app.get('/api', (req, res) => {
  res.json({
    nome: 'API do Código Penal Brasileiro',
    lei: lei.meta,
    totalArtigos: lei.artigos.length,
    rotas: {
      'GET /api': 'Esta descrição',
      'GET /api/lei': 'Metadados, preâmbulo e fecho da lei',
      'GET /api/estrutura': 'Árvore hierárquica (partes, títulos, capítulos, seções) com os números dos artigos',
      'GET /api/artigos': 'Lista completa de artigos (aceita ?limit e ?offset)',
      'GET /api/artigos/:numero': 'Um artigo pelo número (ex.: 121, 121-A, art-155)',
      'GET /api/busca?q=termo': 'Busca full-text por palavra/expressão, ou por número de artigo',
    },
  });
});

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
  const chave = chaveArtigo(req.params.numero);
  const artigo = chave && porNumero.get(chave);
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

  // 1) Se a consulta parece um número de artigo, devolve o artigo direto
  const chave = chaveArtigo(q);
  if (chave && porNumero.has(chave)) {
    return res.json({ tipo: 'artigo', consulta: q, total: 1, resultados: [porNumero.get(chave)] });
  }

  // 2) Busca full-text (insensível a acentos e caixa)
  const termo = normalizar(q);
  const resultados = [];
  for (const { artigo, textoNorm, rubricasNorm } of indiceBusca) {
    const emRubrica = rubricasNorm.includes(termo);
    const posicao = textoNorm.indexOf(termo);
    if (!emRubrica && posicao === -1) continue;

    // Trechos com destaque: até 3 ocorrências por artigo
    const trechos = [];
    let idx = posicao;
    while (idx !== -1 && trechos.length < 3) {
      const ini = Math.max(0, idx - 80);
      const fim = Math.min(artigo.texto.length, idx + termo.length + 80);
      trechos.push({
        trecho: (ini > 0 ? '…' : '') + artigo.texto.slice(ini, fim) + (fim < artigo.texto.length ? '…' : ''),
        posicao: idx,
      });
      idx = textoNorm.indexOf(termo, idx + termo.length);
    }

    resultados.push({
      numero: artigo.numero,
      rotulo: artigo.rotulo,
      rubricas: artigo.rubricas,
      hierarquia: artigo.hierarquia,
      ocorrencias: (textoNorm.match(new RegExp(termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length + (emRubrica ? 1 : 0),
      trechos,
    });
  }

  resultados.sort((a, b) => b.ocorrencias - a.ocorrencias);
  res.json({ tipo: 'texto', consulta: q, total: resultados.length, resultados });
});

// ---------------------------------------------------------------------------
// Landing page estática
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Código Penal API no ar: http://localhost:${PORT}`);
  console.log(`Landing page:          http://localhost:${PORT}/`);
  console.log(`Documentação da API:   http://localhost:${PORT}/api`);
});
