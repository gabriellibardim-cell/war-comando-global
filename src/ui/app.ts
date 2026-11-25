import type {
  AttackMode,
  BombType,
  CombatResult,
  CombatSystem,
  DefenseType,
  Difficulty,
  GameConfig,
  GameState,
  InfrastructureType,
  TechBranch,
  ThemeId,
} from '../types.ts';
import { CONTINENTS, PLAYER_PALETTE, TERRITORIES, TERRITORY_BY_ID } from '../data/mapData.ts';
import { THEMES } from '../data/themes.ts';
import {
  getDefenseCost,
  getValidTargets,
  hasActivePact,
  previewCombat,
} from '../engine/combat.ts';
import {
  BOMB_DEFS,
  ESPIONAGE_COST,
  INFRASTRUCTURE_DEFS,
  MANPOWER_PACKS,
  TECH_DEFS,
  canDropBombOn,
  getDefenseMoneyCost,
  getStrategicScore,
  getTechUpgradeCost,
} from '../engine/economy.ts';
import {
  advancePhase,
  breakPact,
  buildDefense,
  buildDefenseWithMoney,
  buildInfrastructure,
  calculateReinforcements,
  conductEspionage,
  confirmOccupation,
  createNewGame,
  dropBomb,
  executeAttack,
  findValidCardSet,
  fortifyTroops,
  getFortifyTargets,
  getNextCardTradeValue,
  getOwnedContinents,
  getPlayerIncome,
  getPlayerTerritories,
  isValidCardSet,
  placeReinforcement,
  recruitTroopsWithMoney,
  respondToPactOffer,
  tradeCards,
  upgradeTechnology,
} from '../engine/gameEngine.ts';
import {
  proposePactToAI,
  runAIFortifyAndEndTurn,
  runAIReinforcePhase,
  runSingleAIAttackStep,
} from '../engine/ai.ts';
import { clearSavedGame, getSaveSummary, loadGame, saveGame } from '../engine/storage.ts';
import { MapRenderer } from './mapRenderer.ts';
import { renderTutorialModal } from './tutorial.ts';
import {
  LICENSE_CREDITS,
  UNIT_ICONS,
  getCombatUnitProfile,
  getLandUnitIconId,
  renderAttackIcon,
  renderDefenseIcon,
  renderDieSvg,
  renderFortifyIcon,
  renderUnitIcon,
  type UnitIconId,
} from './icons.ts';

type ActiveModal =
  | null
  | 'objective'
  | 'cards'
  | 'diplomacy'
  | 'log'
  | 'menu'
  | 'credits'
  | 'tutorial';

interface SetupPlayerDraft {
  name: string;
  isAI: boolean;
  difficulty: Difficulty;
  color: string;
  colorName: string;
}

export class WarApp {
  private root: HTMLElement;
  private state: GameState | null = null;
  private mapRenderer: MapRenderer | null = null;

  // UI transient state
  private selectedId: string | null = null;
  private targetId: string | null = null;
  private attackMode: AttackMode = 'land';
  private reinforceStep: number | 'all' = 1;
  private fortifyAmount = 1;
  private occupyAmount = 1;
  private selectedCardIds = new Set<string>();
  private activeModal: ActiveModal = null;
  private tutorialStep = 0;
  private toastMessage: string | null = null;
  private toastTimer: number | null = null;
  private activeCombatFx: CombatResult | null = null;
  private fxTimer: number | null = null;
  private aiSpeedMs = 420;
  private aiRunning = false;
  private desktopTab: 'action' | 'economy' | 'players' | 'log' = 'action';
  private economySubTab: 'troops' | 'infra' | 'tech' | 'bombs' = 'troops';

  // Setup draft
  private setupCount = 4;
  private setupCombatSystem: CombatSystem = 'tactical';
  private setupTheme: ThemeId = 'classic';
  private setupEvents = true;
  private setupSpecial = true;
  private setupDiplomacy = true;
  private setupEconomy = true;
  private setupVictory: 'objectives' | 'domination' = 'objectives';
  private setupPlayers: SetupPlayerDraft[] = [
    { name: 'Você', isAI: false, difficulty: 'medium', color: PLAYER_PALETTE[0].color, colorName: PLAYER_PALETTE[0].name },
    { name: 'IA Helena', isAI: true, difficulty: 'medium', color: PLAYER_PALETTE[1].color, colorName: PLAYER_PALETTE[1].name },
    { name: 'IA Marcos', isAI: true, difficulty: 'hard', color: PLAYER_PALETTE[2].color, colorName: PLAYER_PALETTE[2].name },
    { name: 'IA Sofia', isAI: true, difficulty: 'easy', color: PLAYER_PALETTE[3].color, colorName: PLAYER_PALETTE[3].name },
    { name: 'IA Bruno', isAI: true, difficulty: 'medium', color: PLAYER_PALETTE[4].color, colorName: PLAYER_PALETTE[4].name },
    { name: 'IA Clara', isAI: true, difficulty: 'hard', color: PLAYER_PALETTE[5].color, colorName: PLAYER_PALETTE[5].name },
  ];

  constructor(root: HTMLElement) {
    this.root = root;
    this.applyThemeClass(this.setupTheme);
    this.render();
  }

  private applyThemeClass(themeId: ThemeId): void {
    document.body.className = THEMES[themeId].cssClass;
  }

  private showToast(msg: string): void {
    this.toastMessage = msg;
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastMessage = null;
      this.renderToastOnly();
    }, 3200);
    this.renderToastOnly();
  }

  private renderToastOnly(): void {
    const existing = this.root.querySelector('.toast-banner');
    if (existing) existing.remove();
    if (!this.toastMessage) return;
    const div = document.createElement('div');
    div.className = 'toast-banner';
    div.textContent = this.toastMessage;
    this.root.appendChild(div);
  }

  private flashCombatFx(result: CombatResult): void {
    this.activeCombatFx = result;
    if (this.fxTimer) window.clearTimeout(this.fxTimer);
    this.fxTimer = window.setTimeout(() => {
      this.activeCombatFx = null;
      this.updateMap();
    }, 1400);
  }

  private persist(): void {
    if (this.state) saveGame(this.state);
  }

  private render(): void {
    if (!this.state) {
      this.mapRenderer = null;
      this.renderSetupScreen();
    } else {
      this.applyThemeClass(this.state.config.theme);
      this.renderGameScreen();
    }
    this.renderModalLayer();
    this.renderToastOnly();
  }

  // =========================================================
  // SETUP / START SCREEN
  // =========================================================
  private renderSetupScreen(): void {
    this.applyThemeClass(this.setupTheme);
    const saved = getSaveSummary();
    const theme = THEMES[this.setupTheme];

    const playerRows = this.setupPlayers
      .slice(0, this.setupCount)
      .map(
        (p, idx) => `
      <div class="setup-player-row">
        <span class="color-swatch" style="background:${p.color}" title="${p.colorName}"></span>
        <input class="setup-name-input" data-pidx="${idx}" type="text" maxlength="18" value="${escapeHtml(p.name)}" aria-label="Nome do jogador ${idx + 1}" />
        <button class="btn btn-sm ${p.isAI ? 'btn-secondary' : 'btn-primary'}" data-toggle-ai="${idx}">
          ${p.isAI ? '🤖 IA' : '👤 Humano'}
        </button>
        ${
          p.isAI
            ? `<select class="setup-diff-select" data-diff="${idx}" aria-label="Dificuldade">
                 <option value="easy" ${p.difficulty === 'easy' ? 'selected' : ''}>Recruta</option>
                 <option value="medium" ${p.difficulty === 'medium' ? 'selected' : ''}>Estrategista</option>
                 <option value="hard" ${p.difficulty === 'hard' ? 'selected' : ''}>Marechal</option>
               </select>`
            : `<span class="human-tag">Você controla</span>`
        }
      </div>`
      )
      .join('');

    const themeCards = (Object.keys(THEMES) as ThemeId[])
      .map((id) => {
        const t = THEMES[id];
        return `
        <button class="choice-card ${this.setupTheme === id ? 'selected' : ''}" data-theme="${id}">
          <strong>${t.name}</strong>
          <span>${t.subtitle}</span>
        </button>`;
      })
      .join('');

    this.root.innerHTML = `
      <div class="setup-shell">
        <header class="setup-hero">
          <div class="hero-copy">
            <div class="hero-badge">ESTRATÉGIA GLOBAL • 42 TERRITÓRIOS</div>
            <h1>WAR: Comando Global</h1>
            <p>Domine continentes, gerencie economia, infraestrutura e tecnologias, lance ataques terrestres, navais, aéreos, mísseis e bombas contra a IA.</p>
          </div>
          <div class="hero-actions">
            <button class="btn btn-ghost btn-sm" id="btn-open-tutorial">❓ Tutorial</button>
            <button class="btn btn-ghost btn-sm" id="btn-open-credits">🎖️ Unidades &amp; Créditos</button>
          </div>
        </header>

        ${
          saved
            ? `<section class="saved-game-card">
                <div>
                  <span class="pill-badge">PARTIDA SALVA</span>
                  <h3>Rodada ${saved.round} • Turno de ${escapeHtml(saved.currentPlayerName)}</h3>
                  <p>${saved.playerCount} jogadores • Tema: ${THEMES[saved.theme as ThemeId]?.name ?? saved.theme}</p>
                </div>
                <div class="saved-actions">
                  <button class="btn btn-success" id="btn-resume-save">▶ Continuar</button>
                  <button class="btn btn-ghost btn-sm" id="btn-clear-save">Apagar</button>
                </div>
              </section>`
            : ''
        }

        <main class="setup-grid">
          <section class="setup-card">
            <div class="card-title-row">
              <h2>1. Jogadores (${this.setupCount})</h2>
              <div class="segmented">
                ${[2, 3, 4, 5, 6]
                  .map(
                    (n) =>
                      `<button class="seg-btn ${this.setupCount === n ? 'active' : ''}" data-pcount="${n}">${n}</button>`
                  )
                  .join('')}
              </div>
            </div>
            <div class="setup-players-list">${playerRows}</div>
          </section>

          <section class="setup-card">
            <h2>2. Combate &amp; Regras</h2>
            <div class="choice-grid-2">
              <button class="choice-card ${this.setupCombatSystem === 'tactical' ? 'selected' : ''}" data-combat="tactical">
                <strong>⚡ Combate Tático</strong>
                <span>Força real + techs + defesas com prévia clara.</span>
              </button>
              <button class="choice-card ${this.setupCombatSystem === 'classic_dice' ? 'selected' : ''}" data-combat="classic_dice">
                <strong>🎲 Dados Clássicos</strong>
                <span>Até 3 dados atq × 2 def; empate da defesa.</span>
              </button>
            </div>

            <div class="toggle-list">
              <label class="toggle-row">
                <div>
                  <strong>💰 Economia, Infra, Tech &amp; Bombas</strong>
                  <small>Renda por turno, fábricas/portos/aeroportos, tecnologias e bombardeios.</small>
                </div>
                <input type="checkbox" id="chk-economy" ${this.setupEconomy ? 'checked' : ''} />
              </label>

              <label class="toggle-row">
                <div>
                  <strong>⚓ Operações Especiais &amp; Defesas</strong>
                  <small>Naval, Aéreo e Míssil + Costa Fortificada, Antiaérea e Escudo.</small>
                </div>
                <input type="checkbox" id="chk-special" ${this.setupSpecial ? 'checked' : ''} />
              </label>

              <label class="toggle-row">
                <div>
                  <strong>⛈️ Eventos Aleatórios &amp; 🤝 Diplomacia</strong>
                  <small>Eventos de rodada e pactos de não agressão com a IA.</small>
                </div>
                <div class="dual-checks">
                  <input type="checkbox" id="chk-events" title="Eventos Aleatórios" ${this.setupEvents ? 'checked' : ''} />
                  <input type="checkbox" id="chk-diplomacy" title="Diplomacia" ${this.setupDiplomacy ? 'checked' : ''} />
                </div>
              </label>
            </div>

            <div class="victory-row">
              <span>Vitória (limite 25 rod.):</span>
              <div class="segmented">
                <button class="seg-btn ${this.setupVictory === 'objectives' ? 'active' : ''}" data-victory="objectives">🎯 Objetivos</button>
                <button class="seg-btn ${this.setupVictory === 'domination' ? 'active' : ''}" data-victory="domination">🌍 Dominação</button>
              </div>
            </div>
          </section>

          <section class="setup-card setup-card-theme">
            <h2>3. Modo Temático</h2>
            <div class="choice-grid-themes">${themeCards}</div>
            <p class="fiction-disclaimer">ℹ️ ${theme.fictionNotice}</p>
          </section>
        </main>

        <footer class="setup-cta">
          <button class="btn btn-primary btn-xl" id="btn-start-game">🚀 Iniciar Nova Partida</button>
        </footer>
      </div>
    `;

    // Bind setup interactions
    this.root.querySelector('#btn-open-tutorial')?.addEventListener('click', () => {
      this.tutorialStep = 0;
      this.activeModal = 'tutorial';
      this.renderModalLayer();
    });

    this.root.querySelector('#btn-open-credits')?.addEventListener('click', () => {
      this.activeModal = 'credits';
      this.renderModalLayer();
    });

    this.root.querySelector('#btn-resume-save')?.addEventListener('click', () => {
      const loaded = loadGame();
      if (loaded) {
        this.state = loaded;
        this.selectedId = null;
        this.targetId = null;
        this.render();
        this.maybeTriggerAITurn();
      } else {
        this.showToast('Não foi possível carregar o save.');
      }
    });

    this.root.querySelector('#btn-clear-save')?.addEventListener('click', () => {
      clearSavedGame();
      this.render();
    });

    this.root.querySelectorAll('[data-pcount]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setupCount = Number((btn as HTMLElement).dataset.pcount);
        this.render();
      });
    });

    this.root.querySelectorAll('.setup-name-input').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx = Number((inp as HTMLInputElement).dataset.pidx);
        this.setupPlayers[idx].name = (inp as HTMLInputElement).value;
      });
    });

    this.root.querySelectorAll('[data-toggle-ai]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number((btn as HTMLElement).dataset.toggleAi);
        this.setupPlayers[idx].isAI = !this.setupPlayers[idx].isAI;
        if (!this.setupPlayers[idx].isAI && this.setupPlayers[idx].name.startsWith('IA ')) {
          this.setupPlayers[idx].name = `Jogador ${idx + 1}`;
        } else if (this.setupPlayers[idx].isAI && this.setupPlayers[idx].name === 'Você') {
          this.setupPlayers[idx].name = `IA ${idx + 1}`;
        }
        this.render();
      });
    });

    this.root.querySelectorAll('.setup-diff-select').forEach((sel) => {
      sel.addEventListener('change', () => {
        const idx = Number((sel as HTMLSelectElement).dataset.diff);
        this.setupPlayers[idx].difficulty = (sel as HTMLSelectElement).value as Difficulty;
      });
    });

    this.root.querySelectorAll('[data-combat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setupCombatSystem = (btn as HTMLElement).dataset.combat as CombatSystem;
        this.render();
      });
    });

    this.root.querySelectorAll('[data-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setupTheme = (btn as HTMLElement).dataset.theme as ThemeId;
        this.render();
      });
    });

    this.root.querySelectorAll('[data-victory]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setupVictory = (btn as HTMLElement).dataset.victory as 'objectives' | 'domination';
        this.render();
      });
    });

    this.root.querySelector('#chk-economy')?.addEventListener('change', (e) => {
      this.setupEconomy = (e.target as HTMLInputElement).checked;
    });
    this.root.querySelector('#chk-special')?.addEventListener('change', (e) => {
      this.setupSpecial = (e.target as HTMLInputElement).checked;
    });
    this.root.querySelector('#chk-events')?.addEventListener('change', (e) => {
      this.setupEvents = (e.target as HTMLInputElement).checked;
    });
    this.root.querySelector('#chk-diplomacy')?.addEventListener('change', (e) => {
      this.setupDiplomacy = (e.target as HTMLInputElement).checked;
    });

    this.root.querySelector('#btn-start-game')?.addEventListener('click', () => {
      const slice = this.setupPlayers.slice(0, this.setupCount);
      if (slice.every((p) => p.isAI)) {
        this.showToast('Iniciando partida com todos os comandos controlados por IA!');
      }
      const config: GameConfig = {
        players: slice.map((p) => ({
          name: p.name.trim() || p.colorName,
          color: p.color,
          colorName: p.colorName,
          isAI: p.isAI,
          difficulty: p.difficulty,
        })),
        combatSystem: this.setupCombatSystem,
        theme: this.setupTheme,
        enableRandomEvents: this.setupEvents,
        enableSpecialWarfare: this.setupSpecial,
        enableDiplomacy: this.setupDiplomacy,
        enableEconomy: this.setupEconomy,
        maxRounds: 25,
        victoryMode: this.setupVictory,
      };
      this.state = createNewGame(config);
      this.selectedId = null;
      this.targetId = null;
      this.attackMode = 'land';
      this.desktopTab = 'action';
      this.persist();
      this.render();
      this.maybeTriggerAITurn();
    });
  }

  // =========================================================
  // ACTIVE GAME SCREEN
  // =========================================================
  private renderGameScreen(): void {
    const state = this.state!;
    const current = state.players[state.currentPlayerIndex];
    const pendingForHuman = state.pendingPactOffers.filter(
      (o) => !current.isAI && o.toPlayerId === current.id
    );

    const existingGameShell = this.root.querySelector('.game-shell');
    if (!existingGameShell) {
      this.root.innerHTML = `
        <div class="game-shell">
          <header class="top-bar" id="top-bar"></header>
          <div class="event-strip-slot" id="event-strip-slot"></div>
          <div class="game-main">
            <div class="map-stage">
              <div class="map-container" id="map-container"></div>
              <div class="territory-info-chip" id="territory-info-chip"></div>
              <div class="map-zoom-controls">
                <button class="zoom-btn" id="btn-zoom-in" aria-label="Aproximar">+</button>
                <button class="zoom-btn" id="btn-zoom-out" aria-label="Afastar">−</button>
                <button class="zoom-btn" id="btn-zoom-reset" aria-label="Centralizar mapa">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line>
                    <line x1="18" y1="12" x2="22" y2="12"></line>
                  </svg>
                </button>
              </div>
              <div class="last-combat-pill" id="last-combat-pill"></div>
            </div>
            <aside class="control-dock" id="control-dock"></aside>
          </div>
        </div>
      `;

      const mapContainer = this.root.querySelector('#map-container') as HTMLElement;
      this.mapRenderer = new MapRenderer(mapContainer, (id) => this.handleTerritoryTap(id));

      this.root.querySelector('#btn-zoom-in')?.addEventListener('click', () => {
        this.mapRenderer?.zoomBy(1.25);
      });
      this.root.querySelector('#btn-zoom-out')?.addEventListener('click', () => {
        this.mapRenderer?.zoomBy(0.8);
      });
      this.root.querySelector('#btn-zoom-reset')?.addEventListener('click', () => {
        this.mapRenderer?.resetView();
      });
    }

    // Update Top Bar
    const topBar = this.root.querySelector('#top-bar') as HTMLElement;
    const phaseLabel: Record<GameState['phase'], string> = {
      reinforce: '1. Reforço',
      attack: '2. Ataque',
      occupy: '2. Ocupação',
      fortify: '3. Fortificar',
      game_over: 'Fim de Jogo',
    };

    topBar.innerHTML = `
      <div class="turn-identity">
        <span class="turn-dot" style="background:${current.color}"></span>
        <div class="turn-meta">
          <strong class="turn-player-name">${escapeHtml(current.name)} ${current.isAI ? '🤖' : ''}</strong>
          <span class="turn-sub">R${state.round}/${state.config.maxRounds || 25} • <b>${phaseLabel[state.phase]}</b></span>
        </div>
      </div>
      <div class="top-actions">
        ${
          state.config.enableEconomy
            ? `<button class="top-btn top-money-btn ${this.desktopTab === 'economy' ? 'is-active-tab' : ''}" id="btn-top-economy" title="Abrir Economia e Infraestrutura">
                 💰 <span>$${current.money}</span>
               </button>`
            : ''
        }
        <button class="top-btn" data-modal="objective" title="Objetivo Secreto">
          🎯 <span class="hide-xs">Objetivo</span>
        </button>
        <button class="top-btn ${!current.isAI && current.cards.length >= 5 ? 'alert-pulse' : ''}" data-modal="cards" title="Cartas">
          🃏 <span class="badge-num">${current.cards.length}</span>
        </button>
        ${
          state.config.enableDiplomacy
            ? `<button class="top-btn ${pendingForHuman.length > 0 ? 'alert-pulse' : ''}" data-modal="diplomacy" title="Diplomacia">
                 🤝 ${pendingForHuman.length > 0 ? `<span class="badge-num badge-warn">${pendingForHuman.length}</span>` : ''}
               </button>`
            : ''
        }
        <button class="top-btn only-mobile-btn" data-modal="log" title="Jogadores e Histórico">📜</button>
        <button class="top-btn" data-modal="tutorial" title="Tutorial">❓</button>
        <button class="top-btn" data-modal="menu" title="Menu e Temas">⚙️</button>
      </div>
    `;

    topBar.querySelector('#btn-top-economy')?.addEventListener('click', () => {
      this.desktopTab = this.desktopTab === 'economy' ? 'action' : 'economy';
      this.renderGameScreen();
    });

    topBar.querySelectorAll('[data-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = (btn as HTMLElement).dataset.modal as ActiveModal;
        if (m === 'tutorial') this.tutorialStep = 0;
        this.activeModal = m;
        this.renderModalLayer();
      });
    });

    // Event strip
    const eventSlot = this.root.querySelector('#event-strip-slot') as HTMLElement;
    if (state.activeEvent) {
      eventSlot.innerHTML = `
        <div class="event-banner">
          <span class="event-icon">${state.activeEvent.icon}</span>
          <div class="event-text">
            <strong>${state.activeEvent.title}:</strong> ${state.activeEvent.mechanicalSummary}
          </div>
        </div>
      `;
    } else {
      eventSlot.innerHTML = '';
    }

    // Last combat floating pill
    const pill = this.root.querySelector('#last-combat-pill') as HTMLElement;
    if (state.lastCombat) {
      const diceHtml =
        state.lastCombat.diceAttacker && state.lastCombat.diceDefender
          ? `<div class="dice-strip">
               <span class="dice-group">${renderAttackIcon(state.lastCombat.mode, 15)} ${state.lastCombat.diceAttacker.map((d) => renderDieSvg(d, 'atk')).join('')}</span>
               <span class="dice-group">${renderDefenseIcon('missile_shield', 15)} ${state.lastCombat.diceDefender.map((d) => renderDieSvg(d, 'def')).join('')}</span>
             </div>`
          : '';
      pill.innerHTML = `
        <div class="combat-pill-inner">
          <p>${escapeHtml(state.lastCombat.summary)}</p>
          ${diceHtml}
        </div>
      `;
      pill.classList.add('visible');
    } else {
      pill.innerHTML = '';
      pill.classList.remove('visible');
    }

    this.renderTerritoryInfoChip();
    this.renderControlDock();
    this.updateMap();
  }

  private renderTerritoryInfoChip(): void {
    const state = this.state;
    const chip = this.root.querySelector('#territory-info-chip') as HTMLElement | null;
    if (!chip || !state) return;
    const focusId = this.targetId ?? this.selectedId;
    if (!focusId || !state.territories[focusId]) {
      chip.classList.remove('visible');
      chip.innerHTML = '';
      return;
    }
    const def = TERRITORY_BY_ID[focusId];
    const ts = state.territories[focusId];
    const owner = state.players.find((p) => p.id === ts.ownerId);
    const cont = CONTINENTS[def.continentId];
    const badges: string[] = [];
    if (ts.infrastructure?.factory) badges.push('🏭');
    if (ts.infrastructure?.port) badges.push('⚓');
    if (ts.infrastructure?.airport) badges.push('🛫');
    if (ts.infrastructure?.road) badges.push('🛣️');
    if (ts.defenses.coastal) badges.push('🏰');
    if (ts.defenses.anti_air) badges.push('📡');
    if (ts.defenses.missile_shield) badges.push('🛡️');

    chip.innerHTML = `
      <span class="color-dot-sm" style="background:${owner?.color ?? '#94a3b8'}"></span>
      <strong>${escapeHtml(def.name)}</strong>
      <span class="chip-sep">(${cont.name})</span>
      <span class="chip-troops">${ts.troops} tr.</span>
      ${badges.length > 0 ? `<span class="chip-badges">${badges.join('')}</span>` : ''}
    `;
    chip.classList.add('visible');
  }

  private getCurrentValidTargets(): Set<string> {
    const state = this.state;
    if (!state || !this.selectedId) return new Set();
    const current = state.players[state.currentPlayerIndex];
    if (current.isAI) return new Set();

    if (state.phase === 'attack') {
      return new Set(getValidTargets(state, this.selectedId, this.attackMode));
    }
    if (state.phase === 'fortify' && !state.fortifyUsed) {
      return new Set(getFortifyTargets(state, this.selectedId));
    }
    return new Set();
  }

  private updateMap(): void {
    if (!this.state || !this.mapRenderer) return;
    this.mapRenderer.render(this.state, {
      selectedId: this.selectedId,
      targetId: this.targetId,
      validTargetIds: this.getCurrentValidTargets(),
      attackMode: this.attackMode,
      activeCombatFx: this.activeCombatFx,
    });
  }

  private renderControlDock(): void {
    const state = this.state!;
    const dock = this.root.querySelector('#control-dock') as HTMLElement;
    const current = state.players[state.currentPlayerIndex];

    const hasEco = state.config.enableEconomy;
    const tabsHtml = `
      <div class="dock-tabs ${hasEco ? 'has-eco' : ''}">
        <button class="dock-tab ${this.desktopTab === 'action' ? 'active' : ''}" data-dtab="action">⚔️ Comando</button>
        ${
          hasEco
            ? `<button class="dock-tab dock-tab-eco ${this.desktopTab === 'economy' ? 'active' : ''}" data-dtab="economy">💰 Economia</button>`
            : ''
        }
        <button class="dock-tab dock-tab-desktop ${this.desktopTab === 'players' ? 'active' : ''}" data-dtab="players">Jogadores</button>
        <button class="dock-tab dock-tab-desktop ${this.desktopTab === 'log' ? 'active' : ''}" data-dtab="log">Histórico</button>
      </div>
    `;

    let bodyHtml = '';

    if (state.phase === 'game_over') {
      bodyHtml = this.buildGameOverDockHtml();
    } else if (this.desktopTab === 'players') {
      bodyHtml = this.buildPlayersListHtml();
    } else if (this.desktopTab === 'log') {
      bodyHtml = this.buildLogHtml();
    } else if (current.isAI) {
      bodyHtml = this.buildAITurnDockHtml();
    } else if (this.desktopTab === 'economy' && hasEco) {
      bodyHtml = this.buildEconomyDockHtml();
    } else if (state.phase === 'reinforce') {
      bodyHtml = this.buildReinforceDockHtml();
    } else if (state.phase === 'attack') {
      bodyHtml = this.buildAttackDockHtml();
    } else if (state.phase === 'occupy') {
      bodyHtml = this.buildOccupyDockHtml();
    } else if (state.phase === 'fortify') {
      bodyHtml = this.buildFortifyDockHtml();
    }

    dock.innerHTML = `${tabsHtml}<div class="dock-content">${bodyHtml}</div>`;

    dock.querySelectorAll('[data-dtab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.desktopTab = (btn as HTMLElement).dataset.dtab as
          | 'action'
          | 'economy'
          | 'players'
          | 'log';
        this.renderControlDock();
      });
    });

    this.bindDockActions(dock);
  }

  private buildReinforceDockHtml(): string {
    const state = this.state!;
    const current = state.players[state.currentPlayerIndex];
    const theme = THEMES[state.config.theme];
    const mustTrade = current.cards.length >= 5;
    const selectedDef = this.selectedId ? TERRITORY_BY_ID[this.selectedId] : null;
    const selectedTerr = this.selectedId ? state.territories[this.selectedId] : null;
    const isOwnedSelected = Boolean(selectedTerr && selectedTerr.ownerId === current.id);

    const calc = calculateReinforcements(state, current.id);

    const defenseButtons =
      state.config.enableSpecialWarfare && isOwnedSelected && selectedDef && selectedTerr
        ? (['coastal', 'anti_air', 'missile_shield'] as DefenseType[])
            .map((dt) => {
              const cost = getDefenseCost(state, dt);
              const built = selectedTerr.defenses[dt];
              const blockedCoast = dt === 'coastal' && !selectedDef.isCoastal;
              const disabled = built || blockedCoast || state.reinforcementsLeft < cost || mustTrade;
              const lbl = theme.defenseLabels[dt];
              return `
                <button class="def-build-btn def-btn-${dt} ${built ? 'is-built' : ''}" data-build-def="${dt}" ${disabled ? 'disabled' : ''}>
                  <span class="def-btn-label">${renderDefenseIcon(dt, 21)} <span>${lbl.short}</span></span>
                  <small>${built ? 'Ativa ✓' : blockedCoast ? 'Interior' : `-${cost} ref.`}</small>
                </button>`;
            })
            .join('')
        : '';

    return `
      <div class="phase-panel">
        <div class="phase-head">
          <div>
            <span class="phase-kicker">FASE 1 • REFORÇO</span>
            <h3>Reforços disponíveis: <span class="accent-num">${state.reinforcementsLeft}</span></h3>
          </div>
          <div class="reinforce-step-group">
            ${([1, 5, 'all'] as const)
              .map(
                (v) =>
                  `<button class="chip-btn ${this.reinforceStep === v ? 'active' : ''}" data-rstep="${v}">${v === 'all' ? 'Tudo' : `+${v}`}</button>`
              )
              .join('')}
          </div>
        </div>

        <p class="hint-text">
          ${
            mustTrade
              ? '⚠️ Você possui 5 ou mais cartas! Abra 🃏 Cartas e troque uma trinca primeiro.'
              : state.reinforcementsLeft > 0
                ? 'Toque em qualquer território seu no mapa para posicionar tropas.'
                : 'Todos os reforços posicionados! Avance para a fase de Ataque.'
          }
          <span class="calc-meta">(Base ${calc.base}${calc.continentBonus > 0 ? ` + Cont. ${calc.continentBonus}` : ''}${calc.eventBonus > 0 ? ` + Evento ${calc.eventBonus}` : ''})</span>
        </p>

        ${
          state.config.enableSpecialWarfare
            ? `<div class="defense-box">
                 <div class="defense-box-head">
                   <span>Construir Defesa ${isOwnedSelected && selectedDef ? `em <b>${selectedDef.name}</b>` : '(selecione um território seu)'}</span>
                 </div>
                 ${
                   isOwnedSelected
                     ? `<div class="defense-btn-grid">${defenseButtons}</div>`
                     : `<small class="muted-note">Toque em um território seu para instalar Costa Fortificada, Antiaérea ou Escudo Antimíssil.</small>`
                 }
               </div>`
            : ''
        }

        <div class="dock-footer-actions">
          ${
            mustTrade
              ? `<button class="btn btn-warning btn-block" id="btn-force-cards">🃏 Trocar Cartas (${current.cards.length})</button>`
              : `<button class="btn btn-primary btn-block" id="btn-next-phase" ${state.reinforcementsLeft > 0 ? 'disabled' : ''}>
                   Ir para Ataque →
                 </button>`
          }
        </div>
      </div>
    `;
  }

  private buildAttackDockHtml(): string {
    const state = this.state!;
    const current = state.players[state.currentPlayerIndex];
    const theme = THEMES[state.config.theme];
    const modes: AttackMode[] = state.config.enableSpecialWarfare
      ? ['land', 'naval', 'air', 'missile']
      : ['land'];

    const fromDef = this.selectedId ? TERRITORY_BY_ID[this.selectedId] : null;
    const fromState = this.selectedId ? state.territories[this.selectedId] : null;
    const toDef = this.targetId ? TERRITORY_BY_ID[this.targetId] : null;
    const toState = this.targetId ? state.territories[this.targetId] : null;

    const modeTabs = modes
      .map((m) => {
        const lbl = theme.attackLabels[m];
        const cd = m === 'missile' && current.missileCooldown > 0 ? ` (${current.missileCooldown}t)` : '';
        return `
          <button class="mode-btn mode-btn-${m} ${this.attackMode === m ? 'active' : ''}" data-amode="${m}">
            <span class="mode-ico">${renderAttackIcon(m, 28, fromState?.troops)}</span>
            <span class="mode-lbl">${lbl.short}${cd}</span>
          </button>`;
      })
      .join('');

    let previewHtml = '';
    if (this.selectedId && this.targetId && fromDef && toDef && fromState && toState) {
      const prev = previewCombat(state, this.selectedId, this.targetId, this.attackMode);
      if (prev.canAttack) {
        const atkProfile = getCombatUnitProfile(this.attackMode, fromState.troops);
        const defLandIcon = getLandUnitIconId(toState.troops);
        const notesHtml = prev.notes.map((n) => `<li>${n}</li>`).join('');
        previewHtml = `
          <div class="combat-preview-card">
            <div class="preview-header">
              <span><b>${fromDef.name}</b> (${fromState.troops}) → <b>${toDef.name}</b> (${toState.troops})</span>
              <span class="chance-badge ${prev.winChancePct >= 60 ? 'good' : prev.winChancePct >= 45 ? 'mid' : 'risk'}">
                ${this.attackMode === 'missile' ? (prev.defenseTriggered ? 'Interceptado' : 'Impacto Direto') : `${prev.winChancePct}% força`}
              </span>
            </div>
            <div class="unit-matchup-strip">
              <span class="matchup-side">
                ${atkProfile.baseIconId ? `${renderUnitIcon(atkProfile.baseIconId, 16)} → ` : ''}${renderUnitIcon(atkProfile.iconId, 18)}
                <b>${atkProfile.unitName}</b>
              </span>
              <span class="matchup-vs">vs</span>
              <span class="matchup-side">
                ${renderUnitIcon(defLandIcon, 17, '#e2e8f0')}
                ${prev.defenseTriggered ? renderDefenseIcon(prev.defenseTriggered, 18) : ''}
              </span>
            </div>
            <div class="preview-stats">
              <span>Baixas esperadas: Atq <b>${prev.expectedAttackerLoss}</b> | Def <b>${prev.expectedDefenderLoss}</b></span>
            </div>
            ${notesHtml ? `<ul class="preview-notes">${notesHtml}</ul>` : ''}
            <div class="preview-actions">
              <button class="btn btn-danger btn-lg flex-1" id="btn-exec-attack">
                ${renderUnitIcon(atkProfile.iconId, 20, '#ffffff')} ${this.attackMode === 'missile' ? 'Lançar Míssil' : 'Atacar!'}
              </button>
              ${
                this.attackMode !== 'missile'
                  ? `<button class="btn btn-warning" id="btn-blitz-attack" title="Repete ataques enquanto tiver vantagem ou até conquistar">⚡ Blitz</button>`
                  : ''
              }
            </div>
          </div>
        `;
      } else {
        previewHtml = `<div class="warn-box">${prev.reason ?? 'Ataque indisponível.'}</div>`;
      }
    } else {
      const guidance = !this.selectedId
        ? '1. Toque em um território SEU com 2+ tropas para escolher a origem.'
        : `Origem: ${fromDef?.name} (${fromState?.troops} tropas — ${getCombatUnitProfile(this.attackMode, fromState?.troops).unitName}). 2. Toque em um alvo destacado.`;
      previewHtml = `<p class="hint-text">${guidance}</p>`;
    }

    return `
      <div class="phase-panel">
        <div class="mode-selector-grid">${modeTabs}</div>
        ${previewHtml}
        <div class="dock-footer-actions">
          <button class="btn btn-fortify-go btn-block" id="btn-next-phase">
            ${renderFortifyIcon(18)} Ir para Fortificação →
          </button>
        </div>
      </div>
    `;
  }

  private buildOccupyDockHtml(): string {
    const state = this.state!;
    const pc = state.pendingConquest!;
    const fromDef = TERRITORY_BY_ID[pc.fromId];
    const toDef = TERRITORY_BY_ID[pc.toId];
    this.occupyAmount = Math.max(pc.minMove, Math.min(pc.maxMove, this.occupyAmount));

    return `
      <div class="phase-panel occupy-panel">
        <span class="phase-kicker">TERRITÓRIO CONQUISTADO!</span>
        <h3>Ocupar ${toDef.name}</h3>
        <p class="hint-text">Quantas tropas de <b>${fromDef.name}</b> avançam para <b>${toDef.name}</b>? (${pc.minMove} a ${pc.maxMove})</p>
        <div class="slider-row">
          <input type="range" id="occupy-slider" min="${pc.minMove}" max="${pc.maxMove}" value="${this.occupyAmount}" />
          <strong class="slider-val" id="occupy-val">${this.occupyAmount}</strong>
        </div>
        <div class="quick-amt-row">
          <button class="chip-btn" data-occ-set="${pc.minMove}">Mín (${pc.minMove})</button>
          <button class="chip-btn" data-occ-set="${Math.max(pc.minMove, Math.ceil(pc.maxMove / 2))}">Metade</button>
          <button class="chip-btn" data-occ-set="${pc.maxMove}">Máx (${pc.maxMove})</button>
        </div>
        <button class="btn btn-success btn-block btn-lg" id="btn-confirm-occupy">✓ Confirmar Ocupação</button>
      </div>
    `;
  }

  private buildFortifyDockHtml(): string {
    const state = this.state!;
    const fromDef = this.selectedId ? TERRITORY_BY_ID[this.selectedId] : null;
    const fromState = this.selectedId ? state.territories[this.selectedId] : null;
    const toDef = this.targetId ? TERRITORY_BY_ID[this.targetId] : null;

    let body = '';
    if (state.fortifyUsed) {
      body = `<p class="hint-text">✓ Remanejamento concluído neste turno. Encerre seu turno para passar a vez.</p>`;
    } else if (fromDef && fromState && toDef && fromState.troops >= 2) {
      const maxMove = fromState.troops - 1;
      this.fortifyAmount = Math.max(1, Math.min(maxMove, this.fortifyAmount));
      body = `
        <div class="combat-preview-card">
          <p>Mover de <b>${fromDef.name}</b> para <b>${toDef.name}</b> (máx. ${maxMove}):</p>
          <div class="slider-row">
            <input type="range" id="fortify-slider" min="1" max="${maxMove}" value="${this.fortifyAmount}" />
            <strong class="slider-val" id="fortify-val">${this.fortifyAmount}</strong>
          </div>
          <div class="quick-amt-row">
            <button class="chip-btn" data-fort-set="1">1</button>
            <button class="chip-btn" data-fort-set="${Math.max(1, Math.floor(maxMove / 2))}">Metade</button>
            <button class="chip-btn" data-fort-set="${maxMove}">Máx (${maxMove})</button>
          </div>
          <button class="btn btn-primary btn-block" id="btn-exec-fortify">⇄ Remanejar Tropas</button>
        </div>
      `;
    } else {
      body = `<p class="hint-text">${
        !this.selectedId
          ? 'Opcional (1x por turno): toque em um território seu (2+ tropas) para mover tropas para outro território conectado.'
          : `Origem: ${fromDef?.name}. Toque em um território aliado destacado para receber tropas.`
      }</p>`;
    }

    return `
      <div class="phase-panel">
        <div class="phase-head">
          <div>
            <span class="phase-kicker">FASE 3 • FORTIFICAÇÃO</span>
            <h3>Remanejar Tropas</h3>
          </div>
        </div>
        ${body}
        <div class="dock-footer-actions">
          <button class="btn btn-success btn-block btn-lg" id="btn-next-phase">
            ✓ Encerrar Turno
          </button>
        </div>
      </div>
    `;
  }

  private buildAITurnDockHtml(): string {
    const state = this.state!;
    const current = state.players[state.currentPlayerIndex];
    return `
      <div class="phase-panel ai-turn-panel">
        <span class="phase-kicker">TURNO DA IA</span>
        <h3>🤖 ${escapeHtml(current.name)} está operando...</h3>
        <p class="hint-text">Acompanhe os movimentos e ataques no mapa em tempo real.</p>
        <div class="quick-amt-row">
          <button class="chip-btn ${this.aiSpeedMs === 420 ? 'active' : ''}" data-aispeed="420">1x Normal</button>
          <button class="chip-btn ${this.aiSpeedMs === 120 ? 'active' : ''}" data-aispeed="120">3x Rápido</button>
          <button class="chip-btn ${this.aiSpeedMs === 10 ? 'active' : ''}" data-aispeed="10">⚡ Instantâneo</button>
        </div>
      </div>
    `;
  }

  private buildGameOverDockHtml(): string {
    const state = this.state!;
    const winner = state.players.find((p) => p.id === state.winnerId);
    const objs = state.players
      .map(
        (p) =>
          `<li><span class="color-dot-sm" style="background:${p.color}"></span><b>${escapeHtml(p.name)}:</b> ${escapeHtml(p.objective.title)}</li>`
      )
      .join('');

    return `
      <div class="phase-panel victory-panel">
        <span class="phase-kicker">🏆 VITÓRIA!</span>
        <h3>${escapeHtml(winner?.name ?? 'Vencedor')} venceu a guerra!</h3>
        <p class="hint-text">${escapeHtml(state.winReason ?? '')}</p>
        <div class="revealed-objectives">
          <strong>Objetivos Secretos Revelados:</strong>
          <ul>${objs}</ul>
        </div>
        <button class="btn btn-primary btn-block btn-lg" id="btn-return-setup">🔄 Nova Partida</button>
      </div>
    `;
  }

  private buildEconomyDockHtml(): string {
    const state = this.state!;
    const current = state.players[state.currentPlayerIndex];
    const inc = getPlayerIncome(state, current.id);
    const canSpendPhase = state.phase === 'reinforce' || state.phase === 'attack';

    const selectedOwnedDef =
      this.selectedId && state.territories[this.selectedId]?.ownerId === current.id
        ? TERRITORY_BY_ID[this.selectedId]
        : null;
    const selectedOwnedState = selectedOwnedDef ? state.territories[selectedOwnedDef.id] : null;

    const targetEnemyDef =
      this.targetId && state.territories[this.targetId]?.ownerId !== current.id
        ? TERRITORY_BY_ID[this.targetId]
        : null;

    const subTabs = `
      <div class="eco-subtabs">
        <button class="chip-btn ${this.economySubTab === 'troops' ? 'active' : ''}" data-esub="troops">👷 Tropas</button>
        <button class="chip-btn ${this.economySubTab === 'infra' ? 'active' : ''}" data-esub="infra">🏭 Infra</button>
        <button class="chip-btn ${this.economySubTab === 'tech' ? 'active' : ''}" data-esub="tech">🔬 Tech</button>
        <button class="chip-btn ${this.economySubTab === 'bombs' ? 'active' : ''}" data-esub="bombs">💣 Bombas</button>
      </div>
    `;

    let subBody = '';

    if (this.economySubTab === 'troops') {
      const packsHtml = MANPOWER_PACKS.map((pk) => {
        const disabled = !canSpendPhase || !selectedOwnedDef || current.money < pk.cost;
        return `
          <button class="eco-btn-card" data-recruit="${pk.id}" ${disabled ? 'disabled' : ''}>
            <strong>${pk.label}</strong>
            <span class="eco-price">$${pk.cost}</span>
          </button>`;
      }).join('');

      const moneyDefBtns = state.config.enableSpecialWarfare
        ? (['coastal', 'anti_air', 'missile_shield'] as DefenseType[])
            .map((dt) => {
              const cost = getDefenseMoneyCost(current, dt);
              const built = Boolean(selectedOwnedState?.defenses[dt]);
              const blockedCoast = dt === 'coastal' && !selectedOwnedDef?.isCoastal;
              const disabled =
                !canSpendPhase || !selectedOwnedDef || built || blockedCoast || current.money < cost;
              const short = dt === 'coastal' ? 'Costa' : dt === 'anti_air' ? 'AA' : 'Escudo';
              return `
                <button class="def-build-btn def-btn-${dt} ${built ? 'is-built' : ''}" data-buy-def="${dt}" ${disabled ? 'disabled' : ''}>
                  <span class="def-btn-label">${renderDefenseIcon(dt, 18)} <span>${short}</span></span>
                  <small>${built ? 'Ativa ✓' : blockedCoast ? 'Interior' : `$${cost}`}</small>
                </button>`;
            })
            .join('')
        : '';

      subBody = `
        <div class="eco-income-bar">
          <span>Renda: <b>+$${inc.grossIncome}</b></span>
          <span>Manut.: <b>-$${inc.upkeepCost}</b> <small>(${inc.totalTroops}/${inc.freeUpkeepLimit})</small></span>
          <span>Líq.: <b class="accent-num">+$${inc.netIncome}/t</b></span>
        </div>
        <p class="hint-text">${
          selectedOwnedDef
            ? `Recrutar mão de obra em <b>${selectedOwnedDef.name}</b> (${selectedOwnedState?.troops} tropas):`
            : 'Toque em um território SEU no mapa para recrutar tropas extras com dinheiro.'
        }</p>
        <div class="eco-grid-3">${packsHtml}</div>
        ${
          state.config.enableSpecialWarfare
            ? `<div class="defense-box" style="margin-top:4px">
                 <div class="defense-box-head"><span>Financiar Defesa com $ ${selectedOwnedDef ? `em <b>${selectedOwnedDef.name}</b>` : ''}</span></div>
                 <div class="defense-btn-grid">${moneyDefBtns}</div>
               </div>`
            : ''
        }
      `;
    } else if (this.economySubTab === 'infra') {
      const cards = (Object.keys(INFRASTRUCTURE_DEFS) as InfrastructureType[])
        .map((k) => {
          const d = INFRASTRUCTURE_DEFS[k];
          const built = Boolean(selectedOwnedState?.infrastructure?.[k]);
          const blockedCoast = Boolean(d.coastalOnly && !selectedOwnedDef?.isCoastal);
          const disabled =
            !canSpendPhase || !selectedOwnedDef || built || blockedCoast || current.money < d.cost;
          return `
            <button class="eco-infra-card ${built ? 'is-built' : ''}" data-build-infra="${k}" ${disabled ? 'disabled' : ''}>
              <div class="eco-infra-head">
                <strong>${d.icon} ${d.short}</strong>
                <span class="eco-price">${built ? 'Ativa ✓' : blockedCoast ? 'Costeiro' : `$${d.cost}`}</span>
              </div>
              <small>${d.effectText}</small>
            </button>`;
        })
        .join('');

      subBody = `
        <p class="hint-text">${
          selectedOwnedDef
            ? `Construir infraestrutura em <b>${selectedOwnedDef.name}</b>:`
            : 'Toque em um território SEU no mapa para construir Fábricas, Portos, Aeroportos ou Rodovias.'
        }</p>
        <div class="eco-grid-2">${cards}</div>
      `;
    } else if (this.economySubTab === 'tech') {
      const rows = (Object.keys(TECH_DEFS) as TechBranch[])
        .map((branch) => {
          const d = TECH_DEFS[branch];
          const lvl = current.tech[branch];
          const nextCost = getTechUpgradeCost(current, branch);
          const disabled = !canSpendPhase || nextCost === null || current.money < nextCost;
          const pips = [1, 2, 3]
            .map((n) => `<span class="tech-pip ${lvl >= n ? 'filled' : ''}"></span>`)
            .join('');
          return `
            <div class="tech-row">
              <div class="tech-info">
                <div class="tech-title"><strong>${d.icon} ${d.short}</strong> <span class="tech-pips">${pips}</span></div>
                <small>${d.effectSummary}</small>
              </div>
              <button class="btn btn-sm btn-primary" data-upgrade-tech="${branch}" ${disabled ? 'disabled' : ''}>
                ${nextCost === null ? 'Máx ✓' : `Nv.${lvl + 1} ($${nextCost})`}
              </button>
            </div>`;
        })
        .join('');
      subBody = `<div class="tech-list">${rows}</div>`;
    } else {
      // Bombs & Espionage
      const bombsHtml = (Object.keys(BOMB_DEFS) as BombType[])
        .map((bt) => {
          const b = BOMB_DEFS[bt];
          const check = targetEnemyDef
            ? canDropBombOn(state, current, targetEnemyDef.id, bt)
            : { ok: false, reason: 'Selecione um território inimigo no mapa.' };
          const techLocked =
            b.requiredTech && current.tech[b.requiredTech.branch] < b.requiredTech.level;
          return `
            <div class="bomb-card">
              <div class="bomb-card-head">
                <strong>${b.icon} ${b.name}</strong>
                <span class="eco-price">$${b.cost}</span>
              </div>
              <small>${b.description}</small>
              <button class="btn btn-sm btn-danger btn-block" data-drop-bomb="${bt}" ${!check.ok ? 'disabled' : ''}>
                ${
                  techLocked
                    ? `🔒 Req. ${TECH_DEFS[b.requiredTech!.branch].short} Nv.${b.requiredTech!.level}`
                    : targetEnemyDef
                      ? check.ok
                        ? `Lançar em ${targetEnemyDef.name}`
                        : check.reason ?? 'Indisponível'
                      : 'Toque em um alvo inimigo'
                }
              </button>
            </div>`;
        })
        .join('');

      const spyRows = state.players
        .filter((p) => p.id !== current.id && !p.eliminated)
        .map((r) => {
          const known = current.revealedObjectiveIds.includes(r.id);
          return `
            <div class="spy-row">
              <span><i class="color-dot-sm" style="background:${r.color}"></i> ${escapeHtml(r.name)}</span>
              ${
                known
                  ? `<small class="spy-known">🎯 ${escapeHtml(r.objective.title)}</small>`
                  : `<button class="btn btn-sm btn-secondary" data-spy-player="${r.id}" ${current.money < ESPIONAGE_COST ? 'disabled' : ''}>🕵️ Revelar ($${ESPIONAGE_COST})</button>`
              }
            </div>`;
        })
        .join('');

      subBody = `
        <p class="hint-text">${
          targetEnemyDef
            ? `Alvo de bombardeio: <b>${targetEnemyDef.name}</b> (${state.territories[targetEnemyDef.id].troops} tropas)`
            : 'Toque em qualquer território INIMIGO no mapa para mirar uma bomba.'
        }</p>
        <div class="bomb-list">${bombsHtml}</div>
        <div class="spy-box">
          <strong>🕵️ Espionagem (Revelar Objetivo Secreto)</strong>
          ${spyRows}
        </div>
      `;
    }

    return `
      <div class="phase-panel eco-panel">
        <div class="phase-head">
          <div>
            <span class="phase-kicker">TESOURO &amp; INDÚSTRIA</span>
            <h3>Saldo: <span class="accent-num">$${current.money}</span></h3>
          </div>
          <button class="btn btn-sm btn-ghost" id="btn-back-to-cmd">← Comando</button>
        </div>
        ${subTabs}
        ${subBody}
      </div>
    `;
  }

  private buildPlayersListHtml(): string {
    const state = this.state!;
    const curr = state.players[state.currentPlayerIndex];
    const viewer = !curr.isAI ? curr : state.players.find((p) => !p.isAI) ?? curr;
    const rows = state.players
      .map((p, idx) => {
        const terrs = getPlayerTerritories(state, p.id);
        const troops = terrs.reduce((s, t) => s + t.troops, 0);
        const conts = getOwnedContinents(state, p.id);
        const score = getStrategicScore(state, p.id, conts.length);
        const isCurrent = idx === state.currentPlayerIndex;
        const spied = viewer.revealedObjectiveIds.includes(p.id);
        return `
          <div class="player-stat-row ${isCurrent ? 'is-current' : ''} ${p.eliminated ? 'is-dead' : ''}">
            <div class="pstat-left">
              <span class="color-swatch" style="background:${p.color}"></span>
              <div>
                <strong>${escapeHtml(p.name)} ${p.isAI ? '🤖' : '👤'} ${!p.eliminated ? `<span class="score-pill">⭐ ${score}</span>` : ''}</strong>
                <small>${
                  p.eliminated
                    ? 'Eliminado'
                    : `${terrs.length} territ. • ${troops} tr. • ${p.cards.length} cartas${state.config.enableEconomy ? ` • 💰 $${p.money}` : ''}`
                }</small>
                ${spied ? `<div class="spied-obj">🕵️ Objetivo: ${escapeHtml(p.objective.title)}</div>` : ''}
                ${conts.length > 0 ? `<div class="cont-tags">${conts.map((c) => `<span>${CONTINENTS[c].name}</span>`).join('')}</div>` : ''}
              </div>
            </div>
          </div>`;
      })
      .join('');
    return `<div class="players-list-box">${rows}</div>`;
  }

  private buildLogHtml(): string {
    const state = this.state!;
    const items = state.logs
      .slice(0, 45)
      .map(
        (l) => `
        <div class="log-item log-${l.type}">
          <span class="log-round">R${l.round}</span>
          <span>${escapeHtml(l.message)}</span>
        </div>`
      )
      .join('');
    return `<div class="log-list-box">${items || '<p class="hint-text">Sem registros ainda.</p>'}</div>`;
  }

  private bindDockActions(dock: HTMLElement): void {
    const state = this.state!;

    dock.querySelectorAll('[data-rstep]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const raw = (btn as HTMLElement).dataset.rstep!;
        this.reinforceStep = raw === 'all' ? 'all' : Number(raw);
        this.renderControlDock();
      });
    });

    dock.querySelectorAll('[data-build-def]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.selectedId) return;
        const dt = (btn as HTMLElement).dataset.buildDef as DefenseType;
        const res = buildDefense(state, this.selectedId, dt);
        if (!res.ok) {
          this.showToast(res.error ?? 'Erro ao construir defesa.');
        } else {
          this.persist();
          this.renderGameScreen();
        }
      });
    });

    dock.querySelector('#btn-force-cards')?.addEventListener('click', () => {
      this.activeModal = 'cards';
      this.renderModalLayer();
    });

    dock.querySelectorAll('[data-amode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.attackMode = (btn as HTMLElement).dataset.amode as AttackMode;
        this.targetId = null;
        this.renderControlDock();
        this.updateMap();
      });
    });

    dock.querySelector('#btn-exec-attack')?.addEventListener('click', () => {
      if (!this.selectedId || !this.targetId) return;
      this.performHumanAttack(false);
    });

    dock.querySelector('#btn-blitz-attack')?.addEventListener('click', () => {
      if (!this.selectedId || !this.targetId) return;
      this.performHumanAttack(true);
    });

    // Occupy controls
    const occSlider = dock.querySelector('#occupy-slider') as HTMLInputElement | null;
    const occVal = dock.querySelector('#occupy-val');
    occSlider?.addEventListener('input', () => {
      this.occupyAmount = Number(occSlider.value);
      if (occVal) occVal.textContent = String(this.occupyAmount);
    });
    dock.querySelectorAll('[data-occ-set]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.occupyAmount = Number((btn as HTMLElement).dataset.occSet);
        if (occSlider) occSlider.value = String(this.occupyAmount);
        if (occVal) occVal.textContent = String(this.occupyAmount);
      });
    });
    dock.querySelector('#btn-confirm-occupy')?.addEventListener('click', () => {
      const conqueredId = state.pendingConquest?.toId ?? null;
      const res = confirmOccupation(state, this.occupyAmount);
      if (!res.ok) {
        this.showToast(res.error ?? 'Erro na ocupação.');
      } else {
        this.selectedId = conqueredId;
        this.targetId = null;
        this.persist();
        this.renderGameScreen();
      }
    });

    // Fortify controls
    const fortSlider = dock.querySelector('#fortify-slider') as HTMLInputElement | null;
    const fortVal = dock.querySelector('#fortify-val');
    fortSlider?.addEventListener('input', () => {
      this.fortifyAmount = Number(fortSlider.value);
      if (fortVal) fortVal.textContent = String(this.fortifyAmount);
    });
    dock.querySelectorAll('[data-fort-set]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.fortifyAmount = Number((btn as HTMLElement).dataset.fortSet);
        if (fortSlider) fortSlider.value = String(this.fortifyAmount);
        if (fortVal) fortVal.textContent = String(this.fortifyAmount);
      });
    });
    dock.querySelector('#btn-exec-fortify')?.addEventListener('click', () => {
      if (!this.selectedId || !this.targetId) return;
      const res = fortifyTroops(state, this.selectedId, this.targetId, this.fortifyAmount);
      if (!res.ok) {
        this.showToast(res.error ?? 'Erro no remanejamento.');
      } else {
        this.selectedId = null;
        this.targetId = null;
        this.persist();
        this.renderGameScreen();
      }
    });

    // Advance phase / end turn
    dock.querySelector('#btn-next-phase')?.addEventListener('click', () => {
      const res = advancePhase(state);
      if (!res.ok) {
        this.showToast(res.error ?? 'Não é possível avançar agora.');
        return;
      }
      this.selectedId = null;
      this.targetId = null;
      this.persist();
      this.renderGameScreen();
      this.maybeTriggerAITurn();
    });

    dock.querySelectorAll('[data-aispeed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.aiSpeedMs = Number((btn as HTMLElement).dataset.aispeed);
        this.renderControlDock();
      });
    });

    dock.querySelector('#btn-return-setup')?.addEventListener('click', () => {
      clearSavedGame();
      this.state = null;
      this.activeModal = null;
      this.render();
    });

    // Economy panel handlers
    dock.querySelector('#btn-back-to-cmd')?.addEventListener('click', () => {
      this.desktopTab = 'action';
      this.renderGameScreen();
    });

    dock.querySelectorAll('[data-esub]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.economySubTab = (btn as HTMLElement).dataset.esub as
          | 'troops'
          | 'infra'
          | 'tech'
          | 'bombs';
        this.renderControlDock();
      });
    });

    dock.querySelectorAll('[data-recruit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.selectedId) return;
        const packId = (btn as HTMLElement).dataset.recruit as
          | 'recruit_1'
          | 'recruit_3'
          | 'recruit_5';
        const res = recruitTroopsWithMoney(state, this.selectedId, packId);
        if (!res.ok) this.showToast(res.error ?? 'Erro ao recrutar.');
        else {
          this.persist();
          this.renderGameScreen();
        }
      });
    });

    dock.querySelectorAll('[data-buy-def]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.selectedId) return;
        const dt = (btn as HTMLElement).dataset.buyDef as DefenseType;
        const res = buildDefenseWithMoney(state, this.selectedId, dt);
        if (!res.ok) this.showToast(res.error ?? 'Erro ao comprar defesa.');
        else {
          this.persist();
          this.renderGameScreen();
        }
      });
    });

    dock.querySelectorAll('[data-build-infra]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.selectedId) return;
        const it = (btn as HTMLElement).dataset.buildInfra as InfrastructureType;
        const res = buildInfrastructure(state, this.selectedId, it);
        if (!res.ok) this.showToast(res.error ?? 'Erro ao construir infraestrutura.');
        else {
          this.persist();
          this.renderGameScreen();
        }
      });
    });

    dock.querySelectorAll('[data-upgrade-tech]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const branch = (btn as HTMLElement).dataset.upgradeTech as TechBranch;
        const res = upgradeTechnology(state, branch);
        if (!res.ok) this.showToast(res.error ?? 'Erro ao pesquisar tecnologia.');
        else {
          this.showToast(`🔬 ${TECH_DEFS[branch].short} evoluído para Nível ${res.newLevel}!`);
          this.persist();
          this.renderGameScreen();
        }
      });
    });

    dock.querySelectorAll('[data-drop-bomb]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.targetId) return;
        const bt = (btn as HTMLElement).dataset.dropBomb as BombType;
        const res = dropBomb(state, this.targetId, bt);
        if (!res.ok || !res.result) this.showToast(res.error ?? 'Erro no bombardeio.');
        else {
          this.flashCombatFx(res.result);
          this.showToast(res.result.summary);
          this.persist();
          this.renderGameScreen();
        }
      });
    });

    dock.querySelectorAll('[data-spy-player]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rivalId = (btn as HTMLElement).dataset.spyPlayer!;
        const res = conductEspionage(state, rivalId);
        if (!res.ok) this.showToast(res.error ?? 'Erro na espionagem.');
        else {
          this.showToast('🕵️ Objetivo secreto do rival revelado!');
          this.persist();
          this.renderGameScreen();
        }
      });
    });
  }

  private performHumanAttack(blitz: boolean): void {
    const state = this.state!;
    if (!this.selectedId || !this.targetId) return;

    const fromId = this.selectedId;
    const toId = this.targetId;
    const minKeep = this.attackMode === 'land' ? 2 : 3;

    let lastRes: CombatResult | undefined;
    let loops = 0;
    const maxLoops = blitz ? 12 : 1;

    while (loops < maxLoops) {
      if (state.phase !== 'attack') break;
      const from = state.territories[fromId];
      const to = state.territories[toId];
      if (!from || !to || from.troops < minKeep || to.ownerId === from.ownerId) break;

      const res = executeAttack(state, fromId, toId, this.attackMode);
      if (!res.ok || !res.result) {
        if (loops === 0) this.showToast(res.error ?? 'Ataque bloqueado.');
        break;
      }
      lastRes = res.result;
      loops++;
      if (res.result.conquered || state.phase !== 'attack' || this.attackMode === 'missile') {
        break;
      }
    }

    if (lastRes) {
      this.flashCombatFx(lastRes);
      if (state.phase === 'occupy' && state.pendingConquest) {
        this.occupyAmount = state.pendingConquest.maxMove;
      } else if (lastRes.conquered) {
        this.selectedId = toId;
        this.targetId = null;
      } else if (this.attackMode === 'missile') {
        this.targetId = null;
      }
      this.persist();
      this.renderGameScreen();
    }
  }

  private handleTerritoryTap(id: string): void {
    const state = this.state;
    if (!state || state.phase === 'game_over' || state.phase === 'occupy') return;
    const current = state.players[state.currentPlayerIndex];
    if (current.isAI) return;

    const terr = state.territories[id];
    if (!terr) return;

    // When browsing Economy panel, allow selecting owned territory for infra/troops OR enemy territory for bombs cleanly!
    if (this.desktopTab === 'economy') {
      if (terr.ownerId === current.id) {
        this.selectedId = id;
        if (this.economySubTab === 'bombs') this.targetId = null;
      } else {
        this.targetId = id;
      }
      this.renderTerritoryInfoChip();
      this.renderControlDock();
      this.updateMap();
      return;
    }

    if (state.phase === 'reinforce') {
      if (terr.ownerId !== current.id) {
        this.targetId = id;
        this.renderTerritoryInfoChip();
        this.updateMap();
        this.showToast(`Território controlado por ${state.players.find((p) => p.id === terr.ownerId)?.name ?? 'inimigo'}.`);
        return;
      }
      this.selectedId = id;
      this.targetId = null;
      if (state.reinforcementsLeft > 0) {
        const amt = this.reinforceStep === 'all' ? state.reinforcementsLeft : this.reinforceStep;
        const res = placeReinforcement(state, id, amt);
        if (!res.ok) {
          this.showToast(res.error ?? '');
        } else {
          this.persist();
        }
      }
      this.desktopTab = 'action';
      this.renderGameScreen();
      return;
    }

    if (state.phase === 'attack') {
      if (terr.ownerId === current.id) {
        this.selectedId = id;
        this.targetId = null;
        this.desktopTab = 'action';
        this.renderTerritoryInfoChip();
        this.renderControlDock();
        this.updateMap();
      } else {
        if (!this.selectedId) {
          this.targetId = id;
          this.renderTerritoryInfoChip();
          this.updateMap();
          this.showToast('Primeiro selecione um território SEU de onde partirá o ataque.');
          return;
        }
        this.targetId = id;
        this.desktopTab = 'action';
        this.renderTerritoryInfoChip();
        this.renderControlDock();
        this.updateMap();
      }
      return;
    }

    if (state.phase === 'fortify') {
      if (state.fortifyUsed) {
        this.showToast('Você já remanejou tropas neste turno.');
        return;
      }
      if (terr.ownerId !== current.id) {
        this.showToast('Selecione apenas territórios seus para remanejar tropas.');
        return;
      }
      if (!this.selectedId || this.selectedId === id) {
        if (terr.troops < 2) {
          this.showToast('Escolha um território com pelo menos 2 tropas para enviar reforços.');
          return;
        }
        this.selectedId = id;
        this.targetId = null;
      } else {
        const valid = getFortifyTargets(state, this.selectedId);
        if (valid.includes(id)) {
          this.targetId = id;
          this.fortifyAmount = Math.max(1, state.territories[this.selectedId].troops - 1);
        } else {
          // Switch origin if user taps disconnected owned territory with 2+ troops
          if (terr.troops >= 2) {
            this.selectedId = id;
            this.targetId = null;
          } else {
            this.showToast('Território não conectado à origem selecionada.');
          }
        }
      }
      this.desktopTab = 'action';
      this.renderControlDock();
      this.updateMap();
    }
  }

  // =========================================================
  // AI TURN LOOP (ANIMATED & NON-BLOCKING)
  // =========================================================
  private async maybeTriggerAITurn(): Promise<void> {
    if (this.aiRunning) return;
    if (!this.state || this.state.phase === 'game_over') return;
    const current = this.state.players[this.state.currentPlayerIndex];
    if (!current.isAI) return;

    this.aiRunning = true;
    try {
      while (this.state && !this.state.winnerId) {
        const ai = this.state.players[this.state.currentPlayerIndex];
        if (!ai.isAI) break;

        this.desktopTab = 'action';
        this.renderGameScreen();
        await this.delay(this.aiSpeedMs);
        if (!this.state) break;

        runAIReinforcePhase(this.state);
        this.persist();
        this.renderGameScreen();

        let attacks = 0;
        while (this.state && this.state.phase === 'attack' && !this.state.winnerId && attacks < 9) {
          await this.delay(this.aiSpeedMs);
          if (!this.state) break;
          const res = runSingleAIAttackStep(this.state);
          if (!res) break;
          this.flashCombatFx(res);
          this.persist();
          this.renderGameScreen();
          attacks++;
        }

        if (!this.state || this.state.winnerId) break;
        await this.delay(Math.min(this.aiSpeedMs, 260));
        if (!this.state) break;

        runAIFortifyAndEndTurn(this.state);
        this.persist();
        this.renderGameScreen();
      }
    } finally {
      this.aiRunning = false;
      if (this.state) {
        this.renderGameScreen();
        const curr = this.state.players[this.state.currentPlayerIndex];
        if (!curr.isAI && this.state.pendingPactOffers.some((o) => o.toPlayerId === curr.id)) {
          this.showToast('📩 Você recebeu uma proposta de Pacto! Abra 🤝 Diplomacia.');
        }
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  // =========================================================
  // MODALS (OBJECTIVE, CARDS, DIPLOMACY, LOG, MENU, TUTORIAL)
  // =========================================================
  private renderModalLayer(): void {
    const old = this.root.querySelector('.modal-backdrop');
    if (old) old.remove();
    if (!this.activeModal) return;

    if (this.activeModal === 'tutorial') {
      const modal = renderTutorialModal(
        this.tutorialStep,
        (next) => {
          this.tutorialStep = next;
          this.renderModalLayer();
        },
        () => {
          this.activeModal = null;
          this.renderModalLayer();
        }
      );
      this.root.appendChild(modal);
      return;
    }

    if (this.activeModal === 'credits') {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.activeModal = null;
          this.renderModalLayer();
        }
      });
      const card = document.createElement('div');
      card.className = 'modal-card';
      card.innerHTML = this.buildCreditsModalHtml();
      card.querySelectorAll('[data-close]').forEach((b) =>
        b.addEventListener('click', () => {
          this.activeModal = null;
          this.renderModalLayer();
        })
      );
      backdrop.appendChild(card);
      this.root.appendChild(backdrop);
      return;
    }

    if (!this.state) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.activeModal = null;
        this.renderModalLayer();
      }
    });

    const card = document.createElement('div');
    card.className = 'modal-card';

    if (this.activeModal === 'objective') {
      card.innerHTML = this.buildObjectiveModalHtml();
    } else if (this.activeModal === 'cards') {
      card.innerHTML = this.buildCardsModalHtml();
    } else if (this.activeModal === 'diplomacy') {
      card.innerHTML = this.buildDiplomacyModalHtml();
    } else if (this.activeModal === 'log') {
      card.innerHTML = `
        <div class="modal-header">
          <h2>📜 Jogadores & Histórico</h2>
          <button class="icon-btn" data-close>✕</button>
        </div>
        <div class="modal-body">
          <h3>Placar dos Comandos</h3>
          ${this.buildPlayersListHtml()}
          <h3 style="margin-top:14px">Registro de Batalhas</h3>
          ${this.buildLogHtml()}
        </div>`;
    } else if (this.activeModal === 'menu') {
      card.innerHTML = this.buildMenuModalHtml();
    }

    card.querySelectorAll('[data-close]').forEach((b) =>
      b.addEventListener('click', () => {
        this.activeModal = null;
        this.renderModalLayer();
      })
    );

    this.bindModalActions(card);
    backdrop.appendChild(card);
    this.root.appendChild(backdrop);
  }

  private buildObjectiveModalHtml(): string {
    const state = this.state!;
    // Show current human's objective (or first human if AI turn)
    const curr = state.players[state.currentPlayerIndex];
    const viewer = !curr.isAI ? curr : state.players.find((p) => !p.isAI) ?? curr;
    const owned = getPlayerTerritories(state, viewer.id);
    const ownedConts = getOwnedContinents(state, viewer.id);

    let progressNote = `Você controla ${owned.length} de ${TERRITORIES.length} territórios.`;
    if (viewer.objective.kind === 'conquer_territories') {
      progressNote = `Progresso: ${owned.length} / ${viewer.objective.territoryCount} territórios.`;
    } else if (viewer.objective.kind === 'conquer_territories_with_two') {
      const qual = owned.filter((t) => t.troops >= (viewer.objective.minTroopsPerTerritory ?? 2)).length;
      progressNote = `Progresso: ${qual} / ${viewer.objective.territoryCount} territórios com 2+ tropas.`;
    } else if (viewer.objective.kind === 'conquer_continents' && viewer.objective.continents) {
      const done = viewer.objective.continents.filter((c) => ownedConts.includes(c)).length;
      progressNote = `Continentes do objetivo concluídos: ${done} / ${viewer.objective.continents.length}.`;
    }

    const contTable = (Object.keys(CONTINENTS) as Array<keyof typeof CONTINENTS>)
      .map((cid) => {
        const c = CONTINENTS[cid];
        const total = TERRITORIES.filter((t) => t.continentId === cid).length;
        const yours = TERRITORIES.filter(
          (t) => t.continentId === cid && state.territories[t.id].ownerId === viewer.id
        ).length;
        return `
          <div class="cont-bonus-row ${yours === total ? 'owned-all' : ''}">
            <span><i class="color-dot-sm" style="background:${c.accentColor}"></i> ${c.name}</span>
            <span>${yours}/${total} • <b>+${c.bonus}</b></span>
          </div>`;
      })
      .join('');

    return `
      <div class="modal-header">
        <h2>🎯 Objetivo Secreto</h2>
        <button class="icon-btn" data-close>✕</button>
      </div>
      <div class="modal-body">
        <div class="secret-obj-box">
          <span class="pill-badge">${escapeHtml(viewer.name)}</span>
          <h3>${escapeHtml(viewer.objective.title)}</h3>
          <p>${escapeHtml(viewer.objective.description)}</p>
          <div class="progress-line">${progressNote}</div>
        </div>
        <h3 style="margin-top:14px">Bônus de Continentes</h3>
        <div class="cont-bonus-grid">${contTable}</div>
      </div>
    `;
  }

  private buildCardsModalHtml(): string {
    const state = this.state!;
    const curr = state.players[state.currentPlayerIndex];
    const nextVal = getNextCardTradeValue(state.cardTradeCount);
    const canTradePhase = !curr.isAI && state.phase === 'reinforce';
    const autoSet = findValidCardSet(curr.cards);

    const symbolIcons: Record<string, string> = {
      triangle: '▲ Triângulo',
      square: '■ Quadrado',
      circle: '● Círculo',
      wild: '★ Curinga',
    };

    const cardsHtml =
      curr.cards.length === 0
        ? `<p class="hint-text">Você ainda não possui cartas. Conquiste ao menos 1 território no turno para receber uma carta!</p>`
        : `<div class="cards-grid">
            ${curr.cards
              .map((c) => {
                const owned = Boolean(c.territoryId && state.territories[c.territoryId]?.ownerId === curr.id);
                const selected = this.selectedCardIds.has(c.id);
                return `
                  <button class="war-card ${selected ? 'selected' : ''}" data-card-id="${c.id}">
                    <span class="card-sym">${symbolIcons[c.symbol]}</span>
                    <strong>${escapeHtml(c.territoryName)}</strong>
                    ${owned ? `<small class="owned-bonus">+2 tropas no território!</small>` : `<small>&nbsp;</small>`}
                  </button>`;
              })
              .join('')}
          </div>`;

    const selectedArr = curr.cards.filter((c) => this.selectedCardIds.has(c.id));
    const manualValid = isValidCardSet(selectedArr);

    return `
      <div class="modal-header">
        <div>
          <h2>🃏 Cartas de Troca</h2>
          <small>Próxima troca vale <b>+${nextVal} reforços</b></small>
        </div>
        <button class="icon-btn" data-close>✕</button>
      </div>
      <div class="modal-body">
        ${curr.cards.length >= 5 ? `<div class="warn-box">⚠️ Você tem ${curr.cards.length} cartas — troca obrigatória antes de reforçar ou atacar!</div>` : ''}
        ${cardsHtml}
        <p class="muted-note" style="margin-top:10px">Combine 3 cartas iguais ou 3 diferentes (Curinga substitui qualquer símbolo). Trocas só ocorrem na fase de Reforço.</p>
      </div>
      <div class="modal-footer">
        ${
          canTradePhase && autoSet
            ? `<button class="btn btn-secondary" id="btn-auto-trade">⚡ Troca Automática (+${nextVal})</button>`
            : ''
        }
        <button class="btn btn-primary" id="btn-manual-trade" ${!canTradePhase || !manualValid ? 'disabled' : ''}>
          Trocar Selecionadas (${selectedArr.length}/3)
        </button>
      </div>
    `;
  }

  private buildDiplomacyModalHtml(): string {
    const state = this.state!;
    const curr = state.players[state.currentPlayerIndex];
    const isHumanTurn = !curr.isAI;

    const incoming = state.pendingPactOffers
      .filter((o) => o.toPlayerId === curr.id)
      .map((o) => {
        const sender = state.players.find((p) => p.id === o.fromPlayerId)!;
        return `
          <div class="pact-offer-card">
            <span>🤝 <b>${escapeHtml(sender.name)}</b> propôs Pacto de Não Agressão (${o.duration} rodadas)</span>
            <div class="pact-offer-btns">
              <button class="btn btn-sm btn-success" data-accept-pact="${sender.id}">Aceitar</button>
              <button class="btn btn-sm btn-danger" data-decline-pact="${sender.id}">Recusar</button>
            </div>
          </div>`;
      })
      .join('');

    const activePacts = state.pacts
      .map((p) => {
        const pa = state.players.find((x) => x.id === p.playerA)!;
        const pb = state.players.find((x) => x.id === p.playerB)!;
        const involvesCurr = p.playerA === curr.id || p.playerB === curr.id;
        const otherId = p.playerA === curr.id ? p.playerB : p.playerA;
        return `
          <div class="pact-row">
            <span>🤝 <b>${escapeHtml(pa.name)}</b> ↔ <b>${escapeHtml(pb.name)}</b> (${p.turnsRemaining} rod.)</span>
            ${
              isHumanTurn && involvesCurr
                ? `<button class="btn btn-sm btn-danger" data-break-pact="${otherId}">Romper</button>`
                : ''
            }
          </div>`;
      })
      .join('');

    const others = state.players
      .filter((p) => p.id !== curr.id && !p.eliminated)
      .map((other) => {
        const allied = hasActivePact(state, curr.id, other.id);
        return `
          <div class="pact-row">
            <span><i class="color-dot-sm" style="background:${other.color}"></i> ${escapeHtml(other.name)} ${other.isAI ? '🤖' : '👤'}</span>
            ${
              allied
                ? `<span class="pill-badge">Pacto Ativo</span>`
                : other.isAI
                  ? `<button class="btn btn-sm btn-primary" data-propose-pact="${other.id}" ${!isHumanTurn ? 'disabled' : ''}>Propor Pacto (3 rod.)</button>`
                  : `<span class="muted-note">Jogador humano</span>`
            }
          </div>`;
      })
      .join('');

    return `
      <div class="modal-header">
        <h2>🤝 Diplomacia</h2>
        <button class="icon-btn" data-close>✕</button>
      </div>
      <div class="modal-body">
        ${incoming ? `<h3>Propostas Recebidas</h3>${incoming}` : ''}
        <h3>Pactos Ativos</h3>
        ${activePacts || '<p class="muted-note">Nenhum pacto ativo no momento.</p>'}
        <h3 style="margin-top:14px">Propor Pacto de Não Agressão</h3>
        <div class="pact-list">${others}</div>
        <p class="muted-note" style="margin-top:10px">Pactos impedem ataques mútuos por 3 rodadas. Romper um pacto mancha sua reputação diplomática (suas traições: ${curr.betrayals}).</p>
      </div>
    `;
  }

  private buildMenuModalHtml(): string {
    const state = this.state!;
    const themeBtns = (Object.keys(THEMES) as ThemeId[])
      .map(
        (tid) =>
          `<button class="chip-btn ${state.config.theme === tid ? 'active' : ''}" data-switch-theme="${tid}">${THEMES[tid].name}</button>`
      )
      .join('');

    return `
      <div class="modal-header">
        <h2>⚙️ Menu da Partida</h2>
        <button class="icon-btn" data-close>✕</button>
      </div>
      <div class="modal-body">
        <h3>Tema Visual</h3>
        <div class="theme-switch-grid">${themeBtns}</div>
        <p class="muted-note" style="margin-top:8px">${THEMES[state.config.theme].fictionNotice}</p>

        <h3 style="margin-top:16px">Legenda Rápida das Peças</h3>
        <div class="legend-grid">
          <div class="legend-item">${renderUnitIcon('infantaria', 19, '#f8fafc')}<span>1–3 Infantaria</span></div>
          <div class="legend-item">${renderUnitIcon('tanque', 19, '#f8fafc')}<span>4–7 Tanque</span></div>
          <div class="legend-item">${renderUnitIcon('artilharia', 19, '#f8fafc')}<span>8+ Artilharia</span></div>
          <div class="legend-item">${renderUnitIcon('costa', 19)}<span>Costa Fortificada</span></div>
          <div class="legend-item">${renderUnitIcon('antiaerea', 19)}<span>Antiaérea (AA)</span></div>
          <div class="legend-item">${renderUnitIcon('escudo', 19)}<span>Escudo Antimíssil</span></div>
        </div>

        <h3 style="margin-top:16px">Velocidade da IA</h3>
        <div class="quick-amt-row">
          <button class="chip-btn ${this.aiSpeedMs === 420 ? 'active' : ''}" data-menu-speed="420">1x Normal</button>
          <button class="chip-btn ${this.aiSpeedMs === 120 ? 'active' : ''}" data-menu-speed="120">3x Rápido</button>
          <button class="chip-btn ${this.aiSpeedMs === 10 ? 'active' : ''}" data-menu-speed="10">⚡ Instantâneo</button>
        </div>

        <div class="menu-stack-actions">
          <button class="btn btn-secondary btn-block" id="btn-menu-credits">🎖️ Catálogo de Unidades &amp; Créditos (CC BY)</button>
          <button class="btn btn-secondary btn-block" id="btn-manual-save">💾 Salvar Partida Agora</button>
          <button class="btn btn-ghost btn-block" id="btn-menu-tutorial">❓ Abrir Tutorial Interativo</button>
          <button class="btn btn-danger btn-block" id="btn-quit-menu">🏠 Voltar à Tela Inicial (mantém save)</button>
        </div>
      </div>
    `;
  }

  private buildCreditsModalHtml(): string {
    const groups: Array<{ title: string; ids: UnitIconId[] }> = [
      { title: 'Tropas Terrestres', ids: ['infantaria', 'tanque', 'artilharia'] },
      { title: 'Força Naval', ids: ['submarino', 'navio', 'porta_avioes'] },
      { title: 'Força Aérea & AA', ids: ['caca', 'bombardeiro', 'antiaerea'] },
      { title: 'Mísseis & Defesas', ids: ['missil', 'silo', 'escudo', 'costa'] },
    ];

    const catalogHtml = groups
      .map(
        (grp) => `
        <h3 style="margin-top:12px">${grp.title}</h3>
        <div class="unit-catalog-grid">
          ${grp.ids
            .map((id) => {
              const u = UNIT_ICONS[id];
              return `
                <div class="unit-catalog-card">
                  <div class="unit-catalog-icon">${renderUnitIcon(id, 28)}</div>
                  <strong>${u.label}</strong>
                </div>`;
            })
            .join('')}
        </div>`
      )
      .join('');

    const creditsRows = LICENSE_CREDITS.map(
      (c) => `
        <div class="credit-row">
          <div>
            <strong>${escapeHtml(c.item)}</strong>
            <small>${escapeHtml(c.author)}</small>
          </div>
          <span class="pill-badge">${escapeHtml(c.license)}</span>
        </div>`
    ).join('');

    return `
      <div class="modal-header">
        <h2>🎖️ Unidades &amp; Créditos</h2>
        <button class="icon-btn" data-close>✕</button>
      </div>
      <div class="modal-body">
        <p class="muted-note">Cada tipo de operação exibe automaticamente o ícone correspondente à força mobilizada no mapa e no painel de combate.</p>
        ${catalogHtml}
        <h3 style="margin-top:16px">Atribuições e Licenças</h3>
        <div class="credits-list">${creditsRows}</div>
      </div>
    `;
  }

  private bindModalActions(card: HTMLElement): void {
    const state = this.state!;
    const curr = state.players[state.currentPlayerIndex];

    // Cards modal
    card.querySelectorAll('[data-card-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cid = (btn as HTMLElement).dataset.cardId!;
        if (this.selectedCardIds.has(cid)) {
          this.selectedCardIds.delete(cid);
        } else if (this.selectedCardIds.size < 3) {
          this.selectedCardIds.add(cid);
        }
        this.renderModalLayer();
      });
    });

    card.querySelector('#btn-auto-trade')?.addEventListener('click', () => {
      const set = findValidCardSet(curr.cards);
      if (!set) return;
      const res = tradeCards(
        state,
        set.map((c) => c.id)
      );
      if (res.ok) {
        this.selectedCardIds.clear();
        this.showToast(`Troca concluída: +${res.bonus} reforços!`);
        this.persist();
        this.renderGameScreen();
        this.renderModalLayer();
      } else {
        this.showToast(res.error ?? '');
      }
    });

    card.querySelector('#btn-manual-trade')?.addEventListener('click', () => {
      const ids = Array.from(this.selectedCardIds);
      const res = tradeCards(state, ids);
      if (res.ok) {
        this.selectedCardIds.clear();
        this.showToast(`Troca concluída: +${res.bonus} reforços!`);
        this.persist();
        this.renderGameScreen();
        this.renderModalLayer();
      } else {
        this.showToast(res.error ?? '');
      }
    });

    // Diplomacy modal
    card.querySelectorAll('[data-propose-pact]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = (btn as HTMLElement).dataset.proposePact!;
        const res = proposePactToAI(state, curr.id, targetId, 3);
        this.showToast(res.message);
        this.persist();
        this.renderGameScreen();
        this.renderModalLayer();
      });
    });

    card.querySelectorAll('[data-break-pact]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const otherId = (btn as HTMLElement).dataset.breakPact!;
        breakPact(state, curr.id, otherId);
        this.showToast('Pacto rompido!');
        this.persist();
        this.renderGameScreen();
        this.renderModalLayer();
      });
    });

    card.querySelectorAll('[data-accept-pact]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fromId = (btn as HTMLElement).dataset.acceptPact!;
        respondToPactOffer(state, fromId, curr.id, true);
        this.showToast('Pacto de Não Agressão assinado!');
        this.persist();
        this.renderGameScreen();
        this.renderModalLayer();
      });
    });

    card.querySelectorAll('[data-decline-pact]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fromId = (btn as HTMLElement).dataset.declinePact!;
        respondToPactOffer(state, fromId, curr.id, false);
        this.showToast('Proposta recusada.');
        this.persist();
        this.renderGameScreen();
        this.renderModalLayer();
      });
    });

    // Menu modal
    card.querySelectorAll('[data-switch-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tid = (btn as HTMLElement).dataset.switchTheme as ThemeId;
        state.config.theme = tid;
        this.applyThemeClass(tid);
        this.persist();
        this.renderGameScreen();
        this.renderModalLayer();
      });
    });

    card.querySelectorAll('[data-menu-speed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.aiSpeedMs = Number((btn as HTMLElement).dataset.menuSpeed);
        this.renderModalLayer();
      });
    });

    card.querySelector('#btn-menu-credits')?.addEventListener('click', () => {
      this.activeModal = 'credits';
      this.renderModalLayer();
    });

    card.querySelector('#btn-manual-save')?.addEventListener('click', () => {
      this.persist();
      this.showToast('💾 Partida salva no navegador!');
    });

    card.querySelector('#btn-menu-tutorial')?.addEventListener('click', () => {
      this.tutorialStep = 0;
      this.activeModal = 'tutorial';
      this.renderModalLayer();
    });

    card.querySelector('#btn-quit-menu')?.addEventListener('click', () => {
      this.persist();
      this.state = null;
      this.activeModal = null;
      this.render();
    });
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
