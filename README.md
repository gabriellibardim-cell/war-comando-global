# WAR: Comando Global

Jogo de estratégia global para navegador inspirado no tabuleiro clássico **War**, construído com **Vite + TypeScript** puro (100% estático, offline, sem backend e sem dependências externas).

Inclui mapa-múndi estilizado em SVG (42 territórios) com pan/zoom fluido e rótulos adaptativos para celular (iPhone/touch em modo retrato) e desktop, sistema de combate **Tático Híbrido** ou **Dados Clássicos**, operações especiais (**Terrestre, Naval, Aéreo e Míssil**) com defesas correspondentes (**Costa Fortificada, Defesa Antiaérea e Escudo Antimíssil**), **camada econômica completa** (dinheiro por turno, manutenção de tropas, recrutamento, infraestrutura — Fábrica, Porto, Aeroporto, Rodovia — árvore de 5 tecnologias militares, 3 tipos de bombas e espionagem), cartas de troca, objetivos secretos + vitória por pontuação estratégica, IA em 3 níveis de dificuldade, diplomacia, eventos aleatórios opcionais, 4 modos temáticos visuais, tutorial interativo e salvamento automático em `localStorage`.

---

## Como rodar localmente

### Pré-requisitos
- Node.js 18+ (testado em Node 24) e `npm`

### Instalação
```bash
npm install
```

### Modo desenvolvimento
```bash
npm run dev
```
Abra o endereço local exibido no terminal (ex.: `http://localhost:5173`).

### Build de produção (estático)
```bash
npm run build
```
O comando executa a checagem estrita de TypeScript (`tsc --noEmit`) e gera o bundle estático em `dist/` com caminhos relativos (`base: './'`), pronto para hospedagem estática.

### Pré-visualizar a build
```bash
npm run preview
```

### Teste automatizado do motor e partida contra a IA
```bash
npm run test:ai
```
Valida a topologia simétrica e conectada dos 42 territórios, defesas, mísseis, diplomacia e simula partidas completas contra a IA nos modos **Combate Tático** e **Dados Clássicos**.

---

## Estrutura do projeto

- `index.html` — Ponto de entrada com suporte mobile (`viewport-fit=cover`, `100dvh`).
- `vite.config.ts` — Configuração Vite com `base: './'`.
- `src/types.ts` — Definições de tipos TypeScript do estado e mecânicas.
- `src/data/mapData.ts` e `src/data/mapPaths.ts` — Mapa-múndi cartográfico SVG (42 territórios com costas orgânicas, 6 continentes, rotas marítimas e zonas oceânicas).
- `src/ui/icons.ts` e `src/ui/gameIconPaths.ts` — Catálogo completo de 12+ ícones vetoriais SVG (infantaria, tanque, artilharia, encouraçado, porta-aviões, submarino, caça, bombardeiro, antiaérea, míssil, silo, escudo e costa fortificada), dados e rosa dos ventos.
- `src/data/themes.ts` — 4 modos temáticos visuais e de nomenclatura.
- `src/data/events.ts` — 8 eventos aleatórios de rodada.
- `src/data/objectives.ts` — Gerador de objetivos secretos.
- `src/engine/economy.ts` — Economia (renda, manutenção, infraestrutura, árvore de tecnologias, bombas, espionagem e pontuação estratégica).
- `src/engine/combat.ts` — Resolução de combates (Tático Híbrido e Dados Clássicos) e operações especiais.
- `src/engine/gameEngine.ts` — Regras de turnos, reforços, cartas, ocupação, fortificação, diplomacia e vitória.
- `src/engine/ai.ts` — Inteligência artificial (Recruta, Estrategista e Marechal).
- `src/engine/storage.ts` — Persistência automática via `localStorage`.
- `src/ui/mapRenderer.ts` — Renderizador SVG interativo com pan/zoom touch e mouse + animações de ataque.
- `src/ui/tutorial.ts` — Tutorial interativo passo a passo para iniciantes.
- `src/ui/app.ts` — Interface completa responsiva (tela inicial, tabuleiro, modais e controle de turnos).
- `RULES.md` — Manual completo de todas as regras clássicas e novidades.

---

## Documentação de regras e créditos

- Consulte [RULES.md](./RULES.md) para o detalhamento completo de todas as mecânicas, cálculos de combate, operações navais/aéreas/mísseis, defesas, cartas, objetivos, diplomacia e eventos.
- **Créditos e licenças das referências utilizadas:**
  - Base geográfica dos 42 territórios derivada de *Risk game board.svg* (CMG Lee & Gr0gmint, CC BY-SA 4.0) e *Natural Earth* (CC0).
  - Referências de rotas marítimas: *Main maritime shipping routes* (Heinrich-Böll-Stiftung European Union, CC BY-SA 4.0).
  - Referências de silhuetas de ícones e UI tátil: *game-icons.net* (Delapouite, Lorc, Cathelineau, Lord Berandas, Pierre Leducq — CC BY 3.0) e *Kenney UI Pack* (CC0).
