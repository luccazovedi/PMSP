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
 * Cria o mecanismo de consulta sobre os dados carregados de codigo-penal.json.
 */
export function criarConsulta(lei) {
  const porNumero = new Map();
  for (const artigo of lei.artigos) {
    porNumero.set(artigo.numero.toUpperCase(), artigo);
  }

  const indice = lei.artigos.map((artigo) => ({
    artigo,
    textoNorm: normalizar(artigo.texto),
    rubricasNorm: normalizar(artigo.rubricas.join(' ')),
  }));

  function artigo(numeroOuEntrada) {
    const chave = chaveArtigo(numeroOuEntrada);
    return (chave && porNumero.get(chave)) || null;
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
    for (const { artigo: art, textoNorm, rubricasNorm } of indice) {
      const emRubrica = rubricasNorm.includes(termo);
      const posicao = textoNorm.indexOf(termo);
      if (!emRubrica && posicao === -1) continue;

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

      let ocorrencias = emRubrica ? 1 : 0;
      for (let i = textoNorm.indexOf(termo); i !== -1; i = textoNorm.indexOf(termo, i + termo.length)) {
        ocorrencias++;
      }

      resultados.push({
        numero: art.numero,
        rotulo: art.rotulo,
        situacao: art.situacao,
        rubricas: art.rubricas,
        hierarquia: art.hierarquia,
        ocorrencias,
        trechos,
      });
    }

    resultados.sort((a, b) => b.ocorrencias - a.ocorrencias);
    return { tipo: 'texto', consulta: q, total: resultados.length, resultados };
  }

  return { artigo, buscar };
}
