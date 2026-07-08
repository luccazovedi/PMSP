/* Landing page de consulta ao Código Penal — consome a API local (/api). */

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
  if (d.tipo === 'caput' && d.rotuloArtigo) {
    const b = el('strong', null, d.rotuloArtigo + ' ');
    p.appendChild(b);
  }
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
// Renderização dos resultados de busca textual
// ---------------------------------------------------------------------------

function renderResultadoBusca(r, termo) {
  const cartao = el('article', 'cartao');

  const titulo = el('h2');
  titulo.appendChild(el('span', null, r.rotulo));
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
  botao.addEventListener('click', async () => {
    const resposta = await fetch(`/api/artigos/${encodeURIComponent(r.numero)}`);
    const artigo = await resposta.json();
    cartao.replaceWith(renderArtigo(artigo, termo));
  });
  acoes.appendChild(botao);
  cartao.appendChild(acoes);

  return cartao;
}

// ---------------------------------------------------------------------------
// Busca
// ---------------------------------------------------------------------------

async function buscar(consulta) {
  resumo.textContent = 'Buscando…';
  resultados.replaceChildren();

  try {
    const resposta = await fetch(`/api/busca?q=${encodeURIComponent(consulta)}`);
    const dados = await resposta.json();

    if (!resposta.ok) {
      resumo.textContent = dados.erro || 'Erro na busca.';
      return;
    }

    if (dados.tipo === 'artigo') {
      resumo.textContent = `Artigo encontrado para “${consulta}”.`;
      resultados.appendChild(renderArtigo(dados.resultados[0], null));
      return;
    }

    if (dados.total === 0) {
      resumo.textContent = '';
      resultados.appendChild(el('p', 'vazio',
        `Nenhum artigo contém “${consulta}”. Tente outra palavra ou um número de artigo.`));
      return;
    }

    resumo.textContent = `${dados.total} artigo(s) mencionam “${consulta}”.`;
    for (const r of dados.resultados) {
      resultados.appendChild(renderResultadoBusca(r, consulta));
    }
  } catch (erro) {
    resumo.textContent = 'Não foi possível consultar a API. O servidor está no ar?';
  }
}

form.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const consulta = campo.value.trim();
  if (consulta) buscar(consulta);
});

// Rodapé com metadados da fonte
fetch('/api/lei')
  .then((r) => r.json())
  .then(({ meta }) => {
    const data = new Date(meta.geradoEm).toLocaleDateString('pt-BR');
    infoFonte.textContent =
      `${meta.lei} · dados extraídos do texto oficial do Planalto em ${data}. ` +
      'Este site não substitui o texto publicado no DOU.';
  })
  .catch(() => {});
