/**
 * Converte a Tabela de Códigos de Infrações RENAINF (SENATRAN/gov.br,
 * data/fonte/renainf.xlsx) em data/enquadramentos-ctb.json, agrupada por
 * artigo do CTB. São os códigos de enquadramento usados no auto de infração,
 * com infrator, gravidade (pontos e multiplicador) e órgão competente.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');
const FONTE = path.join(RAIZ, 'data', 'fonte', 'renainf.xlsx');
const SAIDA = path.join(RAIZ, 'data', 'enquadramentos-ctb.json');

const bruto = fs.readFileSync(FONTE);
const wb = XLSX.read(bruto);
const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

const limpar = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

// "7 - Gravíss 3X" -> { natureza: 'Gravíssima', pontos: 7, fator: 3 }
function parseGravidade(texto) {
  const t = limpar(texto);
  if (!t || t === '---') return null;
  const pontos = (t.match(/^(\d+)/) || [])[1];
  const fator = (t.match(/(\d+)\s*x/i) || [])[1];
  const natureza =
    /grav[íi]ss/i.test(t) ? 'Gravíssima' :
    /grave/i.test(t) ? 'Grave' :
    /m[ée]d/i.test(t) ? 'Média' :
    /leve/i.test(t) ? 'Leve' : t;
  const PONTOS = { 'Gravíssima': 7, Grave: 5, 'Média': 4, Leve: 3 };
  return {
    natureza,
    pontos: pontos ? Number(pontos) : (PONTOS[natureza] ?? null),
    fator: fator ? Number(fator) : 1,
  };
}

const porArtigo = {};
let total = 0;

for (const linha of linhas.slice(1)) {
  const [codigo, desdobramento, descricao, amparo, infrator, gravidade, competencia] = linha;
  if (!codigo || !descricao) continue;
  const amparoTexto = limpar(amparo);
  const mArt = amparoTexto.match(/^(\d+)(?:\s*-\s*([A-Z]))?/);
  if (!mArt) continue;
  const numero = mArt[2] ? `${mArt[1]}-${mArt[2]}` : mArt[1];

  const g = parseGravidade(gravidade);
  (porArtigo[numero] = porArtigo[numero] || []).push({
    codigo: `${limpar(codigo)}-${limpar(desdobramento) || '0'}`,
    descricao: limpar(descricao),
    amparo: `art. ${amparoTexto}`,
    infrator: limpar(infrator) || null,
    gravidade: g ? `${g.natureza}${g.fator > 1 ? ` ×${g.fator}` : ''}` : null,
    pontos: g ? g.pontos : null,
    fator: g ? g.fator : null,
    competencia: limpar(competencia) || null,
  });
  total++;
}

const saida = {
  meta: {
    fonte: 'https://www.gov.br/transportes/pt-br/centrais-de-conteudo/tabela-codigo-infracoes-renainf-xlsx',
    descricao: 'Tabela de Códigos de Infrações RENAINF (SENATRAN) — enquadramentos do auto de infração',
    fonteSha256: crypto.createHash('sha256').update(bruto).digest('hex'),
    geradoEm: new Date().toISOString(),
    total,
  },
  porArtigo,
};

fs.writeFileSync(SAIDA, JSON.stringify(saida, null, 1), 'utf8');
console.log(`OK: ${total} enquadramentos de ${Object.keys(porArtigo).length} artigos -> data/enquadramentos-ctb.json`);
