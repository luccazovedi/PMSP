/* Landing page de consulta às leis.
 * A busca roda no navegador sobre data/<lei>.json, então funciona tanto
 * servida pelo Express quanto como site estático (GitHub Pages). */

import { criarConsulta } from './lib/consulta.js';
import { LEIS } from './leis-config.js';
import {
  el, caminhoDe, comDestaque, extrairFicha, classeGravidade, renderArtigo,
} from './render.js';

const form = document.getElementById('form-busca');
const campo = document.getElementById('campo-busca');
const resumo = document.getElementById('resumo');
const resultados = document.getElementById('resultados');
const infoFonte = document.getElementById('info-fonte');
const subtitulo = document.getElementById('subtitulo');

let leiAtual = 'cp';

// ---------------------------------------------------------------------------
// Artigo completo com link para a íntegra da lei
// ---------------------------------------------------------------------------

function renderArtigoComLink(artigo, termo) {
  const cartao = renderArtigo(artigo, termo, leiAtual);
  const acoes = el('div', 'acoes');
  const link = el('a', 'link-integra', 'Ver na íntegra da lei →');
  link.href = `lei.html?lei=${leiAtual}#art-${encodeURIComponent(artigo.numero)}`;
  acoes.appendChild(link);
  cartao.appendChild(acoes);
  return cartao;
}

// ---------------------------------------------------------------------------
// Resultados de busca textual
// ---------------------------------------------------------------------------

function renderResultadoBusca(r, termo, consulta) {
  const cartao = el('article', 'cartao');

  const titulo = el('h2');
  titulo.appendChild(el('span', 'num-artigo', r.rotulo));
  if (r.situacao === 'revogado') titulo.appendChild(el('span', 'selo-revogado', 'REVOGADO'));
  if (r.rubricas.length) titulo.appendChild(el('span', 'rubrica', r.rubricas.join(' · ')));

  // No CTB, o selo de gravidade já aparece na lista de resultados
  if (leiAtual === 'ctb') {
    const completo = consulta.artigo(r.numero);
    const ficha = completo && completo.situacao === 'vigente' ? extrairFicha(completo) : null;
    if (ficha && ficha.gravidade) {
      titulo.appendChild(el('span', `selo-gravidade ${classeGravidade(ficha.gravidade)}`, ficha.gravidade.toUpperCase()));
    }
  }
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
    cartao.replaceWith(renderArtigoComLink(consulta.artigo(r.numero), termo));
  });
  acoes.appendChild(botao);
  cartao.appendChild(acoes);

  return cartao;
}

// ---------------------------------------------------------------------------
// Carga dos dados por lei
// ---------------------------------------------------------------------------

const consultas = {}; // id da lei -> {consulta, meta}

async function carregarLei(id) {
  if (consultas[id]) return consultas[id];
  resumo.textContent = 'Carregando a lei…';
  const resposta = await fetch(`./data/${LEIS[id].arquivo}`);
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  const lei = await resposta.json();
  consultas[id] = { consulta: criarConsulta(lei), meta: lei.meta };
  resumo.textContent = '';
  return consultas[id];
}

function atualizarCabecalho(meta) {
  const nomeFonte = meta.fonte.includes('al.sp.gov.br') ? 'ALESP' : 'Planalto';
  subtitulo.replaceChildren();
  subtitulo.appendChild(document.createTextNode(`${meta.lei} — texto atualizado da fonte oficial (`));
  const a = el('a', null, nomeFonte);
  a.href = meta.fonte;
  a.target = '_blank';
  a.rel = 'noopener';
  subtitulo.appendChild(a);
  subtitulo.appendChild(document.createTextNode(')'));

  const data = new Date(meta.geradoEm).toLocaleDateString('pt-BR');
  infoFonte.textContent =
    `${meta.apelido}: dados extraídos do texto oficial (${nomeFonte}) em ${data}. ` +
    'Este site não substitui o texto publicado no Diário Oficial.';
}

const atalhosEl = document.getElementById('atalhos');

function renderAtalhos(id) {
  atalhosEl.replaceChildren();
  for (const { q, nome } of LEIS[id].atalhos) {
    const b = el('button');
    b.type = 'button';
    b.appendChild(el('strong', null, nome));
    b.appendChild(document.createTextNode(` · art. ${q}`));
    b.addEventListener('click', () => {
      campo.value = q;
      executarBusca(q);
    });
    atalhosEl.appendChild(b);
  }
  // link para a leitura da lei inteira
  const ler = el('a', 'atalho-integra');
  ler.href = `lei.html?lei=${id}`;
  ler.appendChild(el('strong', null, '📖 Lei completa'));
  atalhosEl.appendChild(ler);
}

async function trocarLei(id) {
  leiAtual = id;
  campo.placeholder = `Busque um artigo ou uma palavra (${LEIS[id].exemplo})`;
  renderAtalhos(id);
  fecharSugestoes();
  resultados.replaceChildren();
  resumo.textContent = '';
  try {
    const { meta } = await carregarLei(id);
    atualizarCabecalho(meta);
  } catch {
    resumo.textContent = 'Não foi possível carregar os dados da lei.';
  }
}

// Seletor de leis gerado a partir do registro
const seletor = document.getElementById('seletor-lei');
for (const [id, cfgLei] of Object.entries(LEIS)) {
  const label = el('label', 'pilula');
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'lei';
  radio.value = id;
  radio.checked = id === leiAtual;
  const span = el('span', null, cfgLei.nome);
  span.title = cfgLei.nomeLongo;
  label.appendChild(radio);
  label.appendChild(span);
  radio.addEventListener('change', () => trocarLei(id));
  seletor.appendChild(label);
}

// ---------------------------------------------------------------------------
// Sugestões enquanto digita ("relacionados")
// ---------------------------------------------------------------------------

const listaSugestoes = document.getElementById('sugestoes');
let sugestoesAtuais = [];
let sugestaoAtiva = -1;
let debounceSugestao = null;

function fecharSugestoes() {
  listaSugestoes.hidden = true;
  listaSugestoes.replaceChildren();
  campo.setAttribute('aria-expanded', 'false');
  sugestoesAtuais = [];
  sugestaoAtiva = -1;
}

function marcarAtiva(indice) {
  sugestaoAtiva = indice;
  [...listaSugestoes.children].forEach((li, i) => li.classList.toggle('ativa', i === indice));
}

function escolherSugestao(s) {
  campo.value = s.numero;
  fecharSugestoes();
  executarBusca(s.numero);
}

function mostrarSugestoes(itens) {
  if (!itens.length) { fecharSugestoes(); return; }
  sugestoesAtuais = itens;
  sugestaoAtiva = -1;
  listaSugestoes.replaceChildren();
  for (const s of itens) {
    const li = el('li');
    li.setAttribute('role', 'option');
    li.appendChild(el('span', 'sug-rotulo', s.rotulo));
    if (s.situacao === 'revogado') li.appendChild(el('span', 'selo-revogado', 'REVOGADO'));
    if (s.descricao) li.appendChild(el('span', 'sug-descricao', s.descricao));
    li.addEventListener('mousedown', (e) => { e.preventDefault(); escolherSugestao(s); });
    listaSugestoes.appendChild(li);
  }
  listaSugestoes.hidden = false;
  campo.setAttribute('aria-expanded', 'true');
}

campo.addEventListener('input', () => {
  clearTimeout(debounceSugestao);
  const valor = campo.value.trim();
  if (!valor) { fecharSugestoes(); return; }
  debounceSugestao = setTimeout(async () => {
    try {
      const { consulta } = await carregarLei(leiAtual);
      if (campo.value.trim() !== valor) return;
      mostrarSugestoes(consulta.sugerir(valor, 8));
    } catch { /* mensagem já exibida por carregarLei */ }
  }, 120);
});

campo.addEventListener('keydown', (evento) => {
  if (listaSugestoes.hidden || !sugestoesAtuais.length) return;
  if (evento.key === 'ArrowDown') {
    evento.preventDefault();
    marcarAtiva((sugestaoAtiva + 1) % sugestoesAtuais.length);
  } else if (evento.key === 'ArrowUp') {
    evento.preventDefault();
    marcarAtiva((sugestaoAtiva - 1 + sugestoesAtuais.length) % sugestoesAtuais.length);
  } else if (evento.key === 'Enter' && sugestaoAtiva >= 0) {
    evento.preventDefault();
    escolherSugestao(sugestoesAtuais[sugestaoAtiva]);
  } else if (evento.key === 'Escape') {
    // impede o comportamento nativo do type="search" de limpar o campo
    evento.preventDefault();
    fecharSugestoes();
  }
});

campo.addEventListener('blur', () => setTimeout(fecharSugestoes, 150));

// ---------------------------------------------------------------------------
// Busca
// ---------------------------------------------------------------------------

async function executarBusca(termo) {
  let consulta;
  try {
    ({ consulta } = await carregarLei(leiAtual));
  } catch {
    return;
  }

  resultados.replaceChildren();
  const dados = consulta.buscar(termo);

  if (dados.tipo === 'artigo') {
    resumo.textContent = `Artigo encontrado para “${termo}”.`;
    resultados.appendChild(renderArtigoComLink(dados.resultados[0], null));
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
}

form.addEventListener('submit', (evento) => {
  evento.preventDefault();
  fecharSugestoes();
  const termo = campo.value.trim();
  if (termo) executarBusca(termo);
});

// Estado inicial
trocarLei('cp');
