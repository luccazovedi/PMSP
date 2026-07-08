/**
 * Converte o HTML oficial do Planalto (data/fonte/del2848.htm) em JSON
 * estruturado (data/codigo-penal.json).
 *
 * Princípio: nenhum dado fica de fora. O parser preserva:
 *  - todos os dispositivos vigentes (caput, parágrafos, incisos, alíneas, penas);
 *  - as rubricas (nomes marginais, ex.: "Homicídio simples");
 *  - as redações históricas riscadas no original (marcadas como "historico");
 *  - todas as anotações do Planalto: "(Redação dada pela...)", "(Incluído pela...)",
 *    "(Revogado pela...)", "(Vide...)", "(Vigência)" etc., com seus links;
 *  - a hierarquia completa: Parte > Título > Capítulo > Seção;
 *  - preâmbulo, fecho (data e assinaturas) e observações de publicação.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTE = path.join(__dirname, '..', 'data', 'fonte', 'del2848.htm');
const SAIDA = path.join(__dirname, '..', 'data', 'codigo-penal.json');
const URL_FONTE = 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848.htm';

// ---------------------------------------------------------------------------
// Leitura e decodificação (o Planalto serve em windows-1252)
// ---------------------------------------------------------------------------

const bruto = fs.readFileSync(FONTE);
let html;
try {
  html = new TextDecoder('windows-1252').decode(bruto);
} catch {
  html = bruto.toString('latin1');
}
html = html
  .replace(/\r\n?/g, '\n')
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ');

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

const ENTIDADES = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&aacute;': 'á', '&eacute;': 'é', '&iacute;': 'í', '&oacute;': 'ó', '&uacute;': 'ú',
  '&atilde;': 'ã', '&otilde;': 'õ', '&acirc;': 'â', '&ecirc;': 'ê', '&ocirc;': 'ô',
  '&agrave;': 'à', '&ccedil;': 'ç', '&sect;': '§', '&ordm;': 'º', '&ordf;': 'ª',
  '&Aacute;': 'Á', '&Eacute;': 'É', '&Iacute;': 'Í', '&Oacute;': 'Ó', '&Uacute;': 'Ú',
  '&Atilde;': 'Ã', '&Otilde;': 'Õ', '&Acirc;': 'Â', '&Ecirc;': 'Ê', '&Ocirc;': 'Ô',
  '&Agrave;': 'À', '&Ccedil;': 'Ç', '&deg;': '°', '&middot;': '·', '&shy;': '',
};

function decodificarEntidades(s) {
  return s
    .replace(/&[a-zA-Z]+;/g, (e) => ENTIDADES[e] ?? e)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function limparEspacos(s) {
  // Remove também "<"/">" órfãos deixados por tags malformadas do Planalto
  return s.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Tokenização em blocos (<p> e <li> são as unidades de texto do documento)
// ---------------------------------------------------------------------------

// Recorta o corpo útil: do preâmbulo até a observação de publicação.
const posPreambulo = html.search(/O\s+PRESIDENTE\s+DA\s+REP[ÚU]BLICA/i);
if (posPreambulo === -1) throw new Error('Preâmbulo não encontrado — o HTML da fonte mudou?');
// Recua até a tag <p> que abre o parágrafo do preâmbulo
const inicioCorpo = Math.max(0, html.toLowerCase().lastIndexOf('<p', posPreambulo));

// Blocos: cada ocorrência de <p ...> ou <li ...> abre um bloco que vai até o
// próximo <p/<li (o HTML do Planalto não fecha tags de forma confiável).
const reBloco = /<(p|li)\b[^>]*>/gi;
reBloco.lastIndex = inicioCorpo;

const blocosBrutos = [];
let m;
let anterior = null;
while ((m = reBloco.exec(html)) !== null) {
  if (anterior) blocosBrutos.push({ tag: anterior.tag, abre: anterior.abre, html: html.slice(anterior.fim, m.index) });
  anterior = { tag: m[1].toLowerCase(), abre: m[0], fim: reBloco.lastIndex };
}
if (anterior) blocosBrutos.push({ tag: anterior.tag, abre: anterior.abre, html: html.slice(anterior.fim) });

// ---------------------------------------------------------------------------
// Análise de cada bloco: texto vigente x riscado, anotações, âncoras, negrito
// ---------------------------------------------------------------------------

// Mantém estado de <strike>/<del> ENTRE blocos: o Planalto às vezes abre o
// riscado num bloco e fecha em outro.
let riscadoAberto = 0;

function analisarBloco(b) {
  const partes = b.html.split(/(<[^>]*>)/);
  let vigente = '';
  let riscado = '';
  let negrito = 0;
  let textoNegrito = '';
  const ancoras = [];
  const links = []; // {href, texto, riscado}
  let linkAtual = null;

  for (const parte of partes) {
    if (parte.startsWith('<')) {
      const tag = parte.toLowerCase();
      if (/^<(strike|del)\b/.test(tag)) riscadoAberto++;
      else if (/^<\/(strike|del)/.test(tag)) riscadoAberto = Math.max(0, riscadoAberto - 1);
      else if (/^<b\b|^<strong\b/.test(tag)) negrito++;
      else if (/^<\/(b|strong)/.test(tag)) negrito = Math.max(0, negrito - 1);
      else if (/^<a\b/.test(tag)) {
        const nome = tag.match(/name\s*=\s*"?([^"\s>]+)/);
        if (nome) ancoras.push(decodificarEntidades(nome[1]));
        const href = parte.match(/href\s*=\s*"?([^"\s>]+)/i);
        if (href) linkAtual = { href: decodificarEntidades(href[1]), texto: '', riscado: riscadoAberto > 0 };
      } else if (/^<\/a/.test(tag)) {
        if (linkAtual) { links.push(linkAtual); linkAtual = null; }
      } else if (/^<br/.test(tag)) {
        if (riscadoAberto > 0) riscado += ' '; else vigente += ' ';
        if (negrito > 0) textoNegrito += ' ';
        if (linkAtual) linkAtual.texto += ' ';
      }
      continue;
    }
    const texto = decodificarEntidades(parte);
    if (riscadoAberto > 0) riscado += texto; else vigente += texto;
    if (negrito > 0) textoNegrito += texto;
    if (linkAtual) linkAtual.texto += texto;
  }

  for (const l of links) l.texto = limparEspacos(l.texto);

  return {
    tag: b.tag,
    abre: b.abre,
    vigente: limparEspacos(vigente),
    riscado: limparEspacos(riscado),
    textoNegrito: limparEspacos(textoNegrito),
    ancoras,
    links: links.filter((l) => l.texto),
    centralizado: /align\s*=\s*"?center/i.test(b.abre),
  };
}

const blocos = blocosBrutos.map(analisarBloco);

// ---------------------------------------------------------------------------
// Separação de anotações do Planalto dentro do texto
// ---------------------------------------------------------------------------

const RE_ANOTACAO = /\(\s*(Reda[cç][aã]o dada|Reda[cç][aã]o do|Inclu[ií]d[oa]|Acrescentad[oa]|Revogad[oa]|Vide|Vig[êe]ncia|Renumerad[oa]|Restabelecid[oa]|Retificad[oa]|Regulamento|Promulga[cç][aã]o|Execu[cç][aã]o suspensa|Suprimid[oa]|Alterad[oa]|Express[aã]o|Dispositivo|Par[áa]grafo [úu]nico renumerado|Artigo renumerado|Caput renumerado)[^()]*\)/g;

/** Remove as anotações "(Redação dada pela...)" do texto e as devolve à parte. */
function separarAnotacoes(texto) {
  const notas = [];
  const limpo = limparEspacos(
    texto.replace(RE_ANOTACAO, (nota) => {
      notas.push(limparEspacos(nota));
      return ' ';
    }),
  );
  return { texto: limpo, notas };
}

// ---------------------------------------------------------------------------
// Classificação de dispositivos
// ---------------------------------------------------------------------------

// O sufixo de letra ("Art. 121-A") vem SEM espaço antes do hífen; com espaço
// ("Art. 10 - O tempo...") é o início do caput, não sufixo.
const RE_ARTIGO = /^Art\.?\s*(\d+)(?:\s*[ºo°])?(?:-([A-Z])(?![\wÀ-ÿ]))?\s*[-–—.]?\s*/;
const RE_PARAGRAFO = /^§\s*\d+[ºo°]?(?:\s*-?\s*[A-Z]\b)?|^Par[áa]grafo [úu]nico/;
const RE_INCISO = /^[IVXLCDM]+\s*[-–—]/;
const RE_ALINEA = /^[a-z]\s*\)/;
const RE_PENA = /^(Pena|Penas)\s*[-–—]/;
const RE_HIERARQUIA = /^(PARTE|LIVRO|T[ÍI]TULO|CAP[ÍI]TULO|SE[CÇ][CÇ]?[ÃA]O|DISPOSI[CÇ][ÕO]ES FINAIS)/i;

function tipoDispositivo(texto) {
  if (RE_PARAGRAFO.test(texto)) return 'paragrafo';
  if (RE_INCISO.test(texto)) return 'inciso';
  if (RE_ALINEA.test(texto)) return 'alinea';
  if (RE_PENA.test(texto)) return 'pena';
  return 'texto';
}

function chaveHierarquia(texto) {
  const t = texto.toUpperCase();
  if (t.startsWith('PARTE') || t.startsWith('DISPOSI')) return 'parte';
  if (t.startsWith('LIVRO')) return 'livro';
  if (t.startsWith('T')) return 'titulo';
  if (t.startsWith('CAP')) return 'capitulo';
  return 'secao';
}

// ---------------------------------------------------------------------------
// Varredura principal
// ---------------------------------------------------------------------------

const NIVEIS = ['parte', 'livro', 'titulo', 'capitulo', 'secao'];

const meta = {
  lei: 'Decreto-Lei nº 2.848, de 7 de dezembro de 1940',
  apelido: 'Código Penal',
  ementa: 'Código Penal.',
  fonte: URL_FONTE,
  fonteSha256: crypto.createHash('sha256').update(bruto).digest('hex'),
  geradoEm: new Date().toISOString(),
  notasGerais: [],
};

// "(Vide Lei ...)" do cabeçalho da página valem para a lei inteira
{
  const cabecalho = html.slice(0, inicioCorpo);
  const notas = cabecalho.match(RE_ANOTACAO) || [];
  meta.notasGerais = notas.map((n) => limparEspacos(decodificarEntidades(n.replace(/<[^>]*>/g, ' '))));
}

let preambulo = '';
const registros = []; // artigos em ordem de documento (vigentes e históricos)
const fecho = { texto: [], observacoes: [] };

const hierarquiaAtual = { parte: null, livro: null, titulo: null, capitulo: null, secao: null };
let registroAtual = null;
let rubricasPendentes = []; // rubricas vistas antes do próximo dispositivo
let aguardandoNomeDe = null; // nível de heading esperando a linha com o nome
let fimDoCodigo = false;

function novoRegistro(numero, situacaoInicial) {
  registroAtual = {
    numero,
    rotulo: `Art. ${numero}`,
    situacao: situacaoInicial, // ajustada no fim
    rubricas: [],
    dispositivos: [],
    hierarquia: Object.fromEntries(
      NIVEIS.filter((n) => hierarquiaAtual[n]).map((n) => [n, hierarquiaAtual[n]]),
    ),
  };
  registros.push(registroAtual);
}

function empurrarDispositivo(disp) {
  if (!registroAtual) return; // texto antes do 1º artigo vai para o preâmbulo
  registroAtual.dispositivos.push(disp);
}

for (const bloco of blocos) {
  const temVigente = bloco.vigente.length > 0;
  const temRiscado = bloco.riscado.length > 0;
  if (!temVigente && !temRiscado) continue;

  // ---- fecho e observações finais -----------------------------------------
  if (fimDoCodigo) {
    const t = limparEspacos(bloco.vigente || bloco.riscado);
    if (t && !/^\*+$/.test(t)) fecho.observacoes.push(t);
    continue;
  }

  // ---- cabeçalhos de hierarquia (apenas os vigentes contam) ----------------
  if (temVigente && !temRiscado && RE_HIERARQUIA.test(bloco.vigente) && bloco.centralizado) {
    const { texto, notas } = separarAnotacoes(bloco.vigente);
    const nivel = chaveHierarquia(texto);
    // "TÍTULO I" sozinho ou "TÍTULO I DA APLICAÇÃO DA LEI PENAL" na mesma linha
    const rotuloMatch = texto.match(/^(PARTE\s+\w+|LIVRO\s+[IVXLC]+|T[ÍI]TULO\s+[IVXLC]+|CAP[ÍI]TULO\s+[IVXLC]+|SE[CÇ][CÇ]?[ÃA]O\s+[IVXLC]+|DISPOSI[CÇ][ÕO]ES FINAIS|PARTE GERAL|PARTE ESPECIAL)/i);
    const rotulo = rotuloMatch ? limparEspacos(rotuloMatch[0]) : texto;
    const resto = limparEspacos(texto.slice(rotulo.length));

    hierarquiaAtual[nivel] = { rotulo, nome: resto || null, notas };
    // Zera níveis abaixo
    for (const n of NIVEIS.slice(NIVEIS.indexOf(nivel) + 1)) hierarquiaAtual[n] = null;
    aguardandoNomeDe = resto ? null : nivel;
    continue;
  }

  // Nome do título/capítulo na linha centralizada seguinte (todo em maiúsculas,
  // ignorando as anotações, que vêm em minúsculas)
  if (aguardandoNomeDe && temVigente && !temRiscado && bloco.centralizado && !RE_ARTIGO.test(bloco.vigente)) {
    const { texto, notas } = separarAnotacoes(bloco.vigente);
    if (texto && texto === texto.toUpperCase()) {
      hierarquiaAtual[aguardandoNomeDe].nome = texto;
      hierarquiaAtual[aguardandoNomeDe].notas.push(...notas);
      aguardandoNomeDe = null;
      continue;
    }
  }
  if (temVigente) aguardandoNomeDe = null;

  // ---- preâmbulo -----------------------------------------------------------
  if (!registroAtual && registros.length === 0 && temVigente && /PRESIDENTE DA REP/i.test(bloco.vigente)) {
    preambulo = separarAnotacoes(bloco.vigente).texto;
    continue;
  }

  // ---- processa vigente e riscado separadamente ----------------------------
  // Caso comum no Planalto: artigo inteiro riscado com a nota "(Revogado pela
  // Lei X)" fora do riscado. A nota deve acompanhar o registro criado pelo
  // texto riscado, não o artigo anterior.
  let notasParaProximoRegistro = null;

  for (const [conteudo, situacao] of [
    [bloco.vigente, 'vigente'],
    [bloco.riscado, 'historico'],
  ]) {
    if (!conteudo) continue;
    const { texto, notas } = separarAnotacoes(conteudo);
    if (!texto && notas.length === 0) continue;

    if (situacao === 'vigente' && !texto && notas.length && bloco.riscado &&
        RE_ARTIGO.test(separarAnotacoes(bloco.riscado).texto)) {
      notasParaProximoRegistro = notas;
      continue;
    }

    // Fecho do decreto
    if (/^Rio de Janeiro,\s*7 de dezembro de 1940/i.test(texto)) {
      fimDoCodigo = true;
      fecho.texto.push(texto);
      continue;
    }

    // Novo artigo?
    const mArt = texto.match(RE_ARTIGO);
    if (mArt) {
      const numero = mArt[2] ? `${mArt[1]}-${mArt[2]}` : mArt[1];
      const caput = limparEspacos(texto.slice(mArt[0].length));
      // Continua no mesmo registro se for outra versão do mesmo artigo,
      // desde que adjacente (evita fundir o art. 1º de 1940 com o atual).
      const mesmoArtigo = registroAtual && registroAtual.numero === numero;
      if (!mesmoArtigo) novoRegistro(numero, situacao);
      if (rubricasPendentes.length) {
        for (const r of rubricasPendentes) {
          registroAtual.dispositivos.push(r.disp);
          if (r.disp.situacao === 'vigente') registroAtual.rubricas.push(r.disp.texto);
        }
        rubricasPendentes = [];
      }
      empurrarDispositivo({
        tipo: 'caput',
        situacao,
        texto: caput || texto,
        notas,
        ancoras: bloco.ancoras,
        links: bloco.links.filter((l) => l.href && !l.texto.startsWith('(')).map((l) => l.href),
      });
      continue;
    }

    // Rubrica (nome marginal em negrito, não centralizado, sem cara de dispositivo)
    const ehRubrica =
      bloco.textoNegrito &&
      limparEspacos(separarAnotacoes(bloco.textoNegrito).texto) === texto &&
      !bloco.centralizado &&
      !RE_PARAGRAFO.test(texto) && !RE_INCISO.test(texto) &&
      !RE_ALINEA.test(texto) && !RE_PENA.test(texto) &&
      texto.length < 200;

    if (ehRubrica && texto) {
      rubricasPendentes.push({ disp: { tipo: 'rubrica', situacao, texto, notas } });
      continue;
    }

    // Dispositivo comum do artigo corrente
    if (rubricasPendentes.length && registroAtual) {
      // Rubrica seguida de parágrafo/inciso do mesmo artigo (ex.: "Homicídio qualificado")
      for (const r of rubricasPendentes) {
        registroAtual.dispositivos.push(r.disp);
        if (r.disp.situacao === 'vigente') registroAtual.rubricas.push(r.disp.texto);
      }
      rubricasPendentes = [];
    }
    if (texto || notas.length) {
      empurrarDispositivo({ tipo: tipoDispositivo(texto), situacao, texto, notas, ancoras: bloco.ancoras });
    }
  }

  // Nota de revogação que pertence ao registro recém-criado pelo texto riscado
  if (notasParaProximoRegistro && registroAtual) {
    empurrarDispositivo({ tipo: 'anotacao', situacao: 'vigente', texto: '', notas: notasParaProximoRegistro });
  }
}

// ---------------------------------------------------------------------------
// Consolidação: separa registros históricos (1940) dos vigentes
// ---------------------------------------------------------------------------

function registroTemVigencia(r) {
  return r.dispositivos.some((d) => d.situacao === 'vigente');
}

const vigentes = new Map();
const historicosSemVigente = [];

for (const r of registros) {
  if (registroTemVigencia(r)) {
    if (vigentes.has(r.numero)) {
      // mesma numeração vigente duas vezes: funde (não deve ocorrer, mas não perde dado)
      vigentes.get(r.numero).dispositivos.push(...r.dispositivos);
    } else {
      vigentes.set(r.numero, r);
    }
  }
}
for (const r of registros) {
  if (registroTemVigencia(r)) continue;
  const alvo = vigentes.get(r.numero);
  if (alvo) {
    alvo.versoesAnteriores = alvo.versoesAnteriores || [];
    alvo.versoesAnteriores.push(...r.dispositivos);
  } else {
    historicosSemVigente.push(r);
  }
}

const artigos = [...vigentes.values()];

// Situação final: "revogado" quando não sobrou texto normativo vigente
for (const a of artigos) {
  const dispVigentes = a.dispositivos.filter((d) => d.situacao === 'vigente' && d.tipo !== 'rubrica');
  const soRevogacao = dispVigentes.every(
    (d) => !d.texto || /^\(?\s*(revogad|vetado)/i.test(d.texto) || d.notas.some((n) => /revogad/i.test(n)),
  );
  const notaRevogacao = dispVigentes.some((d) => d.notas.some((n) => /revogad/i.test(n)) || /revogad/i.test(d.texto));
  a.situacao = soRevogacao && notaRevogacao ? 'revogado' : 'vigente';

  // Texto pesquisável: tudo que está em vigor + rubricas + notas
  const pedacos = [];
  for (const d of a.dispositivos) {
    if (d.situacao !== 'vigente') continue;
    if (d.texto) pedacos.push(d.tipo === 'caput' ? `${a.rotulo} ${d.texto}` : d.texto);
    pedacos.push(...d.notas);
  }
  a.texto = pedacos.join('\n');
  // Texto histórico pesquisável (redações antigas riscadas)
  const antigos = [];
  for (const d of [...a.dispositivos, ...(a.versoesAnteriores || [])]) {
    if (d.situacao !== 'historico') continue;
    if (d.texto) antigos.push(d.texto);
    antigos.push(...d.notas);
  }
  a.textoHistorico = antigos.join('\n');
  a.caput = (a.dispositivos.find((d) => d.tipo === 'caput' && d.situacao === 'vigente') || {}).texto || null;
}

// Registros que só existem riscados (numerações que nunca voltaram a vigorar)
for (const r of historicosSemVigente) {
  r.situacao = 'historico';
  r.texto = '';
  r.caput = null;
  r.textoHistorico = r.dispositivos.map((d) => [d.texto, ...d.notas].filter(Boolean).join(' ')).join('\n');
  artigos.push(r);
}

// Ordena por posição original do documento? Mantém ordem: vigentes já estão em
// ordem de aparição; históricos órfãos vão ao fim com marcação clara.

// ---------------------------------------------------------------------------
// Estrutura hierárquica
// ---------------------------------------------------------------------------

const estrutura = { tipo: 'lei', nome: meta.apelido, filhos: [], artigos: [] };

function acharOuCriar(lista, no) {
  const achado = lista.find((f) => f.rotulo === no.rotulo && f.nome === no.nome);
  if (achado) return achado;
  const criado = { ...no, filhos: [], artigos: [] };
  lista.push(criado);
  return criado;
}

for (const a of artigos) {
  if (a.situacao === 'historico') continue;
  let nivel = estrutura;
  for (const n of NIVEIS) {
    const h = a.hierarquia[n];
    if (!h) continue;
    nivel = acharOuCriar(nivel.filhos, { tipo: n, rotulo: h.rotulo, nome: h.nome });
  }
  nivel.artigos.push(a.numero);
}

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------

const saida = {
  meta,
  preambulo,
  estrutura,
  artigos,
  fecho,
};

fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
fs.writeFileSync(SAIDA, JSON.stringify(saida, null, 1), 'utf8');

const nVigentes = artigos.filter((a) => a.situacao === 'vigente').length;
const nRevogados = artigos.filter((a) => a.situacao === 'revogado').length;
const nHistoricos = artigos.filter((a) => a.situacao === 'historico').length;
console.log(`OK: ${artigos.length} artigos gravados em ${path.relative(process.cwd(), SAIDA)}`);
console.log(`    vigentes: ${nVigentes} | revogados: ${nRevogados} | apenas históricos: ${nHistoricos}`);
