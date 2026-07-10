# Consulta de Legislação — CP, CPP, CTB e RDPM

API e landing page de busca para o **Código Penal** (DEL 2.848/1940), o **Código
de Processo Penal** (DEL 3.689/1941), o **Código de Trânsito Brasileiro**
(Lei 9.503/1997) e o **RDPM da PMESP** (LC estadual 893/2001), gerados a partir
do HTML oficial do Planalto e da ALESP. Busque por **número de artigo** ou por **palavra**; no CTB,
cada artigo de infração exibe uma **ficha operacional** com gravidade, penalidade
e medidas administrativas (as providências a cargo do agente de fiscalização).

## Site publicado (GitHub Pages)

**https://luccazovedi.github.io/PMSP/**

O Pages serve a pasta **`docs/`** (Settings → Pages → Deploy from a branch → `main` → `/docs`),
gerada por `npm run build-site`. Não edite `docs/` à mão — regenere com o script.

No Pages tudo é estático: a busca e as sugestões rodam no navegador (mesma lógica do
servidor, via `lib/consulta.js`) e a API vira arquivos JSON pré-gerados por lei:

- `api/index.json` — índice das leis
- `api/cp/lei.json`, `api/cp/estrutura.json`, `api/cp/artigos.json`, `api/cp/artigos/121.json`, …
- `api/cpp/artigos/301.json`, `api/cpp/estrutura.json`, …
- `api/ctb/lei.json` (inclui os anexos), `api/ctb/artigos/165.json`, `api/ctb/artigos/ANEXO-I.json`, …
- `api/rdpm/lei.json`, `api/rdpm/artigos/13.json`, …
- `data/codigo-penal.json`, `data/cpp.json`, `data/ctb.json` e `data/rdpm.json` (dados completos)

## Como rodar localmente

```bash
npm install
npm start          # http://localhost:3000
```

- `http://localhost:3000/` — landing page de busca
- `http://localhost:3000/api` — documentação viva da API

## Endpoints (servidor Node)

`:lei` = `cp` (Código Penal), `cpp` (Código de Processo Penal), `ctb` (Código de
Trânsito Brasileiro) ou `rdpm` (Regulamento Disciplinar da PMESP).

| Rota | Descrição |
|---|---|
| `GET /api` | Metadados das leis e lista de rotas |
| `GET /api/:lei/lei` | Metadados, preâmbulo, fecho e anexos |
| `GET /api/:lei/estrutura` | Árvore Parte → Título → Capítulo → Seção com os artigos |
| `GET /api/:lei/artigos` | Todos os artigos (aceita `?limit=` e `?offset=`) |
| `GET /api/:lei/artigos/:numero` | Um artigo — aceita `121`, `165-A`, `art 121`, `anexo-i`… |
| `GET /api/:lei/busca?q=termo` | Busca full-text sem distinção de acento/caixa |
| `GET /api/:lei/sugestoes?q=termo` | Sugestões de relacionados (as mesmas da landing page) |

Rotas sem o prefixo da lei (`/api/artigos/121`) continuam respondendo pelo Código
Penal, por compatibilidade.

### Campos estruturados do CTB

Além de `caput`, `paragrafo`, `inciso`, `alinea` e `pena`, os dispositivos do CTB
são classificados como `infracao`, `penalidade` e `medida-administrativa` — é disso
que a landing page monta a ficha operacional (gravidade da infração, penalidade e
providências do agente). O Anexo I (conceitos e definições) vira o registro
pesquisável `ANEXO-I`.

No RDPM, as 132 transgressões do art. 13 viram dispositivos `item`, e a landing
page exibe a gravidade de cada uma — (G) grave, (M) média, (L) leve — como selo.

## Fidelidade dos dados — nada fica de fora

O JSON é gerado por `scripts/build-data.js` diretamente do HTML oficial do Planalto
(cópias versionadas em `data/fonte/`), preservando, para as duas leis:

- todos os artigos (CP: arts. 1º a 361; CPP: arts. 1º a 811; CTB: arts. 1º a 341
  mais o Anexo I; RDPM: arts. 1º a 89 — incluindo sufixados como 121-A e 3-B);
- os dispositivos completos na ordem do texto oficial;
- as rubricas (nomes marginais), as anotações oficiais ("Redação dada pela…",
  "Incluído pela…", "Revogado pela…", "Vide…", "(VETADO)");
- as redações históricas riscadas (marcadas `situacao: "historico"`);
- preâmbulo, fecho, assinaturas, observações de publicação e anexos.

`npm test` valida as invariantes das duas leis (cobertura completa da numeração,
sem duplicatas, sem sobras de HTML, artigos-chave com o conteúdo esperado e
contagens mínimas de infrações/penalidades/medidas no CTB).

## Atualizando quando a lei mudar

O Planalto e a ALESP bloqueiam/limitam acesso de datacenters, então o download é feito pelo GitHub
Actions: rode o workflow **"Atualizar dados do Planalto"** (aba Actions → Run
workflow). Ele baixa os HTML atuais, regera os JSON, valida, regenera `docs/` e
commita — e o Pages republica sozinho.

## Estrutura do projeto

```
data/fonte/              HTML oficial do Planalto (fonte da verdade, versionada)
data/codigo-penal.json   dados estruturados do CP (gerado — não editar à mão)
data/cpp.json            dados estruturados do CPP (gerado)
data/ctb.json            dados estruturados do CTB (gerado)
data/rdpm.json           dados estruturados do RDPM (gerado)
scripts/build-data.js    parser HTML → JSON (multi-lei)
scripts/validate-data.js validação de integridade (npm test)
scripts/build-site.js    gera o site estático em docs/ (npm run build-site)
server/index.js          API Express + arquivos estáticos
public/                  landing page (HTML/CSS/JS puro, sem framework)
lib/consulta.js          busca e sugestões compartilhadas (servidor e navegador)
docs/                    site estático publicado no GitHub Pages (gerado)
```

## Avisos

- Este projeto não substitui os textos oficiais publicados no DOU nem o site do
  Planalto.
- A ficha operacional reproduz exatamente o que a lei comina (infração, penalidade,
  medida administrativa); não é orientação procedimental além do texto legal.
- O texto das leis é dado público (art. 8º, I, da Lei 9.610/98 exclui atos oficiais
  de proteção autoral).
