/* Landing page de consulta ao Código Penal e ao CTB.
 * A busca roda no navegador sobre data/<lei>.json, então funciona tanto
 * servida pelo Express quanto como site estático (GitHub Pages). */

import { criarConsulta } from './lib/consulta.js';

const LEIS = {
  cf: {
    arquivo: 'cf.json',
    nome: 'CF',
    nomeLongo: 'Constituição Federal',
    exemplo: 'ex.: 5, 144, ADCT 2 — ou segurança pública, liberdade',
    atalhos: [
      { q: '5', nome: 'Direitos fundamentais' },
      { q: '37', nome: 'Adm. pública' },
      { q: '144', nome: 'Segurança pública' },
      { q: '142', nome: 'Forças Armadas' },
    ],
  },
  cp: {
    arquivo: 'codigo-penal.json',
    nome: 'CP',
    nomeLongo: 'Código Penal',
    exemplo: 'ex.: 121, 157, 121-A — ou furto, arma de fogo',
    atalhos: [
      { q: '121', nome: 'Homicídio' },
      { q: '155', nome: 'Furto' },
      { q: '157', nome: 'Roubo' },
      { q: '171', nome: 'Estelionato' },
      { q: '331', nome: 'Desacato' },
    ],
  },
  cpp: {
    arquivo: 'cpp.json',
    nome: 'CPP',
    nomeLongo: 'Código de Processo Penal',
    exemplo: 'ex.: 301, 302, 244 — ou flagrante, busca pessoal, fiança',
    atalhos: [
      { q: '301', nome: 'Prisão em flagrante' },
      { q: '302', nome: 'Situações de flagrante' },
      { q: '244', nome: 'Busca pessoal' },
      { q: '282', nome: 'Cautelares' },
      { q: '322', nome: 'Fiança' },
    ],
  },
  cpm: {
    arquivo: 'cpm.json',
    nome: 'CPM',
    nomeLongo: 'Código Penal Militar',
    exemplo: 'ex.: 9, 187, 205 — ou deserção, sentinela, insubordinação',
    atalhos: [
      { q: '9', nome: 'Crime militar' },
      { q: '187', nome: 'Deserção' },
      { q: '195', nome: 'Abandono de posto' },
      { q: '202', nome: 'Embriaguez em serviço' },
      { q: '303', nome: 'Peculato' },
    ],
  },
  cppm: {
    arquivo: 'cppm.json',
    nome: 'CPPM',
    nomeLongo: 'Código de Processo Penal Militar',
    exemplo: 'ex.: 243, 245, 8 — ou flagrante, menagem, deserção',
    atalhos: [
      { q: '8', nome: 'Polícia judiciária militar' },
      { q: '243', nome: 'Prisão em flagrante' },
      { q: '245', nome: 'Auto de prisão' },
      { q: '263', nome: 'Menagem' },
    ],
  },
  ctb: {
    arquivo: 'ctb.json',
    nome: 'CTB',
    nomeLongo: 'Código de Trânsito Brasileiro',
    exemplo: 'ex.: 165, 306, 165-B — ou capacete, celular, álcool',
    atalhos: [
      { q: '165', nome: 'Embriaguez' },
      { q: '162', nome: 'Sem CNH' },
      { q: '252', nome: 'Celular' },
      { q: '244', nome: 'Capacete' },
      { q: '302', nome: 'Homicídio culposo' },
    ],
  },
  drogas: {
    arquivo: 'drogas.json',
    nome: 'Drogas',
    nomeLongo: 'Lei de Drogas (11.343/2006)',
    exemplo: 'ex.: 28, 33, 35 — ou tráfico, consumo pessoal, associação',
    atalhos: [
      { q: '28', nome: 'Porte para consumo' },
      { q: '33', nome: 'Tráfico' },
      { q: '34', nome: 'Petrechos' },
      { q: '35', nome: 'Associação' },
    ],
  },
  mariapenha: {
    arquivo: 'maria-da-penha.json',
    nome: 'Maria da Penha',
    nomeLongo: 'Lei Maria da Penha (11.340/2006)',
    exemplo: 'ex.: 5, 22, 24-A — ou medidas protetivas, flagrante',
    atalhos: [
      { q: '5', nome: 'Violência doméstica' },
      { q: '7', nome: 'Formas de violência' },
      { q: '22', nome: 'Medidas protetivas' },
      { q: '24-A', nome: 'Descumprimento' },
    ],
  },
  armas: {
    arquivo: 'desarmamento.json',
    nome: 'Armas',
    nomeLongo: 'Estatuto do Desarmamento (10.826/2003)',
    exemplo: 'ex.: 12, 14, 16 — ou porte ilegal, disparo, uso restrito',
    atalhos: [
      { q: '12', nome: 'Posse irregular' },
      { q: '14', nome: 'Porte ilegal' },
      { q: '15', nome: 'Disparo' },
      { q: '16', nome: 'Uso restrito' },
    ],
  },
  abuso: {
    arquivo: 'abuso-de-autoridade.json',
    nome: 'Abuso',
    nomeLongo: 'Lei de Abuso de Autoridade (13.869/2019)',
    exemplo: 'ex.: 9, 13, 22 — ou constranger, algemas, domicílio',
    atalhos: [
      { q: '9', nome: 'Privação de liberdade' },
      { q: '13', nome: 'Constrangimento' },
      { q: '22', nome: 'Domicílio' },
      { q: '25', nome: 'Prova ilícita' },
    ],
  },
  eca: {
    arquivo: 'eca.json',
    nome: 'ECA',
    nomeLongo: 'Estatuto da Criança e do Adolescente (8.069/1990)',
    exemplo: 'ex.: 103, 106, 122 — ou ato infracional, apreensão',
    atalhos: [
      { q: '103', nome: 'Ato infracional' },
      { q: '106', nome: 'Apreensão' },
      { q: '122', nome: 'Internação' },
      { q: '244-B', nome: 'Corrupção de menores' },
    ],
  },
  idoso: {
    arquivo: 'idoso.json',
    nome: 'Pessoa Idosa',
    nomeLongo: 'Estatuto da Pessoa Idosa (10.741/2003)',
    exemplo: 'ex.: 96, 99, 107 — ou discriminar, abandono',
    atalhos: [
      { q: '96', nome: 'Discriminação' },
      { q: '99', nome: 'Expor a perigo' },
      { q: '98', nome: 'Abandono' },
    ],
  },
  orcrim: {
    arquivo: 'organizacoes-criminosas.json',
    nome: 'ORCRIM',
    nomeLongo: 'Lei de Organizações Criminosas (12.850/2013)',
    exemplo: 'ex.: 1, 2, 3-A — ou colaboração premiada, infiltração',
    atalhos: [
      { q: '1', nome: 'Definição' },
      { q: '2', nome: 'Crime de organização' },
      { q: '3-A', nome: 'Colaboração premiada' },
      { q: '10', nome: 'Infiltração' },
    ],
  },
  hediondos: {
    arquivo: 'crimes-hediondos.json',
    nome: 'Hediondos',
    nomeLongo: 'Lei dos Crimes Hediondos (8.072/1990)',
    exemplo: 'ex.: 1, 2 — ou fiança, livramento, indulto',
    atalhos: [
      { q: '1', nome: 'Rol dos hediondos' },
      { q: '2', nome: 'Fiança e regime' },
    ],
  },
  lcp: {
    arquivo: 'contravencoes.json',
    nome: 'LCP',
    nomeLongo: 'Lei das Contravenções Penais (3.688/1941)',
    exemplo: 'ex.: 21, 42, 19 — ou vias de fato, perturbação',
    atalhos: [
      { q: '21', nome: 'Vias de fato' },
      { q: '42', nome: 'Perturbação do sossego' },
      { q: '19', nome: 'Porte de arma branca' },
      { q: '65', nome: 'Perturbação da tranquilidade' },
    ],
  },
  rdpm: {
    arquivo: 'rdpm.json',
    nome: 'RDPM',
    nomeLongo: 'Regulamento Disciplinar da PMESP (LC 893/2001)',
    exemplo: 'ex.: 13, 17, 26 — ou transgressão, atrasado, uniforme',
    atalhos: [
      { q: '13', nome: 'Transgressões' },
      { q: '14', nome: 'Sanções' },
      { q: '17', nome: 'Permanência disciplinar' },
      { q: '26', nome: 'Recolhimento' },
      { q: '53', nome: 'Comportamento' },
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
