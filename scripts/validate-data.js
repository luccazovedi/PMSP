/**
 * Valida a integridade de data/codigo-penal.json e data/ctb.json.
 * Roda com `npm test`. Falha (exit 1) se qualquer invariante for violada.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarConsulta } from '../lib/consulta.js';
import { PALAVRAS_CHAVE } from '../lib/palavras-chave.js';
import { REGISTRO_LEIS } from '../lib/leis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');

const ARQUIVO_PARA_ID = Object.fromEntries(
  Object.entries(REGISTRO_LEIS).map(([id, cfg]) => [cfg.arquivo, id]),
);

const REGRAS = [
  {
    arquivo: 'cf.json',
    ultimoArtigo: 250,
    preambuloContem: 'representantes do povo brasileiro',
    fechoContem: '5 de outubro de 1988',
    conteudos: [
      ['1', 'fundamentos'],
      ['5', 'Todos são iguais perante a lei'],
      ['37', 'legalidade, impessoalidade, moralidade'],
      ['144', 'segurança pública'],
      ['144', 'polícias militares'],
      ['ADCT-2', 'plebiscito'],
    ],
    extras: (dados) => {
      const erros = [];
      const adct = dados.artigos.filter((a) => a.numero.startsWith('ADCT-'));
      if (adct.length < 100) erros.push(`cf: ADCT com apenas ${adct.length} artigos`);
      return erros;
    },
  },
  {
    arquivo: 'cppm.json',
    ultimoArtigo: 711,
    preambuloContem: 'Ministros da Marinha',
    fechoContem: '21 de outubro de 1969',
    conteudos: [
      ['8', 'polícia judiciária militar'],
      ['243', 'flagrante delito'],
      ['244', 'flagrante'],
    ],
    extras: () => [],
  },
  {
    arquivo: 'drogas.json',
    ultimoArtigo: 75,
    fechoContem: '23 de agosto de 2006',
    conteudos: [
      ['28', 'consumo pessoal'],
      ['33', 'Importar, exportar'],
      ['35', 'Associarem-se duas ou mais pessoas'],
    ],
    extras: () => [],
  },
  {
    arquivo: 'maria-da-penha.json',
    ultimoArtigo: 46,
    fechoContem: '7 de agosto de 2006',
    conteudos: [
      ['5', 'violência doméstica e familiar contra a mulher'],
      ['22', 'medidas protetivas'],
      ['24-A', 'Descumprir decisão judicial'],
    ],
    extras: () => [],
  },
  {
    arquivo: 'desarmamento.json',
    ultimoArtigo: 37,
    fechoContem: '22 de dezembro de 2003',
    conteudos: [
      ['12', 'Possuir ou manter sob sua guarda'],
      ['14', 'Portar, deter, adquirir'],
      ['16', 'uso restrito'],
    ],
    extras: () => [],
  },
  {
    arquivo: 'abuso-de-autoridade.json',
    ultimoArtigo: 45,
    fechoContem: '5 de setembro de 2019',
    conteudos: [
      ['9', 'privação da liberdade'],
      ['13', 'Constranger o preso'],
      ['22', 'imóvel alheio'],
    ],
    extras: () => [],
  },
  {
    arquivo: 'eca.json',
    ultimoArtigo: 267,
    fechoContem: '13 de julho de 1990',
    conteudos: [
      ['2', 'doze anos de idade incompletos'],
      ['103', 'ato infracional'],
      ['106', 'flagrante'],
      ['122', 'internação'],
    ],
    extras: () => [],
  },
  {
    arquivo: 'idoso.json',
    ultimoArtigo: 118,
    fechoContem: '1o de outubro de 2003',
    conteudos: [
      ['1', 'igual ou superior a 60'],
      ['96', 'Discriminar pessoa idosa'],
      ['99', 'Expor a perigo'],
    ],
    extras: () => [],
  },
  {
    arquivo: 'organizacoes-criminosas.json',
    ultimoArtigo: 27,
    fechoContem: '2 de agosto de 2013',
    conteudos: [
      ['1', '4 (quatro) ou mais pessoas'],
      ['2', 'Promover, constituir, financiar'],
      ['3-A', 'colaboração premiada'],
    ],
    extras: () => [],
  },
  {
    arquivo: 'crimes-hediondos.json',
    ultimoArtigo: 9,
    fechoContem: '25 de julho de 1990',
    conteudos: [
      ['1', 'hediondos'],
      ['2', 'anistia, graça e indulto'],
    ],
    extras: () => [],
  },
  {
    arquivo: 'contravencoes.json',
    ultimoArtigo: 70,
    fechoContem: '3 de outubro de 1941',
    conteudos: [
      ['21', 'vias de fato'],
      ['42', 'sossego'],
    ],
    extras: () => [],
  },
  {
    arquivo: 'codigo-penal.json',
    ultimoArtigo: 361,
    fechoContem: '7 de dezembro de 1940',
    conteudos: [
      ['1', 'Não há crime sem lei anterior'],
      ['121', 'Matar alguem'],
      ['121', 'arma de fogo de uso restrito'],   // § 2º, VIII (Lei 13.964/2019)
      ['121-A', 'Matar mulher'],                 // feminicídio (Lei 14.994/2024)
      ['146-A', 'Intimidar sistematicamente'],   // bullying (Lei 14.811/2024)
      ['155', 'Subtrair, para si ou para outrem'],
      ['157', 'grave ameaça'],
      ['171', 'vantagem ilícita'],
      ['213', 'conjunção carnal'],
      ['312', 'Apropriar-se o funcionário público'],
      ['361', '1º de janeiro de 1942'],
    ],
    extras: () => [],
  },
  {
    arquivo: 'cpp.json',
    ultimoArtigo: 811,
    fechoContem: '3 de outubro de 1941',
    conteudos: [
      ['1', 'processo penal reger-se-á'],
      ['5', 'inquérito policial'],
      ['244', 'busca pessoal'],
      ['282', 'medidas cautelares'],
      ['301', 'Qualquer do povo poderá'],
      ['302', 'flagrante delito'],
      ['310', 'audiência de custódia'],
      ['810', 'janeiro de 1942'],
      ['811', 'Revogam-se'],
    ],
    extras: () => [],
  },
  {
    arquivo: 'cpm.json',
    ultimoArtigo: 410,
    preambuloContem: 'Ministros da Marinha',
    fechoContem: '21 de outubro de 1969',
    conteudos: [
      ['9', 'crimes militares, em tempo de paz'],
      ['187', 'Ausentar-se'],           // deserção
      ['195', 'Abandonar'],             // abandono de posto
      ['202', 'embriaguez'],            // embriaguez em serviço
      ['205', 'Matar alguém'],          // homicídio
      ['303', 'Apropriar-se'],          // peculato
    ],
    extras: () => [],
  },
  {
    arquivo: 'rdpm.json',
    ultimoArtigo: 89,
    preambuloContem: 'GOVERNADOR DO ESTADO',
    fechoContem: '09 de março de 2001',
    conteudos: [
      ['1', 'hierarquia e a disciplina'],
      ['12', 'Transgressão disciplinar'],
      ['13', 'usar de força desnecessária'],
      ['13', 'classificadas de acordo com sua gravidade'],
      ['17', 'permanência disciplinar'],
      ['26', 'recolhimento'],
      ['53', 'comportamento'],
    ],
    extras: (dados) => {
      const erros = [];
      const a13 = dados.artigos.find((a) => a.numero === '13');
      const itens = a13 ? a13.dispositivos.filter((d) => d.tipo === 'item' && d.situacao === 'vigente').length : 0;
      if (itens < 100) erros.push(`RDPM: art. 13 com apenas ${itens} transgressões classificadas (esperado 100+)`);
      return erros;
    },
  },
  {
    arquivo: 'ctb.json',
    ultimoArtigo: 341,
    fechoContem: '23 de setembro de 1997',
    conteudos: [
      ['1', 'O trânsito de qualquer natureza'],
      ['165', 'álcool'],
      ['165', 'Medida administrativa'],
      ['244', 'capacete'],
      ['302', 'homicídio culposo'],
      ['306', 'capacidade psicomotora'],
      ['ANEXO-I', 'CONCEITOS E DEFINIÇÕES'],
    ],
    extras: (dados) => {
      const erros = [];
      const conta = (tipo) =>
        dados.artigos.reduce(
          (s, a) => s + a.dispositivos.filter((d) => d.situacao === 'vigente' && d.tipo === tipo).length,
          0,
        );
      if (conta('infracao') < 100) erros.push('CTB: menos de 100 dispositivos de infração classificados');
      if (conta('penalidade') < 100) erros.push('CTB: menos de 100 penalidades classificadas');
      if (conta('medida-administrativa') < 50) erros.push('CTB: menos de 50 medidas administrativas classificadas');
      return erros;
    },
  },
];

const erros = [];
const ok = (cond, msg) => { if (!cond) erros.push(msg); };
let totalAtivos = 0;

for (const regra of REGRAS) {
  const rotulo = regra.arquivo.replace('.json', '');
  const dados = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', regra.arquivo), 'utf8'));
  const leiId = ARQUIVO_PARA_ID[regra.arquivo];
  const chaves = PALAVRAS_CHAVE[leiId] || {};
  // deriva caput/rubricas/texto dos dispositivos (não gravados no JSON)
  criarConsulta(dados, chaves);
  const artigos = dados.artigos;

  // Toda palavra-chave precisa apontar para um artigo existente
  const numerosExistentes = new Set(artigos.map((a) => String(a.numero)));
  for (const numero of Object.keys(chaves)) {
    ok(numerosExistentes.has(String(numero)),
      `${rotulo}: palavra-chave aponta para artigo inexistente "${numero}"`);
  }
  const ativos = artigos.filter((a) => a.situacao !== 'historico');
  totalAtivos += ativos.length;
  const numeros = new Set(ativos.map((a) => a.numero));

  // 1. Todos os números-base existem
  for (let n = 1; n <= regra.ultimoArtigo; n++) {
    ok(numeros.has(String(n)), `${rotulo}: artigo ${n} ausente`);
  }

  // 2. Sem numeração duplicada entre ativos
  const vistos = new Set();
  for (const a of ativos) {
    ok(!vistos.has(a.numero), `${rotulo}: artigo ${a.numero} duplicado`);
    vistos.add(a.numero);
  }

  // 3. Artigos-chave com conteúdo esperado
  const porNumero = new Map(artigos.map((a) => [a.numero, a]));
  for (const [num, trecho] of regra.conteudos) {
    ok(porNumero.get(num)?.texto.toLowerCase().includes(trecho.toLowerCase()),
      `${rotulo}: art. ${num} deveria conter "${trecho}"`);
  }

  // 4. Sem sobras de HTML nos textos
  for (const a of artigos) {
    const t = a.texto + (a.textoHistorico || '');
    ok(!/[<>]|&[a-zA-Z]+;/.test(t), `${rotulo}: art. ${a.numero} contém sobras de HTML`);
  }

  // 5. Todo artigo ativo tem dispositivos
  for (const a of ativos) {
    ok(a.dispositivos.length > 0, `${rotulo}: art. ${a.numero} sem dispositivos`);
  }

  // 6. Estrutura fecha com a lista de artigos
  const contar = (no) =>
    (no.artigos?.length || 0) + (no.filhos || []).reduce((s, f) => s + contar(f), 0);
  ok(contar(dados.estrutura) === ativos.length,
    `${rotulo}: estrutura tem ${contar(dados.estrutura)} artigos, esperado ${ativos.length}`);

  // 7. Metadados e molduras
  ok(dados.preambulo.toLowerCase().includes((regra.preambuloContem || 'president').toLowerCase()),
    `${rotulo}: preâmbulo ausente`);
  ok(dados.fecho.texto.some((t) => t.includes(regra.fechoContem)), `${rotulo}: fecho ausente`);
  ok(/planalto\.gov\.br|al\.sp\.gov\.br/.test(dados.meta.fonte), `${rotulo}: fonte ausente nos metadados`);

  erros.push(...regra.extras(dados));
}

if (erros.length) {
  console.error(`FALHOU: ${erros.length} problema(s):`);
  for (const e of erros) console.error(' -', e);
  process.exit(1);
}
console.log(`OK: ${totalAtivos} artigos ativos validados nas ${REGRAS.length} leis.`);
