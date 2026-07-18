# Consulta de Legislação — PMSP

API e landing page de busca para a legislação de uso operacional, gerada a partir
do HTML oficial do Planalto e da ALESP. Busque por **número de artigo** ou por
**palavra**, com sugestões enquanto digita, ficha operacional das infrações de
trânsito e selos de gravidade nas transgressões disciplinares.

## Leis implementadas

| id | Norma |
|---|---|
| `cf` | Constituição Federal de 1988 (arts. 1º a 250 + ADCT completo) |
| `cp` | Código Penal — DEL 2.848/1940 |
| `cpp` | Código de Processo Penal — DEL 3.689/1941 |
| `cpm` | Código Penal Militar — DEL 1.001/1969 |
| `cppm` | Código de Processo Penal Militar — DEL 1.002/1969 |
| `ctb` | Código de Trânsito Brasileiro — Lei 9.503/1997 (com Anexo I) |
| `drogas` | Lei de Drogas — Lei 11.343/2006 |
| `mariapenha` | Lei Maria da Penha — Lei 11.340/2006 |
| `armas` | Estatuto do Desarmamento — Lei 10.826/2003 |
| `abuso` | Lei de Abuso de Autoridade — Lei 13.869/2019 |
| `eca` | Estatuto da Criança e do Adolescente — Lei 8.069/1990 |
| `idoso` | Estatuto da Pessoa Idosa — Lei 10.741/2003 |
| `orcrim` | Lei de Organizações Criminosas — Lei 12.850/2013 |
| `hediondos` | Lei dos Crimes Hediondos — Lei 8.072/1990 |
| `lcp` | Lei das Contravenções Penais — DEL 3.688/1941 |
| `rdpm` | RDPM da PMESP — LC estadual 893/2001 |

`npm test` valida as invariantes das 16 leis: **4.129 artigos ativos**, numeração
completa, sem duplicatas, sem sobras de HTML e artigos-chave com o conteúdo
esperado.

## Site publicado (GitHub Pages)

**https://luccazovedi.github.io/PMSP/**

O Pages serve a pasta **`docs/`** (Settings → Pages → `main` → `/docs`), gerada por
`npm run build-site`. Não edite `docs/` à mão — regenere com o script.

No Pages tudo é estático: a busca e as sugestões rodam no navegador (mesma lógica
do servidor, via `lib/consulta.js`) e a API vira arquivos JSON pré-gerados por lei:

- `api/index.json` — índice das leis
- `api/<id>/lei.json`, `api/<id>/estrutura.json`, `api/<id>/artigos.json`
- `api/<id>/artigos/<numero>.json` (ex.: `api/cf/artigos/ADCT-2.json`)
- `data/<arquivo>.json` — dados completos de cada lei

## Como rodar localmente

```bash
npm install
npm start          # http://localhost:3000
```

## Endpoints (servidor Node)

`:lei` = um dos ids da tabela acima.

| Rota | Descrição |
|---|---|
| `GET /api` | Metadados das leis e lista de rotas |
| `GET /api/:lei/lei` | Metadados, preâmbulo, fecho e anexos |
| `GET /api/:lei/estrutura` | Árvore Parte → Livro → Título → Capítulo → Seção → Subseção |
| `GET /api/:lei/artigos` | Todos os artigos (aceita `?limit=` e `?offset=`) |
| `GET /api/:lei/artigos/:numero` | Um artigo — aceita `121`, `165-A`, `art 121`, `ADCT-2`, `anexo-i`… |
| `GET /api/:lei/busca?q=termo` | Busca full-text sem distinção de acento/caixa |
| `GET /api/:lei/sugestoes?q=termo` | Sugestões de relacionados (as mesmas da landing page) |

Rotas sem o prefixo da lei (`/api/artigos/121`) respondem pelo Código Penal, por
compatibilidade.

## Palavras-chave

`lib/palavras-chave.js` associa os artigos mais procurados a termos populares
("lei seca" → CTB 165, "golpe" → CP 171, "medidas protetivas" → Maria da Penha
22…). Elas têm prioridade máxima na busca e nas sugestões e aparecem como
etiquetas 🔑 no artigo. O `npm test` garante que toda chave aponta para um
artigo existente.

## Campos estruturados

Além de `caput`, `paragrafo`, `inciso`, `alinea` e `pena`, o parser classifica:

- **CTB**: `infracao`, `penalidade`, `medida-administrativa` — a landing page monta
  a ficha operacional (gravidade, penalidade e providências do agente); o Anexo I
  vira o registro pesquisável `ANEXO-I`;
- **RDPM**: as 132 transgressões do art. 13 viram dispositivos `item` com selo de
  gravidade (G/M/L);
- **Leis que alteram outras normas** (ECA, Maria da Penha, Abuso, Idoso, ORCRIM,
  Hediondos): o texto citado da lei alterada vira dispositivo `citacao`, anexado ao
  artigo que faz a alteração — sem criar artigos falsos;
- **CF**: o ADCT reinicia a numeração e é indexado com o prefixo `ADCT-`.

## Fidelidade dos dados — nada fica de fora

O JSON gravado não tem duplicidade: campos de conveniência (`caput`,
`rubricas`, `texto` de busca, `textoHistorico`) são derivados dos dispositivos
na carga, por `lib/consulta.js` (`enriquecerArtigo`) — no servidor, no navegador
e nos arquivos estáticos da API. O parser preserva para todas as leis: dispositivos
completos na ordem do texto, rubricas, anotações oficiais ("Redação dada pela…",
"Revogado pela…", "Vide…", "(VETADO)"), redações históricas riscadas (marcadas
`situacao: "historico"`), preâmbulo, fecho, assinaturas, observações e anexos.
O SHA-256 de cada fonte fica registrado em `meta`.

## Atualizando quando a lei mudar

O Planalto e a ALESP bloqueiam acesso de datacenters, então o download é feito pelo
GitHub Actions: rode o workflow **"Atualizar dados do Planalto"** (aba Actions →
Run workflow). Ele baixa os HTML atuais, regera os JSON, valida, regenera `docs/`
e commita — e o Pages republica sozinho.

## Estrutura do projeto

```
data/fonte/              HTML oficial (fonte da verdade, versionada)
data/*.json              dados estruturados gerados (não editar à mão)
lib/leis.js              registro central das leis
lib/consulta.js          busca, sugestões e derivação de campos (servidor e navegador)
lib/palavras-chave.js    termos populares associados aos artigos famosos
scripts/build-data.js    parser HTML → JSON (multi-lei, multi-formato)
scripts/validate-data.js validação de integridade (npm test)
scripts/build-site.js    gera o site estático em docs/ (npm run build-site)
server/index.js          API Express + arquivos estáticos
public/                  landing page (HTML/CSS/JS puro, sem framework)
docs/                    site estático publicado no GitHub Pages (gerado)
```

## Avisos

- Este projeto não substitui os textos oficiais publicados no Diário Oficial.
- A ficha operacional reproduz exatamente o que a lei comina; não é orientação
  procedimental além do texto legal.
- O texto das leis é dado público (art. 8º, I, da Lei 9.610/98 exclui atos oficiais
  de proteção autoral).
