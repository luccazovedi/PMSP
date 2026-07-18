/**
 * Lógica de consulta ao Código Penal, compartilhada entre o servidor Express
 * e o navegador (landing page estática do GitHub Pages).
 */

/** Remove acentos e normaliza caixa para busca insensível a acentuação. */
export function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Normaliza um número de artigo digitado pelo usuário: "121", "art 121",
 * "Art. 121-A", "121a", "1º" etc. -> chave canônica como "121" ou "121-A".
 * Devolve null se a entrada não parece um número de artigo.
 */
export function chaveArtigo(entrada) {
  const s = normalizar(String(entrada))
    .replace(/^art(igo)?\.?\s*/i, '')
    .replace(/[ºo°]\s*$/, '')
    .trim();
  const m = s.match(/^(\d+)\s*[-.\s]?\s*([a-z])?$/i);
  if (!m) return null;
  return m[2] ? `${m[1]}-${m[2].toUpperCase()}` : m[1];
}

/**
 * Deriva dos dispositivos os campos de conveniência (caput, rubricas, texto de
 * busca) que não são gravados no JSON — evita duplicidade de informação nos
 * dados e mantém a mesma interface para API e páginas.
 */
export function enriquecerArtigo(artigo, palavrasChave) {
  if (artigo.texto === undefined) {
    const vigentes = [];
    const rubricas = [];
    for (const d of artigo.dispositivos) {
      if (d.situacao !== 'vigente') continue;
      if (d.tipo === 'rubrica' && d.texto) rubricas.push(d.texto);
      if (d.texto) vigentes.push(d.tipo === 'caput' ? `${artigo.rotulo} ${d.texto}` : d.texto);
      vigentes.push(...(d.notas || []));
    }
    const antigos = [];
    for (const d of [...artigo.dispositivos, ...(artigo.versoesAnteriores || [])]) {
      if (d.situacao !== 'historico') continue;
      if (d.texto) antigos.push(d.texto);
      antigos.push(...(d.notas || []));
    }
    artigo.texto = vigentes.join('\n');
    artigo.textoHistorico = antigos.join('\n');
    artigo.rubricas = rubricas;
    artigo.caput = (artigo.dispositivos.find((d) => d.tipo === 'caput' && d.situacao === 'vigente') || {}).texto || null;
  }
  if (artigo.palavrasChave === undefined) {
    artigo.palavrasChave = palavrasChave || [];
  }
  return artigo;
}

/**
 * Cria o mecanismo de consulta sobre os dados carregados de uma lei.
 * `palavrasChave` associa números de artigo a termos populares (opcional).
 */
export function criarConsulta(lei, palavrasChave = {}) {
  const porNumero = new Map();
  for (const artigo of lei.artigos) {
    enriquecerArtigo(artigo, palavrasChave[artigo.numero]);
    porNumero.set(artigo.numero.toUpperCase(), artigo);
  }

  const indice = lei.artigos.map((artigo) => ({
    artigo,
    textoNorm: normalizar(artigo.texto),
    rubricasNorm: normalizar(artigo.rubricas.join(' ')),
    chavesNorm: normalizar((artigo.palavrasChave || []).join(' | ')),
  }));

  function artigo(numeroOuEntrada) {
    const chave = chaveArtigo(numeroOuEntrada);
    if (chave && porNumero.has(chave)) return porNumero.get(chave);
    // Registros especiais, como "ANEXO-I"
    const direto = String(numeroOuEntrada).trim().toUpperCase().replace(/\s+/g, '-');
    return porNumero.get(direto) || null;
  }

  function buscar(consulta) {
    const q = String(consulta || '').trim();

    // 1) Consulta que parece número de artigo devolve o artigo direto
    const direto = artigo(q);
    if (direto) {
      return { tipo: 'artigo', consulta: q, total: 1, resultados: [direto] };
    }

    // 2) Busca full-text (insensível a acentos e caixa)
    const termo = normalizar(q);
    const resultados = [];
    for (const { artigo: art, textoNorm, rubricasNorm, chavesNorm } of indice) {
      const emChave = chavesNorm.includes(termo);
      const emRubrica = rubricasNorm.includes(termo);
      const posicao = textoNorm.indexOf(termo);
      if (!emChave && !emRubrica && posicao === -1) continue;

      // Trechos com contexto: até 3 ocorrências por artigo
      const trechos = [];
      let idx = posicao;
      while (idx !== -1 && trechos.length < 3) {
        const ini = Math.max(0, idx - 80);
        const fim = Math.min(art.texto.length, idx + termo.length + 80);
        trechos.push({
          trecho:
            (ini > 0 ? '…' : '') +
            art.texto.slice(ini, fim) +
            (fim < art.texto.length ? '…' : ''),
          posicao: idx,
        });
        idx = textoNorm.indexOf(termo, idx + termo.length);
      }

      let ocorrencias = (emRubrica ? 1 : 0) + (emChave ? 5 : 0); // chave pesa mais
      for (let i = textoNorm.indexOf(termo); i !== -1; i = textoNorm.indexOf(termo, i + termo.length)) {
        ocorrencias++;
      }

      if (emChave && !trechos.length) {
        const chave = (art.palavrasChave || []).find((c) => normalizar(c).includes(termo));
        trechos.push({ trecho: `Palavra-chave: ${chave}`, posicao: -1 });
      }

      resultados.push({
        numero: art.numero,
        rotulo: art.rotulo,
        situacao: art.situacao,
        rubricas: art.rubricas,
        palavrasChave: art.palavrasChave,
        hierarquia: art.hierarquia,
        ocorrencias,
        trechos,
      });
    }

    resultados.sort((a, b) => b.ocorrencias - a.ocorrencias);
    return { tipo: 'texto', consulta: q, total: resultados.length, resultados };
  }

  /**
   * Sugestões rápidas ("relacionados") para exibir enquanto o usuário digita.
   * Prioridade: número do artigo > rubrica que começa pelo termo > rubrica que
   * contém o termo > texto que contém o termo (ordenado por ocorrências).
   */
  function sugerir(consulta, limite = 8) {
    const q = String(consulta || '').trim();
    if (q.length < 1) return [];
    const termo = normalizar(q);

    const resumo = (art) => ({
      numero: art.numero,
      rotulo: art.rotulo,
      situacao: art.situacao,
      rubricas: art.rubricas,
      descricao: art.rubricas[0] || (art.caput ? art.caput.slice(0, 90) : ''),
    });

    // Termo numérico: sugere artigos cujo número começa pelos dígitos digitados
    const soNumero = termo.match(/^(?:art(?:igo)?\.?\s*)?(\d+)\s*-?\s*([a-z])?$/i);
    if (soNumero) {
      const prefixo = soNumero[1];
      const sufixo = (soNumero[2] || '').toUpperCase();
      const exatos = [];
      const comecam = [];
      for (const { artigo: art } of indice) {
        const [base, letra] = art.numero.split('-');
        if (base === prefixo && (!sufixo || (letra || '').startsWith(sufixo))) exatos.push(resumo(art));
        else if (!sufixo && base.startsWith(prefixo)) comecam.push(resumo(art));
      }
      comecam.sort((a, b) => parseInt(a.numero, 10) - parseInt(b.numero, 10) || a.numero.localeCompare(b.numero));
      return [...exatos, ...comecam].slice(0, limite);
    }

    if (termo.length < 2) return [];

    // Correspondência no INÍCIO de palavra vale mais: evita que "arma" traga
    // "farmacêutica" antes dos artigos sobre armas.
    const escapado = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reInicioPalavra = new RegExp(`(^|[^a-z0-9])${escapado}`);

    // palavra-chave | rubrica começa pelo termo | palavra da rubrica | palavra do texto | substring
    const grupos = [[], [], [], [], []];
    for (const { artigo: art, textoNorm, rubricasNorm, chavesNorm } of indice) {
      const daRubrica = () => ({
        ...resumo(art),
        descricao: art.rubricas.find((r) => normalizar(r).includes(termo)) || art.rubricas[0] || '',
      });
      if (reInicioPalavra.test(chavesNorm)) {
        const chave = (art.palavrasChave || []).find((c) => reInicioPalavra.test(normalizar(c)));
        grupos[0].push({ ...resumo(art), descricao: `🔑 ${chave}` });
        continue;
      }
      if (art.rubricas.some((r) => normalizar(r).startsWith(termo))) {
        grupos[1].push(daRubrica());
        continue;
      }
      if (reInicioPalavra.test(rubricasNorm)) {
        grupos[2].push(daRubrica());
        continue;
      }
      const m = reInicioPalavra.exec(textoNorm);
      const pos = m ? m.index + m[1].length : textoNorm.indexOf(termo);
      if (pos !== -1) {
        const ini = Math.max(0, pos - 30);
        grupos[m ? 3 : 4].push({
          ...resumo(art),
          descricao: (ini > 0 ? '…' : '') + art.texto.slice(ini, pos + termo.length + 60).replace(/\n/g, ' ') + '…',
        });
        continue;
      }
      if (rubricasNorm.includes(termo)) grupos[4].push(daRubrica());
    }
    return grupos.flat().slice(0, limite);
  }

  return { artigo, buscar, sugerir };
}
