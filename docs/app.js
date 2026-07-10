/* Landing page de consulta ao Código Penal.
 * A busca roda no navegador sobre data/codigo-penal.json, então funciona
 * tanto servida pelo Express quanto como site estático (GitHub Pages). */

import { criarConsulta } from './lib/consulta.js';

const form = document.getElementById('form-busca');
const campo = document.getElementById('campo-busca');
const resumo = document.getElementById('resumo');
const resultados = document.getElementById('resultados');
const infoFonte = document.getElementById('info-fonte');

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function el(tag, className, texto) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (texto != null) e.textContent = texto;
  return e;
}

function normalizar(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Marca as ocorrências do termo (sem acento/caixa) mantendo o texto original. */
function comDestaque(texto, termo) {
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

function caminhoDe(hierarquia) {
  return Object.values(hierarquia || {})
    .map((h) => h.nome ? `${h.rotulo} – ${h.nome}` : h.rotulo)
    .join(' › ');
}

// ---------------------------------------------------------------------------
// Renderização de um artigo completo
// ---------------------------------------------------------------------------

function renderDispositivo(d, termo) {
  const p = el('p', `dispositivo tipo-${d.tipo}${d.situacao === 'historico' ? ' historico' : ''}`);
  if (d.rotuloArtigo) p.appendChild(el('strong', null, d.rotuloArtigo + ' '));
  p.appendChild(comDestaque(d.texto, termo));
  for (const nota of d.notas || []) p.appendChild(el('small', 'nota', nota));
  return p;
}

function renderArtigo(artigo, termo) {
  const cartao = el('article', 'cartao');

  const titulo = el('h2');
  titulo.appendChild(el('span', null, artigo.rotulo));
  if (artigo.situacao === 'revogado') titulo.appendChild(el('span', 'selo-revogado', 'REVOGADO'));
  if (artigo.rubricas.length) titulo.appendChild(el('span', 'rubrica', artigo.rubricas.join(' · ')));
  cartao.appendChild(titulo);

  const caminho = caminhoDe(artigo.hierarquia);
  if (caminho) cartao.appendChild(el('p', 'caminho', caminho));

  for (const d of artigo.dispositivos) {
    if (d.tipo === 'rubrica') {
      cartao.appendChild(el('p', `dispositivo tipo-rubrica${d.situacao === 'historico' ? ' historico' : ''}`, d.texto));
      continue;
    }
    cartao.appendChild(
      renderDispositivo({ ...d, rotuloArtigo: d.tipo === 'caput' ? artigo.rotulo : null }, termo),
    );
  }

  if (artigo.versoesAnteriores && artigo.versoesAnteriores.length) {
    const detalhes = el('details', 'versoes-anteriores');
    detalhes.appendChild(el('summary', null,
      `Redações anteriores (${artigo.versoesAnteriores.length} dispositivos históricos)`));
    for (const d of artigo.versoesAnteriores) {
      detalhes.appendChild(renderDispositivo({ ...d, situacao: 'historico' }, termo));
    }
    cartao.appendChild(detalhes);
  }

  return cartao;
}

// ---------------------------------------------------------------------------
// Resultados de busca textual
// ---------------------------------------------------------------------------

function renderResultadoBusca(r, termo, consulta) {
  const cartao = el('article', 'cartao');

  const titulo = el('h2');
  titulo.appendChild(el('span', null, r.rotulo));
  if (r.situacao === 'revogado') titulo.appendChild(el('span', 'selo-revogado', 'REVOGADO'));
  if (r.rubricas.length) titulo.appendChild(el('span', 'rubrica', r.rubricas.join(' · ')));
  cartao.appendChild(titulo);

  const caminho = caminhoDe(r.hierarquia);
  if (caminho) cartao.appendChild(el('p', 'caminho', caminho));

  for (const t of r.trechos) {
    const p = el('p', 'trecho');
    p.appendChild(comDestaque(t.trecho, termo));
    cartao.appendChild(p);
  }

  const acoes = el('div', 'acoes');
  const botao = el('button', null, 'Ver artigo completo');
  botao.addEventListener('click', () => {
    cartao.replaceWith(renderArtigo(consulta.artigo(r.numero), termo));
  });
  acoes.appendChild(botao);
  cartao.appendChild(acoes);

  return cartao;
}

// ---------------------------------------------------------------------------
// Carga dos dados e busca
// ---------------------------------------------------------------------------

let consultaPronta = null;

async function carregar() {
  resumo.textContent = 'Carregando o Código Penal…';
  try {
    const resposta = await fetch('./data/codigo-penal.json');
    const lei = await resposta.json();
    consultaPronta = criarConsulta(lei);

    const data = new Date(lei.meta.geradoEm).toLocaleDateString('pt-BR');
    infoFonte.textContent =
      `${lei.meta.lei} · dados extraídos do texto oficial do Planalto em ${data}. ` +
      'Este site não substitui o texto publicado no DOU.';
    resumo.textContent = '';
  } catch {
    resumo.textContent = 'Não foi possível carregar os dados do Código Penal.';
  }
  return consultaPronta;
}

const carregamento = carregar();

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const termo = campo.value.trim();
  if (!termo) return;

  const consulta = consultaPronta || (await carregamento);
  if (!consulta) return;

  resultados.replaceChildren();
  const dados = consulta.buscar(termo);

  if (dados.tipo === 'artigo') {
    resumo.textContent = `Artigo encontrado para “${termo}”.`;
    resultados.appendChild(renderArtigo(dados.resultados[0], null));
    return;
  }

  if (dados.total === 0) {
    resumo.textContent = '';
    resultados.appendChild(el('p', 'vazio',
      `Nenhum artigo contém “${termo}”. Tente outra palavra ou um número de artigo.`));
    return;
  }

  resumo.textContent = `${dados.total} artigo(s) mencionam “${termo}”.`;
  for (const r of dados.resultados) {
    resultados.appendChild(renderResultadoBusca(r, termo, consulta));
  }
});
