/* Renderização de artigos e fichas, compartilhada entre a página de busca
 * (app.js) e a página de leitura da lei completa (lei.js). */

export function el(tag, className, texto) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (texto != null) e.textContent = texto;
  return e;
}

export function normalizar(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Marca as ocorrências do termo (sem acento/caixa) mantendo o texto original. */
export function comDestaque(texto, termo) {
  const span = el('span');
  if (!termo) { span.textContent = texto; return span; }
  const alvo = normalizar(termo);
  const base = normalizar(texto);
  let i = 0;
  let pos = base.indexOf(alvo);
  while (pos !== -1) {
    span.appendChild(document.createTextNode(texto.slice(i, pos)));
    span.appendChild(el('mark', null, texto.slice(pos, pos + termo.length)));
    i = pos + termo.length;
    pos = base.indexOf(alvo, i);
  }
  span.appendChild(document.createTextNode(texto.slice(i)));
  return span;
}

export function caminhoDe(hierarquia) {
  return Object.values(hierarquia || {})
    .map((h) => h.nome ? `${h.rotulo} – ${h.nome}` : h.rotulo)
    .join(' › ');
}

// ---------------------------------------------------------------------------
// Ficha estruturada do CTB (infração, penalidade, medidas administrativas)
// ---------------------------------------------------------------------------

export const ROTULOS_FICHA = {
  infracao: 'Infração',
  penalidade: 'Penalidade',
  'medida-administrativa': 'Medida administrativa',
  pena: 'Pena (crime de trânsito)',
};

// Valores do art. 258 e pontuação do art. 259 do CTB, por natureza da infração
const TABELA_CTB = {
  gravissima: { valor: 293.47, pontos: 7 },
  grave: { valor: 195.23, pontos: 5 },
  media: { valor: 130.16, pontos: 4 },
  leve: { valor: 88.38, pontos: 3 },
};

const MULTIPLICADORES = {
  duas: 2, tres: 3, cinco: 5, dez: 10, vinte: 20,
  quarenta: 40, sessenta: 60, cem: 100,
};

const REAIS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function extrairFicha(artigo) {
  const campos = { infracao: [], penalidade: [], 'medida-administrativa': [], pena: [] };
  for (const d of artigo.dispositivos) {
    if (d.situacao === 'vigente' && campos[d.tipo]) {
      campos[d.tipo].push(d.texto.replace(/^[^-–—]*[-–—]\s*/, ''));
    }
  }
  const temAlgo = Object.values(campos).some((c) => c.length);
  if (!temAlgo) return null;

  const textoInfracoes = campos.infracao.join(' ');
  const gravidade = (textoInfracoes.match(/grav[íi]ssima|grave|m[ée]dia|leve/i) || [null])[0];

  // Multa e pontos derivados dos arts. 258 e 259 do CTB
  let multa = null;
  let pontos = null;
  const base = gravidade && TABELA_CTB[normalizar(gravidade).replace(/[^a-z]/g, '')];
  if (base) {
    pontos = base.pontos;
    const m = campos.penalidade.join(' ').match(/multa\s*\(\s*([a-zà-ÿ]+)\s+vezes\s*\)/i);
    const fator = m ? MULTIPLICADORES[normalizar(m[1])] : null;
    multa = {
      valorBase: REAIS.format(base.valor),
      fator: fator || 1,
      valorFinal: REAIS.format(base.valor * (fator || 1)),
    };
  }

  return { campos, gravidade, pontos, multa, enquadramentos: artigo.enquadramentos || [] };
}

export function classeGravidade(gravidade) {
  const g = normalizar(gravidade || '');
  if (g.startsWith('gravissima')) return 'gravidade-gravissima';
  if (g.startsWith('grave')) return 'gravidade-grave';
  if (g.startsWith('media')) return 'gravidade-media';
  if (g.startsWith('leve')) return 'gravidade-leve';
  return '';
}

export function renderFicha(ficha) {
  const painel = el('aside', 'ficha');
  painel.appendChild(el('h3', 'ficha-titulo', 'Resumo operacional'));

  if (ficha.gravidade) {
    const linha = el('div', 'ficha-linha');
    linha.appendChild(el('span', 'ficha-rotulo', 'Gravidade'));
    const valores = el('div', 'ficha-valores ficha-gravidade');
    valores.appendChild(el('span', `selo-gravidade ${classeGravidade(ficha.gravidade)}`, ficha.gravidade.toUpperCase()));
    if (ficha.pontos) valores.appendChild(el('span', 'ficha-metrica', `${ficha.pontos} pontos na CNH`));
    if (ficha.multa) {
      valores.appendChild(el('span', 'ficha-metrica',
        ficha.multa.fator > 1
          ? `multa ${ficha.multa.valorFinal} (${ficha.multa.valorBase} × ${ficha.multa.fator})`
          : `multa ${ficha.multa.valorFinal}`));
    }
    linha.appendChild(valores);
    painel.appendChild(linha);
  }

  for (const [tipo, valores] of Object.entries(ficha.campos)) {
    if (!valores.length || tipo === 'infracao') continue;
    const linha = el('div', 'ficha-linha');
    linha.appendChild(el('span', 'ficha-rotulo', ROTULOS_FICHA[tipo] + (valores.length > 1 ? 's' : '')));
    const lista = el('div', 'ficha-valores');
    for (const v of valores) lista.appendChild(el('p', null, v));
    linha.appendChild(lista);
    painel.appendChild(linha);
  }

  if (ficha.enquadramentos.length) {
    const linha = el('div', 'ficha-linha');
    linha.appendChild(el('span', 'ficha-rotulo', 'Enquadramentos'));
    const lista = el('div', 'ficha-valores');
    for (const e of ficha.enquadramentos) {
      const p = el('p', 'enquadramento');
      p.appendChild(el('span', 'cod-enquadramento', e.codigo));
      p.appendChild(document.createTextNode(' ' + e.descricao));
      const extras = [
        e.gravidade,
        e.pontos ? `${e.pontos} pts` : null,
        e.infrator ? `infrator: ${e.infrator}` : null,
        e.competencia,
      ].filter(Boolean).join(' · ');
      if (extras) p.appendChild(el('small', 'nota', extras));
      lista.appendChild(p);
    }
    linha.appendChild(lista);
    painel.appendChild(linha);
  }

  const notas = [];
  if (ficha.campos['medida-administrativa'].length) {
    notas.push('Medida administrativa é a providência imediata a cargo do agente de fiscalização (art. 269 do CTB), além da lavratura do auto de infração.');
  }
  if (ficha.pontos || ficha.multa) {
    notas.push('Valor da multa conforme o art. 258 e pontuação conforme o art. 259 do CTB.');
  }
  if (ficha.enquadramentos.length) {
    notas.push('Códigos de enquadramento da tabela oficial RENAINF/SENATRAN, usados no auto de infração.');
  }
  for (const n of notas) painel.appendChild(el('p', 'ficha-nota', n));
  return painel;
}

// ---------------------------------------------------------------------------
// Dispositivos e artigos
// ---------------------------------------------------------------------------

// Transgressões do RDPM terminam com a gravidade entre parênteses: (G)/(M)/(L)
export const GRAVIDADE_RDPM = {
  G: ['GRAVE', 'gravidade-grave'],
  M: ['MÉDIA', 'gravidade-media'],
  L: ['LEVE', 'gravidade-leve'],
};

export function renderDispositivo(d, termo, leiId) {
  const p = el('p', `dispositivo tipo-${d.tipo}${d.situacao === 'historico' ? ' historico' : ''}`);
  if (d.rotuloArtigo) p.appendChild(el('strong', null, d.rotuloArtigo + ' '));
  if (ROTULOS_FICHA[d.tipo] && d.situacao !== 'historico') {
    p.appendChild(el('span', `etiqueta etiqueta-${d.tipo}`, ROTULOS_FICHA[d.tipo]));
  }

  const mGravidade = leiId === 'rdpm' && d.tipo === 'item' &&
    d.situacao !== 'historico' && d.texto.match(/\(([GML])\)\s*[;.]?\s*$/);
  if (mGravidade) {
    const [rotulo, classe] = GRAVIDADE_RDPM[mGravidade[1]];
    p.appendChild(comDestaque(d.texto.slice(0, mGravidade.index).trimEnd(), termo));
    p.appendChild(document.createTextNode(' '));
    p.appendChild(el('span', `selo-gravidade ${classe}`, rotulo));
  } else {
    p.appendChild(comDestaque(d.texto, termo));
  }

  for (const nota of d.notas || []) p.appendChild(el('small', 'nota', nota));
  return p;
}

export function renderArtigo(artigo, termo, leiId) {
  const cartao = el('article', 'cartao');
  cartao.id = `art-${artigo.numero}`;

  const titulo = el('h2');
  titulo.appendChild(el('span', 'num-artigo', artigo.rotulo));
  if (artigo.situacao === 'revogado') titulo.appendChild(el('span', 'selo-revogado', 'REVOGADO'));
  if (artigo.rubricas.length) titulo.appendChild(el('span', 'rubrica', artigo.rubricas.join(' · ')));
  cartao.appendChild(titulo);

  const caminho = caminhoDe(artigo.hierarquia);
  if (caminho) cartao.appendChild(el('p', 'caminho', caminho));

  if (artigo.palavrasChave && artigo.palavrasChave.length) {
    const tags = el('p', 'tags-chave');
    for (const chave of artigo.palavrasChave) tags.appendChild(el('span', 'tag-chave', chave));
    cartao.appendChild(tags);
  }

  if (leiId === 'ctb' && artigo.situacao === 'vigente') {
    const ficha = extrairFicha(artigo);
    if (ficha) cartao.appendChild(renderFicha(ficha));
  }

  // Dispositivos históricos consecutivos ficam recolhidos num <details>,
  // para o texto vigente ser lido sem interrupções
  let grupoHistorico = null;
  for (const d of artigo.dispositivos) {
    let no;
    if (d.tipo === 'rubrica') {
      no = el('p', `dispositivo tipo-rubrica${d.situacao === 'historico' ? ' historico' : ''}`, d.texto);
    } else {
      no = renderDispositivo({ ...d, rotuloArtigo: d.tipo === 'caput' ? artigo.rotulo : null }, termo, leiId);
    }
    if (d.situacao === 'historico') {
      if (!grupoHistorico) {
        grupoHistorico = el('details', 'historico-grupo');
        grupoHistorico.appendChild(el('summary', null, 'redação anterior'));
        cartao.appendChild(grupoHistorico);
      }
      grupoHistorico.appendChild(no);
      const n = grupoHistorico.querySelectorAll('.dispositivo').length;
      grupoHistorico.querySelector('summary').textContent =
        n > 1 ? `redações anteriores (${n} dispositivos)` : 'redação anterior';
    } else {
      grupoHistorico = null;
      cartao.appendChild(no);
    }
  }

  if (artigo.versoesAnteriores && artigo.versoesAnteriores.length) {
    const detalhes = el('details', 'versoes-anteriores');
    detalhes.appendChild(el('summary', null,
      `Redações anteriores (${artigo.versoesAnteriores.length} dispositivos históricos)`));
    for (const d of artigo.versoesAnteriores) {
      detalhes.appendChild(renderDispositivo({ ...d, situacao: 'historico' }, termo, leiId));
    }
    cartao.appendChild(detalhes);
  }

  return cartao;
}
