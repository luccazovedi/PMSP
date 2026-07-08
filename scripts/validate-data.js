/**
 * Valida a integridade de data/codigo-penal.json.
 * Roda com `npm test`. Falha (exit 1) se qualquer invariante for violada.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dados = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'codigo-penal.json'), 'utf8'),
);

const erros = [];
const ok = (cond, msg) => { if (!cond) erros.push(msg); };

const artigos = dados.artigos;
const ativos = artigos.filter((a) => a.situacao !== 'historico');
const numeros = new Set(ativos.map((a) => a.numero));

// 1. Todos os números-base de 1 a 361 existem (o Código vai do art. 1º ao 361)
for (let n = 1; n <= 361; n++) {
  ok(numeros.has(String(n)), `artigo ${n} ausente`);
}

// 2. Sem numeração duplicada entre vigentes/revogados
const vistos = new Set();
for (const a of ativos) {
  ok(!vistos.has(a.numero), `artigo ${a.numero} duplicado`);
  vistos.add(a.numero);
}

// 3. Artigos-chave com conteúdo esperado (guardas contra regressão do parser)
const porNumero = new Map(artigos.map((a) => [a.numero, a]));
const contem = (num, trecho) =>
  ok(porNumero.get(num)?.texto.toLowerCase().includes(trecho.toLowerCase()),
    `art. ${num} deveria conter "${trecho}"`);

contem('1', 'Não há crime sem lei anterior');
contem('121', 'Matar alguem');
contem('121', 'arma de fogo de uso restrito');   // § 2º, VIII (Lei 13.964/2019)
contem('121-A', 'Matar mulher');                  // feminicídio (Lei 14.994/2024)
contem('146-A', 'Intimidar sistematicamente');    // bullying (Lei 14.811/2024)
contem('155', 'Subtrair, para si ou para outrem');
contem('157', 'grave ameaça');
contem('171', 'vantagem ilícita');
contem('213', 'conjunção carnal');
contem('312', 'Apropriar-se o funcionário público');
contem('361', '1º de janeiro de 1942');

// 4. Sem sobras de HTML nos textos
for (const a of artigos) {
  const t = a.texto + (a.textoHistorico || '');
  ok(!/[<>]|&[a-zA-Z]+;/.test(t), `art. ${a.numero} contém sobras de HTML`);
}

// 5. Todo artigo ativo tem dispositivo e hierarquia com pelo menos a Parte
for (const a of ativos) {
  ok(a.dispositivos.length > 0, `art. ${a.numero} sem dispositivos`);
  ok(a.hierarquia && a.hierarquia.parte, `art. ${a.numero} sem Parte na hierarquia`);
}

// 6. Estrutura fecha com a lista de artigos
const contar = (no) =>
  (no.artigos?.length || 0) + (no.filhos || []).reduce((s, f) => s + contar(f), 0);
ok(contar(dados.estrutura) === ativos.length,
  `estrutura tem ${contar(dados.estrutura)} artigos, esperado ${ativos.length}`);

// 7. Metadados e molduras do decreto
ok(dados.preambulo.includes('PRESIDENTE DA REPÚBLICA'), 'preâmbulo ausente');
ok(dados.fecho.texto.some((t) => t.includes('7 de dezembro de 1940')), 'fecho ausente');
ok(dados.meta.fonte.includes('planalto.gov.br'), 'fonte ausente nos metadados');

if (erros.length) {
  console.error(`FALHOU: ${erros.length} problema(s):`);
  for (const e of erros) console.error(' -', e);
  process.exit(1);
}
console.log(`OK: ${ativos.length} artigos ativos validados (${artigos.length} registros no total).`);
