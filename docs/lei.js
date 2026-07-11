/* Página de leitura da íntegra de uma lei: todos os artigos na ordem oficial,
 * com sumário navegável, preâmbulo, fecho, assinaturas e anexos. */

import { LEIS } from './leis-config.js';
import { el, renderArtigo } from './render.js';

const params = new URLSearchParams(location.search);
const leiId = LEIS[params.get('lei')] ? params.get('lei') : 'cp';

const tituloEl = document.getElementById('titulo-lei');
const subtituloEl = document.getElementById('subtitulo');
const ementaEl = document.getElementById('ementa');
const sumarioEl = document.getElementById('sumario-lista');
const documentoEl = document.getElementById('documento');
const infoFonteEl = document.getElementById('info-fonte');

const NIVEIS = ['parte', 'livro', 'titulo', 'capitulo', 'secao', 'subsecao'];

function idCabecalho(nivel, h) {
  return `h-${nivel}-${(h.rotulo + '-' + (h.nome || '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`;
}

function renderCabecalhoHier(nivel, h) {
  const grau = NIVEIS.indexOf(nivel);
  const cab = el('div', `hier-cabecalho hier-${nivel}`);
  cab.id = idCabecalho(nivel, h);
  cab.appendChild(el('div', 'hier-rotulo', h.rotulo));
  if (h.nome) cab.appendChild(el('div', 'hier-nome', h.nome));
  cab.style.setProperty('--grau', grau);
  return cab;
}

async function carregar() {
  const resposta = await fetch(`./data/${LEIS[leiId].arquivo}`);
  if (!resposta.ok) {
    tituloEl.textContent = 'Não foi possível carregar a lei.';
    return;
  }
  const lei = await resposta.json();
  const { meta } = lei;

  // Cabeçalho da página
  const nomeFonte = meta.fonte.includes('al.sp.gov.br') ? 'ALESP' : 'Planalto';
  document.title = `${meta.apelido} — íntegra`;
  tituloEl.textContent = meta.apelido;
  subtituloEl.replaceChildren();
  subtituloEl.appendChild(document.createTextNode(`${meta.lei} — texto atualizado da fonte oficial (`));
  const a = el('a', null, nomeFonte);
  a.href = meta.fonte;
  a.target = '_blank';
  a.rel = 'noopener';
  subtituloEl.appendChild(a);
  subtituloEl.appendChild(document.createTextNode(')'));
  ementaEl.textContent = meta.ementa;

  const data = new Date(meta.geradoEm).toLocaleDateString('pt-BR');
  infoFonteEl.textContent =
    `${meta.apelido}: dados extraídos do texto oficial (${nomeFonte}) em ${data}. ` +
    'Este site não substitui o texto publicado no Diário Oficial.';

  // Preâmbulo
  if (lei.preambulo) {
    documentoEl.appendChild(el('p', 'preambulo', lei.preambulo));
  }

  // Sumário + corpo: percorre os artigos na ordem, emitindo cabeçalhos quando
  // a hierarquia muda
  const anterior = {};
  const fragCorpo = document.createDocumentFragment();
  const filaArtigos = [];

  for (const artigo of lei.artigos) {
    let mudou = false;
    for (const nivel of NIVEIS) {
      const h = artigo.hierarquia?.[nivel];
      const chave = h ? `${h.rotulo}|${h.nome || ''}` : '';
      if ((anterior[nivel] || '') !== chave) mudou = true;
      if (mudou && h) {
        fragCorpo.appendChild(renderCabecalhoHier(nivel, h));
        // entrada no sumário (até o nível de capítulo)
        if (NIVEIS.indexOf(nivel) <= NIVEIS.indexOf('capitulo')) {
          const li = el('a', `sumario-item sumario-${nivel}`);
          li.href = `#${idCabecalho(nivel, h)}`;
          li.textContent = h.nome ? `${h.rotulo} — ${h.nome}` : h.rotulo;
          sumarioEl.appendChild(li);
        }
      }
      anterior[nivel] = chave;
    }
    filaArtigos.push({ artigo, marcador: fragCorpo.appendChild(el('div')) });
  }
  documentoEl.appendChild(fragCorpo);

  // Fecho, assinaturas e observações
  const rodapeLei = el('div', 'fecho-lei');
  for (const t of lei.fecho?.texto || []) rodapeLei.appendChild(el('p', 'fecho-data', t));
  for (const o of lei.fecho?.observacoes || []) rodapeLei.appendChild(el('p', 'fecho-obs', o));
  documentoEl.appendChild(rodapeLei);

  // Renderiza os artigos em lotes para não travar a página (o CPP tem 853)
  const LOTE = 60;
  let i = 0;
  function proximoLote() {
    const fim = Math.min(i + LOTE, filaArtigos.length);
    for (; i < fim; i++) {
      const { artigo, marcador } = filaArtigos[i];
      marcador.replaceWith(renderArtigo(artigo, null, leiId));
    }
    if (i < filaArtigos.length) {
      requestAnimationFrame(proximoLote);
    } else if (location.hash) {
      // navegação direta para um artigo (ex.: lei.html?lei=cp#art-121)
      const alvo = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (alvo) alvo.scrollIntoView({ block: 'start' });
    }
  }
  proximoLote();
}

carregar();
