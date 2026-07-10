/* Landing page de consulta ao Código Penal e ao CTB.
 * A busca roda no navegador sobre data/<lei>.json, então funciona tanto
 * servida pelo Express quanto como site estático (GitHub Pages). */

import { criarConsulta } from './lib/consulta.js';

const LEIS = {
  cp: {
    arquivo: 'codigo-penal.json',
    exemplo: 'ex.: 121, 157, 121-A — ou furto, arma de fogo',
    atalhos: [
      { q: '121', nome: 'Homicídio' },
      { q: '155', nome: 'Furto' },
      { q: '157', nome: 'Roubo' },
      { q: '171', nome: 'Estelionato' },
      { q: '147-A', nome: 'Perseguição' },
      { q: '331', nome: 'Desacato' },
    ],
  },
  cpp: {
    arquivo: 'cpp.json',
    exemplo: 'ex.: 301, 302, 244 — ou flagrante, busca pessoal, fiança',
    atalhos: [
      { q: '301', nome: 'Prisão em flagrante' },
      { q: '302', nome: 'Situações de flagrante' },
      { q: '244', nome: 'Busca pessoal' },
      { q: '6', nome: 'Local de crime' },
      { q: '282', nome: 'Cautelares' },
      { q: '322', nome: 'Fiança' },
    ],
  },
  cpm: {
    arquivo: 'cpm.json',
    exemplo: 'ex.: 9, 187, 205 — ou deserção, sentinela, insubordinação',
    atalhos: [
      { q: '9', nome: 'Crime militar' },
      { q: '187', nome: 'Deserção' },
      { q: '195', nome: 'Abandono de posto' },
      { q: '202', nome: 'Embriaguez em serviço' },
      { q: '205', nome: 'Homicídio' },
      { q: '303', nome: 'Peculato' },
    ],
  },
  ctb: {
    arquivo: 'ctb.json',
    exemplo: 'ex.: 165, 306, 165-B — ou capacete, celular, álcool',
    atalhos: [
      { q: '165', nome: 'Embriaguez' },
      { q: '162', nome: 'Sem CNH' },
      { q: '252', nome: 'Celular' },
      { q: '244', nome: 'Capacete' },
      { q: '302', nome: 'Homicídio culposo' },
      { q: '306', nome: 'Crime de embriaguez' },
    ],
  },
  rdpm: {
    arquivo: 'rdpm.json',
    exemplo: 'ex.: 13, 17, 26 — ou transgressão, atrasado, uniforme',
    atalhos: [
      { q: '13', nome: 'Transgressões' },
      { q: '14', nome: 'Sanções' },
      { q: '17', nome: 'Permanência disciplinar' },
      { q: '26', nome: 'Recolhimento' },
      { q: '53', nome: 'Comportamento' },
      { q: '56', nome: 'Recursos' },
    ],
  },
};

const form = document.getElementById('form-busca');
const campo = document.getElementById('campo-busca');
const resumo = document.getElementById('resumo');
const resultados = document.getElementById('resultados');
const infoFonte = document.getElementById('info-fonte');
const subtitulo = document.getElementById('subtitulo');

let leiAtual = 'cp';

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
// Ficha estruturada do CTB (infração, penalidade, medidas administrativas)
// ---------------------------------------------------------------------------

const ROTULOS_FICHA = {
  infracao: 'Infração',
  penalidade: 'Penalidade',
  'medida-administrativa': 'Medida administrativa',
  pena: 'Pena (crime de trânsito)',
};

function extrairFicha(artigo) {
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
  return { campos, gravidade };
}

function classeGravidade(gravidade) {
  const g = normalizar(gravidade || '');
  if (g.startsWith('gravissima')) return 'gravidade-gravissima';
  if (g.startsWith('grave')) return 'gravidade-grave';
  if (g.startsWith('media')) return 'gravidade-media';
  if (g.startsWith('leve')) return 'gravidade-leve';
  return '';
}

function renderFicha(ficha) {
  const painel = el('aside', 'ficha');
  painel.appendChild(el('h3', 'ficha-titulo', 'Resumo operacional'));

  if (ficha.gravidade) {
    const linha = el('div', 'ficha-linha');
    linha.appendChild(el('span', 'ficha-rotulo', 'Gravidade'));
    linha.appendChild(el('span', `selo-gravidade ${classeGravidade(ficha.gravidade)}`, ficha.gravidade.toUpperCase()));
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

  if (ficha.campos['medida-administrativa'].length) {
    painel.appendChild(el('p', 'ficha-nota',
      'Medida administrativa é a providência imediata a cargo do agente de fiscalização (art. 269 do CTB), além da lavratura do auto de infração.'));
  }
  return painel;
}

// ---------------------------------------------------------------------------
// Renderização de um artigo completo
// ---------------------------------------------------------------------------

// Transgressões do RDPM terminam com a gravidade entre parênteses: (G)/(M)/(L)
const GRAVIDADE_RDPM = {
  G: ['GRAVE', 'gravidade-grave'],
  M: ['MÉDIA', 'gravidade-media'],
  L: ['LEVE', 'gravidade-leve'],
};

function renderDispositivo(d, termo) {
  const p = el('p', `dispositivo tipo-${d.tipo}${d.situacao === 'historico' ? ' historico' : ''}`);
  if (d.rotuloArtigo) p.appendChild(el('strong', null, d.rotuloArtigo + ' '));
  if (ROTULOS_FICHA[d.tipo] && d.situacao !== 'historico') {
    p.appendChild(el('span', `etiqueta etiqueta-${d.tipo}`, ROTULOS_FICHA[d.tipo]));
  }

  const mGravidade = leiAtual === 'rdpm' && d.tipo === 'item' &&
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

function renderArtigo(artigo, termo) {
  const cartao = el('article', 'cartao');

  const titulo = el('h2');
  titulo.appendChild(el('span', 'num-artigo', artigo.rotulo));
  if (artigo.situacao === 'revogado') titulo.appendChild(el('span', 'selo-revogado', 'REVOGADO'));
  if (artigo.rubricas.length) titulo.appendChild(el('span', 'rubrica', artigo.rubricas.join(' · ')));
  cartao.appendChild(titulo);

  const caminho = caminhoDe(artigo.hierarquia);
  if (caminho) cartao.appendChild(el('p', 'caminho', caminho));

  if (leiAtual === 'ctb' && artigo.situacao === 'vigente') {
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
      no = renderDispositivo({ ...d, rotuloArtigo: d.tipo === 'caput' ? artigo.rotulo : null }, termo);
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
    cartao.replaceWith(renderArtigo(consulta.artigo(r.numero), termo));
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

for (const radio of document.querySelectorAll('input[name="lei"]')) {
  radio.addEventListener('change', () => trocarLei(radio.value));
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
}

form.addEventListener('submit', (evento) => {
  evento.preventDefault();
  fecharSugestoes();
  const termo = campo.value.trim();
  if (termo) executarBusca(termo);
});

// Estado inicial
trocarLei('cp');
