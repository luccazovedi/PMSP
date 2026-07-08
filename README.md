# Código Penal — API + Landing Page

API REST do **Código Penal brasileiro** (Decreto-Lei nº 2.848, de 7 de dezembro de 1940),
gerada a partir do HTML oficial do Planalto
([del2848.htm](https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848.htm)),
com uma landing page simples para buscar por **número de artigo** ou por **palavra**.

## Como rodar

```bash
npm install
npm start          # http://localhost:3000
```

- `http://localhost:3000/` — landing page de busca
- `http://localhost:3000/api` — documentação viva da API

## Endpoints

| Rota | Descrição |
|---|---|
| `GET /api` | Metadados e lista de rotas |
| `GET /api/lei` | Metadados da lei, preâmbulo e fecho (data e assinaturas) |
| `GET /api/estrutura` | Árvore Parte → Título → Capítulo → Seção com os artigos de cada nível |
| `GET /api/artigos` | Todos os artigos (aceita `?limit=` e `?offset=`) |
| `GET /api/artigos/:numero` | Um artigo — aceita `121`, `121-A`, `art 121`, `Art. 121-a`… |
| `GET /api/busca?q=termo` | Busca full-text sem distinção de acento/caixa; se `q` for um número de artigo, devolve o artigo direto |

### Formato de um artigo

```jsonc
{
  "numero": "121",
  "rotulo": "Art. 121",
  "situacao": "vigente",            // vigente | revogado
  "rubricas": ["Homicídio simples", "Homicídio qualificado", ...],
  "caput": "Matar alguem:",
  "hierarquia": {
    "parte":    { "rotulo": "PARTE ESPECIAL", "nome": null },
    "titulo":   { "rotulo": "TÍTULO I", "nome": "DOS CRIMES CONTRA A PESSOA" },
    "capitulo": { "rotulo": "CAPÍTULO I", "nome": "DOS CRIMES CONTRA A VIDA" }
  },
  "dispositivos": [                  // TUDO, na ordem do texto oficial
    {
      "tipo": "caput",               // caput | paragrafo | inciso | alinea | pena | rubrica | texto | anotacao
      "situacao": "vigente",         // vigente | historico (texto riscado no Planalto)
      "texto": "Matar alguem:",
      "notas": ["(Redação dada pela Lei nº ...)"]  // anotações oficiais do Planalto
    }
  ],
  "versoesAnteriores": [...],        // redações antigas riscadas, quando houver
  "texto": "...",                    // texto vigente concatenado (para busca)
  "textoHistorico": "..."            // redações históricas concatenadas
}
```

## Fidelidade dos dados — nada fica de fora

O JSON é gerado por `scripts/build-data.js` diretamente do HTML oficial do Planalto
(cópia versionada em `data/fonte/del2848.htm`), preservando:

- **todos os 432 artigos** (404 vigentes e 28 revogados, do art. 1º ao 361, incluindo
  os com sufixo — 121-A, 359-U etc.);
- os dispositivos completos de cada artigo: caput, parágrafos, incisos, alíneas e penas;
- as **rubricas** (nomes marginais, ex.: "Homicídio simples");
- as **anotações oficiais**: "(Redação dada pela Lei…)", "(Incluído pela…)",
  "(Revogado pela…)", "(Vide…)", "(VETADO)";
- as **redações históricas riscadas** no texto do Planalto (marcadas `situacao: "historico"`),
  inclusive a Parte Geral original de 1940;
- preâmbulo, fecho, assinaturas e a observação "Este texto não substitui o publicado no DOU".

`npm test` valida essas invariantes (cobertura do art. 1º ao 361, sem duplicatas,
sem sobras de HTML, artigos-chave com o conteúdo esperado).

O SHA-256 do HTML de origem e a data de geração ficam registrados em `meta` no JSON
(exposto em `/api/lei`).

## Atualizando quando a lei mudar

O Planalto bloqueia acesso de datacenters, então o download é feito pelo GitHub Actions:
rode o workflow **"Atualizar dados do Planalto"** (aba Actions → Run workflow). Ele baixa
o HTML atual, regera o JSON, valida e commita. Localmente, com acesso à internet aberta:

```bash
curl -A "Mozilla/5.0" https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848.htm -o data/fonte/del2848.htm
npm run build-data && npm test
```

## Estrutura do projeto

```
data/fonte/del2848.htm   HTML oficial do Planalto (fonte da verdade, versionada)
data/codigo-penal.json   dados estruturados gerados (não editar à mão)
scripts/build-data.js    parser HTML → JSON
scripts/validate-data.js validação de integridade (npm test)
server/index.js          API Express + arquivos estáticos
public/                  landing page (HTML/CSS/JS puro, sem framework)
```

## Avisos

- Este projeto não substitui o texto oficial publicado no DOU nem o site do Planalto.
- O texto da lei é dado público (art. 8º, I, da Lei 9.610/98 exclui atos oficiais de
  proteção autoral).
