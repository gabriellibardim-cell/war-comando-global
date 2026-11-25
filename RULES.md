# Regras Completas — WAR: Comando Global

Este documento descreve todas as regras do **WAR: Comando Global**, combinando a base clássica do War brasileiro com as novidades de combate estratégico, operações especiais, diplomacia, eventos aleatórios e modos temáticos.

---

## 1. Visão Geral e Preparação

- **Jogadores:** de **2 a 6 jogadores**, combinando humanos (no mesmo dispositivo) e adversários controlados por **IA**.
- **Mapa:** 42 territórios com geografia cartográfica em SVG divididos em **6 continentes** (com oceanos texturizados com ondas, faixas costeiras batimétricas, rotas marítimas douradas tracejadas com navios/porta-aviões/submarinos, nomes de oceanos, rosa dos ventos, fichas de tropa com silhueta por porte e medalhões vetoriais de defesa):

| Continente | Territórios | Bônus por turno |
| --- | :---: | :---: |
| América do Sul | 4 | +2 |
| Oceania | 4 | +2 |
| África | 6 | +3 |
| Europa | 7 | +5 |
| América do Norte | 9 | +5 |
| Ásia | 12 | +7 |

- **Distribuição inicial:** os 42 territórios são embaralhados e distribuídos igualmente entre os jogadores com 1 tropa inicial em cada. Em seguida, exércitos iniciais extras (totalizando de 20 a 40 por jogador conforme o número de participantes) são alocados automaticamente nas fronteiras para acelerar a ação estratégica desde a Rodada 1.
- **Condição de vitória:** escolhida antes da partida:
  - **Objetivos Secretos (padrão):** vence imediatamente quem cumprir sua carta de objetivo secreto ou for o último sobrevivente.
  - **Dominação Total:** vence quem conquistar todos os 42 territórios do mapa.
  - **Limite de Rodadas (Vitória por Pontuação Estratégica):** caso ninguém cumpra o objetivo até o fim da **Rodada 25**, vence automaticamente o comando sobrevivente com maior **Pontuação Estratégica** (`territórios × 3 + continentes × 8 + floor(tropas / 4) + infraestruturas × 2 + níveis de tecnologia × 3 + floor(dinheiro / 60)`).

---

## 2. Objetivos Secretos

No início da partida, cada jogador recebe um objetivo secreto entre:
1. **Conquistar 2 continentes específicos** (ex.: América do Sul + Europa, América do Norte + Oceania, Ásia + África, etc.).
2. **Expansão Continental:** conquistar e manter **24 territórios** à escolha.
3. **Fortalezas Consolidadas:** manter **18 territórios com pelo menos 2 tropas** em cada um.
4. **Destruir um Exército de Cor Específica** (em partidas de 3 a 6 jogadores): eliminar completamente todas as tropas de um rival específico.
   - *Regra clássica de substituição:* se o alvo for eliminado por outro jogador antes de você, seu objetivo é convertido automaticamente em **conquistar 24 territórios**.

---

## 3. Estrutura do Turno

Cada turno é dividido em **3 fases sequenciais**:

### Fase 1: Reforço (e Construção de Defesas)
- No início do turno, você recebe:
  - **Base territorial:** `floor(seus territórios / 2)`, com **mínimo de 3 reforços**.
  - **Bônus de continente:** para cada continente que você controla por completo.
  - **Bônus de eventos aleatórios** (quando ativos na rodada).
- Você pode trocar **cartas de território** nesta fase para ganhar reforços adicionais (troca **obrigatória** se começar com 5 ou mais cartas).
- Além de posicionar tropas em seus territórios, você pode gastar seus reforços para construir **Defesas Especiais** (ver Seção 5).
- Todos os reforços devem ser gastos antes de avançar para a fase de Ataque.

### Fase 2: Ataque (e Ocupação)
- Você pode realizar quantos ataques desejar (ou nenhum), escolhendo um território seu como origem e um alvo inimigo válido conforme o **Tipo de Ataque** (Terrestre, Naval, Aéreo ou Míssil).
- **Ocupação após conquista:** ao reduzir a guarnição inimiga a 0 tropas em um ataque Terrestre, Naval ou Aéreo, você conquista o território!
  - Defesas inimigas do território conquistado são destruídas na invasão.
  - Você escolhe quantas tropas avançam da origem para o território conquistado (no mínimo **1**, mantendo sempre pelo menos **1 tropa** na origem).
- **Eliminação de jogador:** ao conquistar o último território de um adversário, ele é eliminado e você herda imediatamente todas as cartas dele.

### Fase 3: Fortificação (Remanejamento)
- Uma vez por turno (opcional), você pode mover qualquer quantidade de tropas de um território seu (deixando pelo menos **1 tropa** na origem) para outro território seu **conectado por uma cadeia contínua de territórios sob seu controle**.
- Ao encerrar o turno, se você conquistou pelo menos **1 território** durante a fase de Ataque, compra **1 Carta de Território**.

---

## 4. Sistemas de Combate (Escolha na Configuração)

Você pode escolher entre dois sistemas de resolução de batalhas:

### A) Combate Tático Híbrido *(Padrão / Recomendado)*
Projetado para reduzir frustração de sorte pura e valorizar posicionamento, superioridade e defesas:
- Até **3 tropas atacantes** enfrentam até **2 tropas defensoras** por rodada de combate (mantendo o ritmo clássico do War).
- Antes de atacar, a interface mostra a **Prévia Tática** com a força efetiva, defesas ativadas, chance percentual de vitória por embate e baixas esperadas.
- Modificadores transparentes:
  - **Ritmo decisivo e desgaste de guerra:** defensores mantêm leve vantagem base (`1.04x`), enquanto atacantes ganham ímpeto tático (`1.08x`) e **Ofensiva de Guerra** crescente a partir da Rodada 8 (+8% a cada 3 rodadas, até +36%) para evitar impasses eternos.
  - **Superioridade numérica:** +14% quando a origem tem `>= 1,5x` as tropas do alvo e **+28%** com `>= 2,4x` (com golpe de choque extra ao vencer todos os embates com ampla superioridade).
  - **Tecnologias, infraestrutura, defesas e eventos** aplicam modificadores percentuais claros diretamente no cálculo.
- Cada embate (`min(atq, def)`) resolve usando a razão de poder `forçaAtq / (forçaAtq + forçaDef)`.

### B) Dados Clássicos do War
- Atacante rola até **3 dados de 6 faces** (respeitando `tropasNaOrigem - 1`).
- Defensor rola até **2 dados de 6 faces** (respeitando `tropasNoAlvo`).
- Os dados são ordenados do maior para o menor e comparados par a par; **empate vence a defesa**.
- Os resultados individuais dos dados aparecem na barra de combate.
- Quando Operações Especiais ou Eventos estão ativos, bônus defensivos adicionam **+1** ao maior dado da defesa (teto 6) e tempestades/frente fria aplicam **-1** ao maior dado do ataque (piso 1).

*Dica:* Em ambos os sistemas, o botão **⚡ Blitz** permite repetir ondas de ataque automaticamente contra o mesmo alvo até conquistar ou ficar sem tropas suficientes.

---

## 5. Novos Tipos de Ataque e Defesas (Operações Especiais)

Quando **Operações Especiais & Defesas** está ativado (padrão), o combate vai muito além das fronteiras terrestres:

### Tipos de Ataque

| Tipo | Alcance | Requisito na Origem | Pode Conquistar? | Comportamento e Modificadores |
| --- | --- | --- | :---: | --- |
| **⚔️ Terrestre** | Fronteira direta (incluindo estreitos clássicos do tabuleiro) | Mín. 2 tropas | Sim | Combate padrão. Se atravessar rota marítima contra Costa Fortificada, defensor ganha +15%. |
| **⚓ Naval** | Qualquer território **costeiro** inimigo que compartilhe uma **zona oceânica** (ex.: Atlântico Sul, Pacífico Norte, Índico, Mediterrâneo, Ártico) | Mín. 3 tropas (origem deve ser costeira) | Sim (desembarque anfíbio) | **+10%** contra costas desprotegidas. Contra **Costa Fortificada**: defensor ganha **+35%** e 65% de chance de infligir **+1 baixa extra** ao invasor se resistir. |
| **✈️ Aéreo** | Até **2 territórios de distância** (salta por cima da linha de frente!) | Mín. 3 tropas | Sim (assalto aerotransportado) | Leve penalidade base (-8%) em choque sustentado. Contra **Defesa Antiaérea**: **-35%** de poder aéreo + **1 baixa garantida** por interceptação. |
| **🚀 Míssil** | **Global** (qualquer território inimigo no mapa) | Mín. 3 tropas + **recarga 0** | Não (enfraquece guarnição) | Consome **2 tropas** da base de lançamento e entra em **recarga de 3 turnos**. Causa **2 a 4 baixas diretas** (mantém mínimo de 1 tropa no alvo) e tem 60% de chance de destruir 1 defesa comum (Costa ou Antiaérea). **Bloqueado por Escudo Antimíssil**. |

### Identificação Visual das Unidades (Por Tipo e Porte)

Os ícones no mapa, na barra de ações e na prévia de combate mudam conforme o tipo e o porte da força mobilizada (consulte o catálogo visual completo em **🎖️ Unidades & Créditos**):

- **Terrestre:** **Infantaria** (1–3 tropas), **Tanque** (4–7 tropas), **Artilharia** (8+ tropas).
- **Naval:** **Submarino** (3–4 tropas), **Encouraçado** (5–7 tropas), **Porta-Aviões** (8+ tropas).
- **Aéreo:** **Caça a Jato** (3–5 tropas), **Bombardeiro** (6+ tropas).
- **Míssil:** **Silo de Lançamento** (na base de origem) + **Míssil Estratégico** (no disparo/trajetória).
- **Defesas:** **Costa Fortificada**, **Canhão Antiaéreo (AA)** e **Escudo Antimíssil**.

### Estruturas de Defesa (Construídas na Fase de Reforço)

Cada território pode receber até 1 unidade de cada tipo de defesa, exibida como ícone diretamente sobre o território no mapa:

| Defesa | Custo (em reforços) | Restrição | Efeito |
| --- | :---: | --- | --- |
| **🏰 Costa Fortificada** | 2 *(1 com Avanço Tecnológico)* | Apenas territórios costeiros | +35% defesa e contra-fogo contra ataques **Navais**; +15% contra travessias marítimas terrestres. |
| **📡 Defesa Antiaérea (AA)** | 2 *(1 com Avanço Tecnológico)* | Qualquer território seu | Reduz em -35% a força de ataques **Aéreos** e abate +1 tropa atacante por interceptação. |
| **🛡️ Escudo Antimíssil** | 3 *(2 com Avanço Tecnológico)* | Qualquer território seu | **Intercepta 100%** do próximo **Míssil** inimigo (0 baixas). O escudo é **consumido** após a interceptação e pode ser reconstruído depois. |

---

## 6. Camada Econômica (Dinheiro, Infraestrutura, Tecnologias e Bombas)

Quando ativada (padrão), adiciona gestão financeira e industrial acessível pelo botão **💰 Economia** no topo ou na barra inferior:

### Renda e Manutenção de Tropas
- **Saldo inicial:** cada comando inicia com **$120**.
- **Renda por turno (creditada no início de cada turno):**
  - **+$10** por território controlado.
  - **+$15 × bônus** por continente completo (ex.: América do Sul `+$30`, Ásia `+$105`).
  - **Infraestrutura construída** (+$10 a +$25 por estrutura).
- **Saque de conquista:** conquistar um território inimigo rende **+$15** na hora (e eliminar um jogador confisca 50% do tesouro dele).
- **Custo de manutenção (Mão de Obra):** cada comando mantém gratuitamente até `15 + (3 × fábricas)` tropas; tropas excedentes custam **$2 por turno** cada (a renda líquida nunca fica abaixo de $10).

### Mão de Obra e Financiamento de Defesas
Na aba **👷 Tropas**, selecione um território seu no mapa para:
- **Recrutar tropas extras:** `+1 Tropa ($30)`, `+3 Tropas ($80)` ou `+5 Tropas ($125)`.
- **Financiar Defesas com dinheiro:** Costa Fortificada (`$45`), Antiaérea (`$45`) ou Escudo Antimíssil (`$65`) — com 20% de desconto a partir de Engenharia de Defesa Nv.1.

### Infraestrutura (Aba 🏭 Infra)
Cada território pode ter até 1 estrutura de cada tipo (ao ser conquistado, há chance de 55%–70% de a infraestrutura sobreviver para o invasor):

| Estrutura | Custo | Renda/turno | Efeito Tático |
| --- | :---: | :---: | --- |
| **🏭 Fábrica Industrial** | $60 | +$25 | Aumenta em +3 o limite de manutenção gratuita de tropas. |
| **⚓ Porto Naval** *(costeiro)* | $55 | +$15 | +15% de força em ataques Navais saindo deste território. |
| **🛫 Aeroporto Tático** | $65 | +$10 | Aumenta o alcance Aéreo para **3 saltos** e dá +15% de ataque Aéreo saindo daqui. |
| **🛣️ Rodovias & Logística** | $50 | +$10 | +15% de ímpeto em ataques Terrestres saindo deste território. |

### Desenvolvimento Militar (Árvore de Tecnologias — Aba 🔬 Tech)
Cinco ramos independentes, evoluíveis do **Nível 0 ao Nível 3** (`$70 / $120 / $180`, Mísseis `$80 / $130 / $190`):
- **🪖 Blindados:** +12% ataque Terrestre por nível (até +36%).
- **🚢 Marinha:** +15% ataque Naval por nível; Nv.2+ reduz o bônus e o contra-fogo de Costa Fortificada.
- **✈️ Força Aérea:** +15% ataque Aéreo por nível; **Nv.1 desbloqueia a Bomba Pesada**.
- **🚀 Mísseis:** +1 dano de Míssil por nível; **Nv.2 reduz a recarga em 1 turno e desbloqueia a Bomba Estratégica**.
- **🛡️ Defesas:** +10% poder defensivo global por nível e -20% no custo em `$` de defesas.

### Bombas e Espionagem (Aba 💣 Bombas)
- **💣 Bomba Convencional ($55):** alcance 2 saltos (+1 de Aeroporto); causa **1–2 baixas** (mín. 1 tropa) e 55% de chance de destruir 1 infraestrutura (reduzida por Antiaérea).
- **🔥 Bomba Pesada ($95, requer Força Aérea Nv.1):** alcance 3 saltos (+1 de Aeroporto); causa **2–4 baixas** e destrói 1 infraestrutura + 1 defesa comum (reduzida por Antiaérea).
- **☢️ Bomba Estratégica ($175, requer Mísseis Nv.2):** alcance **global**; causa **4–6 baixas** e arrasa toda a infraestrutura do alvo — **interceptada 100% pelo Escudo Antimíssil** (que é consumido).
- **🕵️ Espionagem ($90):** revela permanentemente no placar o **Objetivo Secreto** de um adversário escolhido.

---

## 7. Cartas de Troca

- Ao conquistar pelo menos 1 território no turno, você ganha 1 carta ao encerrar a jogada.
- Cada carta tem um símbolo (**▲ Triângulo**, **■ Quadrado**, **● Círculo** ou **★ Curinga**) e o nome de um território.
- **Trinca válida:** 3 símbolos iguais OU 3 símbolos diferentes (Curingas substituem qualquer símbolo).
- **Progressão de reforços:**
  - 1ª troca: **+4** | 2ª: **+6** | 3ª: **+8** | 4ª: **+10** | 5ª: **+12** | 6ª: **+15** | 7ª+: **+5 adicionais** a cada nova troca (20, 25, 30...).
- **Bônus de território:** se você possuir no mapa o território estampado em alguma das cartas trocadas, esse território recebe **+2 tropas extras** imediatamente.
- **Limite de mão:** ao iniciar o turno com **5 ou mais cartas**, você deve realizar uma troca antes de posicionar reforços ou atacar.

---

## 8. Diplomacia (Pactos de Não Agressão)

Quando ativada:
- No seu turno, você pode propor um **Pacto de Não Agressão (3 rodadas)** a qualquer IA viva (desde que existam 3 ou mais comandos em jogo).
- A IA decide aceitar ou recusar avaliando: se você é o alvo secreto dela, seu histórico de traições, seu tamanho no mapa e a quantidade de frentes abertas.
- IAs também podem enviar propostas de pacto para você (um alerta aparece no botão **🤝 Diplomacia**).
- Enquanto o pacto está ativo, nenhum dos dois lados pode atacar o outro (nem com mísseis).
- **Traição:** você pode romper um pacto ativo manualmente a qualquer momento em Diplomacia, mas acumula pontos de traição e IAs futuras passarão a recusar seus acordos.

---

## 9. Eventos Aleatórios (Opcional)

A partir da Rodada 2, no início de cada rodada global pode ocorrer um evento aleatório (exibido em destaque no topo do mapa):

- **⛈️ Tempestade Oceânica:** ataques Navais e Aéreos têm -20% de força (ou -1 no maior dado) nesta rodada.
- **🌾 Boa Colheita:** todos os jogadores recebem +2 reforços extras nesta rodada.
- **🔥 Revolta em [Continente]:** territórios com 3 ou mais tropas no continente sorteado perdem 1 tropa imediatamente.
- **⚙️ Avanço Tecnológico:** reduz em 1 turno a recarga de Mísseis de todos e reduz em 1 reforço o custo de construir Defesas nesta rodada (mín. 1).
- **🌫️ Nevoeiro Estratégico:** defensores recebem +15% de bônus (ou +1 no dado de defesa) em todo o mapa.
- **📦 Comboio Logístico:** o jogador ativo com menos territórios recebe +3 tropas em seu território mais vulnerável.
- **❄️ Inverno Rigoroso em [Continente]:** ataques Terrestres entrando no continente sorteado sofrem -20% de força.
- **🕊️ Tensão Diplomática:** jogadores com pelo menos 1 Pacto ativo ganham +2 reforços extras nesta rodada.

---

## 10. Inteligência Artificial (3 Níveis)

- **Recruta (Fácil):** distribui reforços de forma espalhada, investe pouco em economia/defesas e faz ataques mais arriscados/aleatórios.
- **Estrategista (Médio):** concentra reforços em fronteiras críticas, constrói fábricas/infraestrutura, pesquisa tecnologias, recruta tropas extras e usa operações navais/aéreas/mísseis/bombas com moderação.
- **Marechal (Difícil):** foca fortemente no objetivo secreto, quebra continentes adversários, desenvolve infraestrutura e tecnologias ofensivas, usa bombardeios em hubs inimigos, constrói defesas em pontos-chave e remaneja tropas da retaguarda para o front.

---

## 11. Modos Temáticos

Os modos temáticos alteram a paleta visual, o visual do mapa e os nomes das operações e defesas **sem alterar as regras matemáticas do jogo**:
- **Clássico Moderno:** estética tática moderna inspirada no jogo de tabuleiro.
- **Era Napoleônica *(Ficção Temática)*:** pergaminho cartográfico; Infantaria, Frota de Linha, Balão Tático, Artilharia Longa, Forte Costeiro, Bateria Elevada, Bastião Blindado.
- **Teatro Global 1940s *(Ficção Temática)*:** sala de operações verde-oliva; Blindados, Força-Tarefa, Esquadrão Aéreo, Foguete Balístico, Bateria Costeira, Flak Antiaérea, Radar Interceptador.
- **Horizonte Cibernético *(Ficção Científica)*:** visual neon de comando orbital; Assalto Terrestre, Cruzador Marítimo, Enxame de Drones, Pulso Orbital, Muralha Costeira, Rede Antidrone, Domo de Plasma.

> **Aviso de transparência:** todos os modos temáticos históricos são estritamente **estéticos e ficcionais** para fins de jogo. Nenhum dado ou evento exibido nas partidas representa fato histórico real.

---

## 12. Controles (Celular e Desktop) e Salvamento

- **Mapa:** arraste com 1 dedo (ou clique e arraste no mouse) para mover o mapa; use pinça com 2 dedos (ou roda do mouse) e os botões `+`, `−` e centralizar para zoom.
- **Rótulos adaptativos no celular:** no zoom inicial em telas pequenas, o mapa exibe apenas as fichas limpas de ícone + quantidade de tropas (evitando poluição na Europa), revelando o nome do território selecionado na faixa superior do mapa e todos os nomes automaticamente ao dar zoom (`>= 1.38x`).
- **Sem necessidade de hover:** todas as informações e ações respondem a toque/clique direto, com botões amplos pensados para uso confortável no celular em modo retrato.
- **Tutorial Interativo:** acessível tanto na tela inicial quanto pelo botão **❓** a qualquer momento da partida.
- **Auto-Save:** cada jogada é salva automaticamente no `localStorage` do navegador; basta recarregar a página e clicar em **▶ Continuar** na tela inicial.
