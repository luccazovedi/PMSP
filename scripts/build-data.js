/**
 * Converte o HTML oficial do Planalto em JSON estruturado, para cada lei
 * configurada em LEIS (Código Penal e Código de Trânsito Brasileiro).
 *
 * Princípio: nenhum dado fica de fora. O parser preserva:
 *  - todos os dispositivos vigentes (caput, parágrafos, incisos, alíneas, penas
 *    e, no CTB, infração/penalidade/medida administrativa);
 *  - as rubricas (nomes marginais, ex.: "Homicídio simples");
 *  - as redações históricas riscadas no original (marcadas como "historico");
 *  - todas as anotações do Planalto: "(Redação dada pela...)", "(Incluído pela...)",
 *    "(Revogado pela...)", "(Vide...)", "(Vigência)" etc.;
 *  - a hierarquia completa (Parte/Título/Capítulo/Seção, conforme a lei);
 *  - preâmbulo, fecho (data e assinaturas), observações e anexos.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');

export const LEIS = [
  {
    id: 'cp',
    arquivo: 'del2848.htm',
    saida: 'codigo-penal.json',
    url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848.htm',
    lei: 'Decreto-Lei nº 2.848, de 7 de dezembro de 1940',
    apelido: 'Código Penal',
    ementa: 'Código Penal.',
  },
  {
    id: 'ctb',
    arquivo: 'l9503.htm',
    saida: 'ctb.json',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l9503.htm',
    lei: 'Lei nº 9.503, de 23 de setembro de 1997',
    apelido: 'Código de Trânsito Brasileiro',
    ementa: 'Institui o Código de Trânsito Brasileiro.',
  },
  {
    id: 'cpp',
    arquivo: 'del3689.htm',
    saida: 'cpp.json',
    url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689.htm',
    lei: 'Decreto-Lei nº 3.689, de 3 de outubro de 1941',
    apelido: 'Código de Processo Penal',
    ementa: 'Código de Processo Penal.',
  },
  {
    id: 'rdpm',
    arquivo: 'lc893.html',
    saida: 'rdpm.json',
    url: 'https://www.al.sp.gov.br/repositorio/legislacao/lei.complementar/2001/lei.complementar-893-09.03.2001.html',
    lei: 'Lei Complementar nº 893, de 9 de março de 2001 (Estado de São Paulo)',
    apelido: 'RDPM — Regulamento Disciplinar da PMESP',
    ementa: 'Institui o Regulamento Disciplinar da Polícia Militar do Estado de São Paulo.',
    charset: 'utf-8',
    formato: 'alesp',
    rePreambulo: /O\s+GOVERNADOR\s+DO\s+ESTADO\s+DE\s+S[ÃA]O\s+PAULO/i,
  },
];

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
  '&uuml;': 'ü', '&Uuml;': 'Ü', '&euml;': 'ë', '&iuml;': 'ï', '&ouml;': 'ö', '&auml;': 'ä',
  '&ntilde;': 'ñ', '&Ntilde;': 'Ñ', '&ndash;': '–', '&mdash;': '—', '&hellip;': '…',
  '&lsquo;': '‘', '&rsquo;': '’', '&ldquo;': '“', '&rdquo;': '”',
  '&sup1;': '¹', '&sup2;': '²', '&sup3;': '³', '&frac12;': '½', '&apos;': "'",
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
// Expressões de classificação
// ---------------------------------------------------------------------------

const RE_ANOTACAO = /\(\s*(Reda[cç][aã]o dada|Reda[cç][aã]o do|Inclu[ií]d[oa]|Acrescentad[oa]|Revogad[oa]|Vide|Vig[êe]ncia|Renumerad[oa]|Restabelecid[oa]|Retificad[oa]|Regulamento|Promulga[cç][aã]o|Execu[cç][aã]o suspensa|Suprimid[oa]|Alterad[oa]|Express[aã]o|Dispositivo|Par[áa]grafo [úu]nico renumerado|Artigo renumerado|Caput renumerado)[^()]*\)/g;

// O sufixo de letra ("Art. 121-A") vem SEM espaço antes do hífen; com espaço
// ("Art. 10 - O tempo...") é o início do caput, não sufixo. A ALESP escreve
// "Artigo 13" por extenso.
const RE_ARTIGO = /^Art(?:igo)?\.?\s*(\d+)(?:\s*[ºo°ª])?(?:-([A-Z])(?![\wÀ-ÿ]))?\s*[-–—.]?\s*/;
const RE_PARAGRAFO = /^§\s*\d+[ºo°]?(?:\s*-?\s*[A-Z]\b)?|^Par[áa]grafo [úu]nico/;
const RE_INCISO = /^[IVXLCDM]+\s*[-–—]/;
const RE_ALINEA = /^[a-z]\s*\)/;
const RE_PENA = /^(Pena|Penas)\s*[-–—]/;
const RE_INFRACAO = /^Infra[cç][aã]o\s*[-–—]/;
const RE_PENALIDADE = /^Penalidade(s)?\s*[-–—]/;
const RE_MEDIDA_ADM = /^Medida(s)?\s+administrativa(s)?\s*[-–—]/i;
const RE_HIERARQUIA = /^(PARTE|LIVRO|T[ÍI]TULO|CAP[ÍI]TULO|SE[CÇ][CÇ]?[ÃA]O|DISPOSI[CÇ][ÕO]ES FINAIS)/i;
const RE_ROTULO_HIER = /^(PARTE\s+\w+|LIVRO\s+[IVXLC]+|T[ÍI]TULO\s+[IVXLC]+(?:-[A-Z])?|CAP[ÍI]TULO\s+[IVXLC]+(?:-[A-Z])?|SE[CÇ][CÇ]?[ÃA]O\s+[IVXLC]+(?:-[A-Z])?|DISPOSI[CÇ][ÕO]ES FINAIS|PARTE GERAL|PARTE ESPECIAL)/i;
const RE_FECHO = /^(?:(Rio de Janeiro|Bras[íi]lia)\s*,\s*(?:em\s+|aos\s+)?\d+[ºo°]?\s+de\s+\w+\s+de\s+\d{4}.*da\s+Rep[úu]blica\.?|Pal[áa]cio dos Bandeirantes\s*,\s*(?:aos\s+|em\s+)?\d+.*\d{4}\s*\.?)$/i;
const RE_ANEXO = /^ANEXO\s+([IVXLC]+|\d+)\b/i;

const RE_ITEM = /^\d+(?:\.\d+)*\s*[-–—]\s/; // transgressões numeradas do RDPM

function tipoDispositivo(texto) {
  if (RE_PARAGRAFO.test(texto)) return 'paragrafo';
  if (RE_INFRACAO.test(texto)) return 'infracao';
  if (RE_PENALIDADE.test(texto)) return 'penalidade';
  if (RE_MEDIDA_ADM.test(texto)) return 'medida-administrativa';
  if (RE_INCISO.test(texto)) return 'inciso';
  if (RE_ALINEA.test(texto)) return 'alinea';
  if (RE_PENA.test(texto)) return 'pena';
  if (RE_ITEM.test(texto)) return 'item';
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

const NIVEIS = ['parte', 'livro', 'titulo', 'capitulo', 'secao'];

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
// Parser de uma lei
// ---------------------------------------------------------------------------

/**
 * Normaliza o HTML da ALESP para as convenções que o parser espera:
 * cabeçalhos <h4> viram <p align="center"> (um por CAPÍTULO/SEÇÃO) e os
 * <br> que separam dispositivos dentro de um mesmo <p> viram novos blocos.
 */
function preprocessarAlesp(html) {
  html = decodificarEntidades(html.slice(Math.max(0, html.search(/<body/i))));

  html = html.replace(/<h\d[^>]*>([\s\S]*?)<\/h\d>/gi, (_, conteudo) => {
    const linhas = conteudo.split(/<br\s*\/?>/i);
    const blocos = [];
    for (const linha of linhas) {
      const texto = limparEspacos(linha.replace(/<[^>]*>/g, ' '));
      if (!texto) continue;
      // Um mesmo <h4> pode conter "CAPÍTULO II ... SEÇÃO I ...": cada rótulo
      // de hierarquia abre um bloco centralizado próprio
      if (blocos.length && RE_HIERARQUIA.test(texto)) {
        blocos.push(linha);
      } else if (blocos.length) {
        blocos[blocos.length - 1] += ' ' + linha;
      } else {
        blocos.push(linha);
      }
    }
    return blocos.map((b) => `<p align="center">${b}</p>`).join('\n');
  });

  return html.replace(/<br\s*\/?>/gi, '</p>\n<p>');
}

function parseLei(cfg) {
  const bruto = fs.readFileSync(path.join(RAIZ, 'data', 'fonte', cfg.arquivo));
  let html;
  if (cfg.charset === 'utf-8') {
    html = bruto.toString('utf8');
  } else {
    try {
      html = new TextDecoder('windows-1252').decode(bruto);
    } catch {
      html = bruto.toString('latin1');
    }
  }
  html = html
    .replace(/\r\n?/g, '\n')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ');

  if (cfg.formato === 'alesp') html = preprocessarAlesp(html);

  // ---- tokenização em blocos (<p> e <li>) ----------------------------------
  // Busca no HTML cru: sem o "O" inicial, que pode vir separado por tags
  // (<strong>O</strong> <strong>PRESIDENTE...) — e a 1ª ocorrência é sempre o
  // preâmbulo, nunca menções posteriores a "do Presidente da República".
  const posPreambulo = html.search(cfg.rePreambulo || /PRESIDENTE\s+DA\s+REP[ÚU]BLICA/i);
  if (posPreambulo === -1) throw new Error(`[${cfg.id}] preâmbulo não encontrado — o HTML da fonte mudou?`);
  const inicioCorpo = Math.max(0, html.toLowerCase().lastIndexOf('<p', posPreambulo));

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

  // ---- análise de cada bloco ------------------------------------------------
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
    const links = [];
    let linkAtual = null;

    for (const parte of partes) {
      if (parte.startsWith('<')) {
        const tag = parte.toLowerCase();
        if (/^<(strike|del|s)\b/.test(tag)) riscadoAberto++;
        else if (/^<\/(strike|del|s)\b/.test(tag)) riscadoAberto = Math.max(0, riscadoAberto - 1);
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
      vigente: limparEspacos(vigente),
      riscado: limparEspacos(riscado),
      textoNegrito: limparEspacos(textoNegrito),
      ancoras,
      links: links.filter((l) => l.texto),
      centralizado: /align\s*=\s*"?center/i.test(b.abre),
    };
  }

  const blocos = blocosBrutos.map(analisarBloco);

  // ---- metadados ------------------------------------------------------------
  const meta = {
    lei: cfg.lei,
    apelido: cfg.apelido,
    ementa: cfg.ementa,
    fonte: cfg.url,
    fonteSha256: crypto.createHash('sha256').update(bruto).digest('hex'),
    geradoEm: new Date().toISOString(),
    notasGerais: [],
  };
  {
    const cabecalho = html.slice(0, inicioCorpo);
    const notas = cabecalho.match(RE_ANOTACAO) || [];
    meta.notasGerais = notas.map((n) => limparEspacos(decodificarEntidades(n.replace(/<[^>]*>/g, ' '))));
  }

  // ---- varredura principal ---------------------------------------------------
  let preambulo = '';
  const registros = [];
  const fecho = { texto: [], observacoes: [] };
  const anexos = [];

  const hierarquiaAtual = { parte: null, livro: null, titulo: null, capitulo: null, secao: null };
  let registroAtual = null;
  let rubricasPendentes = [];
  let aguardandoNomeDe = null;
  let fimDoCodigo = false;
  let anexoAtual = null;

  function novoRegistro(numero, situacaoInicial) {
    registroAtual = {
      numero,
      rotulo: `Art. ${numero}`,
      situacao: situacaoInicial,
      rubricas: [],
      dispositivos: [],
      hierarquia: Object.fromEntries(
        NIVEIS.filter((n) => hierarquiaAtual[n]).map((n) => [n, hierarquiaAtual[n]]),
      ),
    };
    registros.push(registroAtual);
  }

  function empurrarDispositivo(disp) {
    if (!registroAtual) return;
    registroAtual.dispositivos.push(disp);
  }

  function ehCabecalho(bloco, texto) {
    if (!RE_HIERARQUIA.test(texto)) return false;
    if (bloco.centralizado) return true;
    // CTB: alguns cabeçalhos não vêm centralizados ("CAPÍTULO III-A")
    return RE_ROTULO_HIER.test(texto) && texto.length < 160;
  }

  for (const bloco of blocos) {
    const temVigente = bloco.vigente.length > 0;
    const temRiscado = bloco.riscado.length > 0;
    if (!temVigente && !temRiscado) continue;

    // ---- depois do fecho: observações e anexos -------------------------------
    if (fimDoCodigo) {
      for (const [conteudo, situacao] of [[bloco.vigente, 'vigente'], [bloco.riscado, 'historico']]) {
        if (!conteudo) continue;
        const { texto, notas } = separarAnotacoes(conteudo);
        if (!texto && !notas.length) continue;
        if (/^\*+$/.test(texto)) continue;
        if (RE_ANEXO.test(texto)) {
          anexoAtual = { titulo: texto, situacao, notas, itens: [] };
          anexos.push(anexoAtual);
          continue;
        }
        if (anexoAtual) {
          anexoAtual.itens.push({ texto, situacao, notas });
        } else if (texto) {
          fecho.observacoes.push(texto);
        }
      }
      continue;
    }

    // ---- cabeçalhos de hierarquia (apenas os vigentes contam) ----------------
    if (temVigente && !temRiscado && ehCabecalho(bloco, bloco.vigente)) {
      const { texto, notas } = separarAnotacoes(bloco.vigente);
      if (texto) {
        const nivel = chaveHierarquia(texto);
        const rotuloMatch = texto.match(RE_ROTULO_HIER);
        const rotulo = rotuloMatch ? limparEspacos(rotuloMatch[0]) : texto;
        const resto = limparEspacos(texto.slice(rotulo.length));

        hierarquiaAtual[nivel] = { rotulo, nome: resto || null, notas };
        for (const n of NIVEIS.slice(NIVEIS.indexOf(nivel) + 1)) hierarquiaAtual[n] = null;
        aguardandoNomeDe = resto ? null : nivel;
        continue;
      }
    }

    // Nome do título/capítulo na linha centralizada seguinte
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
    if (!registroAtual && registros.length === 0 && temVigente &&
        (cfg.rePreambulo || /PRESIDENTE DA REP/i).test(bloco.vigente)) {
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
      let { texto, notas } = separarAnotacoes(conteudo);
      // Pontuação órfã fora do <strike> (ex.: "…veículos</strike>.") não é texto
      if (/^[\s.,;:–—-]*$/.test(texto)) texto = '';
      if (!texto && notas.length === 0) continue;

      if (situacao === 'vigente' && !texto && notas.length && bloco.riscado &&
          RE_ARTIGO.test(separarAnotacoes(bloco.riscado).texto)) {
        notasParaProximoRegistro = notas;
        continue;
      }

      // Fecho da lei
      if (RE_FECHO.test(texto)) {
        fimDoCodigo = true;
        fecho.texto.push(texto);
        continue;
      }

      // Novo artigo?
      const mArt = texto.match(RE_ARTIGO);
      if (mArt) {
        const numero = mArt[2] ? `${mArt[1]}-${mArt[2]}` : mArt[1];
        const caput = limparEspacos(texto.slice(mArt[0].length));
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
        });
        continue;
      }

      // Nota de alteração da ALESP: parágrafo avulso "- Artigo 83 com redação
      // dada pela Lei..." vira anotação do último dispositivo do artigo
      if (/^-\s/.test(texto) && /reda[cç][aã]o dada|revogad|acrescentad|alterad|retificad|inclu[ií]d/i.test(texto) && registroAtual) {
        const alvo = registroAtual.dispositivos[registroAtual.dispositivos.length - 1];
        if (alvo) { alvo.notas.push(texto.replace(/^-\s*/, '')); continue; }
      }

      // Rubrica (nome marginal em negrito, não centralizado)
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

  // ---- consolidação -----------------------------------------------------------
  function registroTemVigencia(r) {
    return r.dispositivos.some((d) => d.situacao === 'vigente');
  }

  const vigentes = new Map();
  const historicosSemVigente = [];

  for (const r of registros) {
    if (registroTemVigencia(r)) {
      if (vigentes.has(r.numero)) {
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

  for (const a of artigos) {
    const dispVigentes = a.dispositivos.filter((d) => d.situacao === 'vigente' && d.tipo !== 'rubrica');
    const soRevogacao = dispVigentes.every(
      (d) => !d.texto || /^\(?\s*(revogad|vetado)/i.test(d.texto) || d.notas.some((n) => /revogad/i.test(n)),
    );
    const notaRevogacao = dispVigentes.some((d) => d.notas.some((n) => /revogad/i.test(n)) || /revogad/i.test(d.texto));
    a.situacao = soRevogacao && notaRevogacao ? 'revogado' : 'vigente';

    const pedacos = [];
    for (const d of a.dispositivos) {
      if (d.situacao !== 'vigente') continue;
      if (d.texto) pedacos.push(d.tipo === 'caput' ? `${a.rotulo} ${d.texto}` : d.texto);
      pedacos.push(...d.notas);
    }
    a.texto = pedacos.join('\n');

    const antigos = [];
    for (const d of [...a.dispositivos, ...(a.versoesAnteriores || [])]) {
      if (d.situacao !== 'historico') continue;
      if (d.texto) antigos.push(d.texto);
      antigos.push(...d.notas);
    }
    a.textoHistorico = antigos.join('\n');
    a.caput = (a.dispositivos.find((d) => d.tipo === 'caput' && d.situacao === 'vigente') || {}).texto || null;
  }

  for (const r of historicosSemVigente) {
    r.situacao = 'historico';
    r.texto = '';
    r.caput = null;
    r.textoHistorico = r.dispositivos.map((d) => [d.texto, ...d.notas].filter(Boolean).join(' ')).join('\n');
    artigos.push(r);
  }

  // ---- anexos vigentes viram registros pesquisáveis ---------------------------
  for (const anexo of anexos) {
    if (anexo.situacao !== 'vigente') continue;
    const itensVigentes = anexo.itens.filter((i) => i.situacao === 'vigente');
    if (!itensVigentes.length) continue;
    const rotuloMatch = anexo.titulo.match(RE_ANEXO);
    const numero = `ANEXO-${(rotuloMatch ? rotuloMatch[1] : anexos.indexOf(anexo) + 1)}`.toUpperCase();
    if (artigos.some((a) => a.numero === numero)) continue;
    artigos.push({
      numero,
      rotulo: anexo.titulo,
      situacao: 'vigente',
      rubricas: [],
      caput: itensVigentes[0].texto,
      hierarquia: {},
      dispositivos: anexo.itens.map((i) => ({ tipo: 'texto', situacao: i.situacao, texto: i.texto, notas: i.notas })),
      texto: [anexo.titulo, ...itensVigentes.map((i) => i.texto), ...anexo.notas].join('\n'),
      textoHistorico: anexo.itens.filter((i) => i.situacao === 'historico').map((i) => i.texto).join('\n'),
    });
  }

  // ---- estrutura hierárquica ---------------------------------------------------
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

  return { meta, preambulo, estrutura, artigos, fecho, anexos };
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

const ehExecucaoDireta = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (ehExecucaoDireta) {
  for (const cfg of LEIS) {
    const saida = parseLei(cfg);
    const destino = path.join(RAIZ, 'data', cfg.saida);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, JSON.stringify(saida, null, 1), 'utf8');

    const nVigentes = saida.artigos.filter((a) => a.situacao === 'vigente').length;
    const nRevogados = saida.artigos.filter((a) => a.situacao === 'revogado').length;
    const nHistoricos = saida.artigos.filter((a) => a.situacao === 'historico').length;
    console.log(`[${cfg.id}] ${saida.artigos.length} registros -> data/${cfg.saida}`);
    console.log(`     vigentes: ${nVigentes} | revogados: ${nRevogados} | apenas históricos: ${nHistoricos} | anexos: ${saida.anexos.length}`);
  }
}
