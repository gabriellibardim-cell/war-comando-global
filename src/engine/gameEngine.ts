import type {
  AttackMode,
  BombType,
  CardSymbol,
  CombatResult,
  ContinentId,
  DefenseType,
  GameConfig,
  GameState,
  InfrastructureType,
  LogEntry,
  Player,
  TechBranch,
  TerritoryCard,
  TerritoryState,
} from '../types.ts';
import { CONTINENTS, TERRITORIES, TERRITORY_BY_ID } from '../data/mapData.ts';
import { assignSecretObjectives } from '../data/objectives.ts';
import { rollRandomEvent } from '../data/events.ts';
import { THEMES } from '../data/themes.ts';
import {
  canUseAttackMode,
  getDefenseCost,
  hasActivePact,
  resolveCombat,
} from './combat.ts';
import {
  BOMB_DEFS,
  CONQUEST_LOOT_MONEY,
  ESPIONAGE_COST,
  INFRASTRUCTURE_DEFS,
  MANPOWER_PACKS,
  STARTING_MONEY,
  TECH_DEFS,
  calculateIncomeBreakdown,
  canDropBombOn,
  destroyOneInfrastructure,
  getDefenseMoneyCost,
  getStrategicScore,
  getTechUpgradeCost,
} from './economy.ts';

export const STATE_VERSION = 3;

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function addLog(
  state: GameState,
  type: LogEntry['type'],
  message: string
): void {
  state.logs.unshift({
    id: makeId('log'),
    round: state.round,
    type,
    message,
  });
  if (state.logs.length > 90) {
    state.logs.length = 90;
  }
}

function buildDeck(): TerritoryCard[] {
  const symbols: CardSymbol[] = ['triangle', 'square', 'circle'];
  const deck: TerritoryCard[] = TERRITORIES.map((t, idx) => ({
    id: `card_${t.id}`,
    territoryId: t.id,
    territoryName: t.name,
    symbol: symbols[idx % 3],
  }));
  deck.push(
    { id: 'card_wild_1', territoryId: null, territoryName: 'Curinga Tático I', symbol: 'wild' },
    { id: 'card_wild_2', territoryId: null, territoryName: 'Curinga Tático II', symbol: 'wild' }
  );
  shuffle(deck);
  return deck;
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function getPlayerTerritories(state: GameState, playerId: string): TerritoryState[] {
  return Object.values(state.territories).filter((t) => t.ownerId === playerId);
}

export function getOwnedContinents(state: GameState, playerId: string): ContinentId[] {
  const owned: ContinentId[] = [];
  for (const contId of Object.keys(CONTINENTS) as ContinentId[]) {
    const contTerrs = TERRITORIES.filter((t) => t.continentId === contId);
    if (contTerrs.every((t) => state.territories[t.id]?.ownerId === playerId)) {
      owned.push(contId);
    }
  }
  return owned;
}

export function getPlayerIncome(state: GameState, playerId: string) {
  return calculateIncomeBreakdown(state, playerId, getOwnedContinents(state, playerId));
}

export function calculateReinforcements(state: GameState, playerId: string): {
  base: number;
  continentBonus: number;
  eventBonus: number;
  total: number;
  ownedContinents: ContinentId[];
} {
  const ownedTerrs = getPlayerTerritories(state, playerId);
  const base = Math.max(3, Math.floor(ownedTerrs.length / 2));
  const ownedContinents = getOwnedContinents(state, playerId);
  const continentBonus = ownedContinents.reduce((sum, c) => sum + CONTINENTS[c].bonus, 0);

  let eventBonus = 0;
  if (state.activeEvent?.id === 'good_harvest') {
    eventBonus += 2;
  }
  if (state.activeEvent?.id === 'armistice_tension') {
    const hasPact = state.pacts.some(
      (p) => p.turnsRemaining > 0 && (p.playerA === playerId || p.playerB === playerId)
    );
    if (hasPact) eventBonus += 2;
  }

  return {
    base,
    continentBonus,
    eventBonus,
    total: base + continentBonus + eventBonus,
    ownedContinents,
  };
}

export function getNextCardTradeValue(tradeCount: number): number {
  const table = [4, 6, 8, 10, 12, 15];
  if (tradeCount < table.length) return table[tradeCount];
  return 15 + (tradeCount - 5) * 5;
}

export function isValidCardSet(cards: TerritoryCard[]): boolean {
  if (cards.length !== 3) return false;
  const nonWild = cards.filter((c) => c.symbol !== 'wild').map((c) => c.symbol);
  if (nonWild.length <= 1) return true;
  if (nonWild.length === 2) return true;
  const unique = new Set(nonWild);
  return unique.size === 1 || unique.size === 3;
}

export function findValidCardSet(cards: TerritoryCard[]): TerritoryCard[] | null {
  if (cards.length < 3) return null;
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      for (let k = j + 1; k < cards.length; k++) {
        const trio = [cards[i], cards[j], cards[k]];
        if (isValidCardSet(trio)) return trio;
      }
    }
  }
  return null;
}

export function createNewGame(config: GameConfig): GameState {
  const normalizedConfig: GameConfig = {
    ...config,
    enableEconomy: config.enableEconomy ?? true,
    maxRounds: config.maxRounds ?? 25,
  };

  const players: Player[] = normalizedConfig.players.map((p, idx) => ({
    id: `p_${idx + 1}`,
    name: p.name.trim() || `Comando ${idx + 1}`,
    color: p.color,
    colorName: p.colorName,
    isAI: p.isAI,
    difficulty: p.difficulty,
    eliminated: false,
    cards: [],
    objective: {
      id: 'temp',
      kind: 'world_domination',
      title: 'Dominação',
      description: '',
    },
    missileCooldown: 0,
    betrayals: 0,
    money: normalizedConfig.enableEconomy ? STARTING_MONEY : 0,
    lastNetIncome: 0,
    tech: {
      armor: 0,
      navy: 0,
      air_force: 0,
      missiles: 0,
      defense: 0,
    },
    revealedObjectiveIds: [],
  }));

  assignSecretObjectives(players, normalizedConfig.victoryMode);

  const shuffledIds = TERRITORIES.map((t) => t.id);
  shuffle(shuffledIds);

  const territories: Record<string, TerritoryState> = {};
  shuffledIds.forEach((id, idx) => {
    const owner = players[idx % players.length];
    territories[id] = {
      id,
      ownerId: owner.id,
      troops: 1,
      defenses: {
        coastal: false,
        anti_air: false,
        missile_shield: false,
      },
      infrastructure: {
        factory: false,
        port: false,
        airport: false,
        road: false,
      },
    };
  });

  const initialPoolByCount: Record<number, number> = {
    2: 40,
    3: 35,
    4: 30,
    5: 25,
    6: 20,
  };
  const totalInitialPerPlayer = initialPoolByCount[players.length] ?? 25;

  for (const player of players) {
    const owned = Object.values(territories).filter((t) => t.ownerId === player.id);
    let extra = Math.max(0, totalInitialPerPlayer - owned.length);
    const borders = owned.filter((t) =>
      TERRITORY_BY_ID[t.id].neighbors.some((n) => territories[n].ownerId !== player.id)
    );
    const poolTargets = borders.length > 0 ? borders : owned;
    while (extra > 0) {
      const pick = poolTargets[Math.floor(Math.random() * poolTargets.length)];
      pick.troops += 1;
      extra -= 1;
    }
  }

  const state: GameState = {
    version: STATE_VERSION,
    config: normalizedConfig,
    round: 1,
    currentPlayerIndex: 0,
    phase: 'reinforce',
    players,
    territories,
    reinforcementsLeft: 0,
    conqueredThisTurn: false,
    fortifyUsed: false,
    deck: buildDeck(),
    discard: [],
    cardTradeCount: 0,
    pacts: [],
    pendingPactOffers: [],
    activeEvent: null,
    pendingConquest: null,
    lastCombat: null,
    winnerId: null,
    winReason: null,
    logs: [],
  };

  for (const p of state.players) {
    if (normalizedConfig.enableEconomy) {
      p.lastNetIncome = getPlayerIncome(state, p.id).netIncome;
    }
  }

  const firstCalc = calculateReinforcements(state, players[0].id);
  state.reinforcementsLeft = firstCalc.total;

  addLog(
    state,
    'info',
    `Partida iniciada (${players.length} jogadores, modo ${
      normalizedConfig.combatSystem === 'tactical' ? 'Combate Tático' : 'Dados Clássicos'
    }${normalizedConfig.enableEconomy ? ', Economia ativa' : ''}). Turno de ${players[0].name} (+${firstCalc.total} reforços).`
  );

  return state;
}

export function placeReinforcement(
  state: GameState,
  territoryId: string,
  amount = 1
): { ok: boolean; error?: string } {
  if (state.phase !== 'reinforce') {
    return { ok: false, error: 'Reforços só podem ser posicionados na fase de Reforço.' };
  }
  const player = state.players[state.currentPlayerIndex];
  if (player.cards.length >= 5) {
    return { ok: false, error: 'Você possui 5 ou mais cartas! Troque uma trinca primeiro.' };
  }
  const terr = state.territories[territoryId];
  if (!terr || terr.ownerId !== player.id) {
    return { ok: false, error: 'Escolha um território sob seu controle.' };
  }
  const toPlace = Math.min(amount, state.reinforcementsLeft);
  if (toPlace <= 0) {
    return { ok: false, error: 'Sem reforços restantes.' };
  }
  terr.troops += toPlace;
  state.reinforcementsLeft -= toPlace;
  return { ok: true };
}

export function buildDefense(
  state: GameState,
  territoryId: string,
  defenseType: DefenseType
): { ok: boolean; error?: string } {
  if (!state.config.enableSpecialWarfare) {
    return { ok: false, error: 'Defesas especiais estão desativadas nesta partida.' };
  }
  if (state.phase !== 'reinforce') {
    return { ok: false, error: 'Construa defesas com reforços durante a fase de Reforço (ou compre com $ em Economia).' };
  }
  const player = state.players[state.currentPlayerIndex];
  if (player.cards.length >= 5) {
    return { ok: false, error: 'Troque suas cartas antes de construir defesas.' };
  }
  const terr = state.territories[territoryId];
  const def = TERRITORY_BY_ID[territoryId];
  if (!terr || !def || terr.ownerId !== player.id) {
    return { ok: false, error: 'Escolha um território seu.' };
  }
  if (defenseType === 'coastal' && !def.isCoastal) {
    return { ok: false, error: 'Costa Fortificada só pode ser construída em territórios costeiros.' };
  }
  if (terr.defenses[defenseType]) {
    return { ok: false, error: 'Esta defesa já está construída neste território.' };
  }
  const cost = getDefenseCost(state, defenseType);
  if (state.reinforcementsLeft < cost) {
    return { ok: false, error: `Custa ${cost} reforços (você tem ${state.reinforcementsLeft}).` };
  }
  state.reinforcementsLeft -= cost;
  terr.defenses[defenseType] = true;
  const theme = THEMES[state.config.theme];
  addLog(
    state,
    'defense',
    `${player.name} construiu ${theme.defenseLabels[defenseType].icon} ${theme.defenseLabels[defenseType].name} em ${def.name} (-${cost} reforços).`
  );
  return { ok: true };
}

// ==================== ECONOMY ACTIONS ====================

export function recruitTroopsWithMoney(
  state: GameState,
  territoryId: string,
  packId: 'recruit_1' | 'recruit_3' | 'recruit_5'
): { ok: boolean; error?: string } {
  if (!state.config.enableEconomy) {
    return { ok: false, error: 'Economia desativada nesta partida.' };
  }
  if (state.phase !== 'reinforce' && state.phase !== 'attack') {
    return { ok: false, error: 'Recrute tropas na fase de Reforço ou Ataque.' };
  }
  const player = state.players[state.currentPlayerIndex];
  const terr = state.territories[territoryId];
  const def = TERRITORY_BY_ID[territoryId];
  if (!terr || !def || terr.ownerId !== player.id) {
    return { ok: false, error: 'Selecione um território sob seu controle para recrutar.' };
  }
  const pack = MANPOWER_PACKS.find((p) => p.id === packId);
  if (!pack) return { ok: false, error: 'Pacote inválido.' };
  if (player.money < pack.cost) {
    return { ok: false, error: `Custa $${pack.cost} (você tem $${player.money}).` };
  }

  player.money -= pack.cost;
  terr.troops += pack.troops;
  player.lastNetIncome = getPlayerIncome(state, player.id).netIncome;
  addLog(
    state,
    'economy',
    `💰 ${player.name} recrutou +${pack.troops} tropa(s) em ${def.name} (-$${pack.cost}).`
  );
  checkVictory(state);
  return { ok: true };
}

export function buildInfrastructure(
  state: GameState,
  territoryId: string,
  infraType: InfrastructureType
): { ok: boolean; error?: string } {
  if (!state.config.enableEconomy) {
    return { ok: false, error: 'Economia desativada nesta partida.' };
  }
  if (state.phase !== 'reinforce' && state.phase !== 'attack') {
    return { ok: false, error: 'Construa infraestrutura na fase de Reforço ou Ataque.' };
  }
  const player = state.players[state.currentPlayerIndex];
  const terr = state.territories[territoryId];
  const tDef = TERRITORY_BY_ID[territoryId];
  if (!terr || !tDef || terr.ownerId !== player.id) {
    return { ok: false, error: 'Selecione um território sob seu controle.' };
  }
  const iDef = INFRASTRUCTURE_DEFS[infraType];
  if (iDef.coastalOnly && !tDef.isCoastal) {
    return { ok: false, error: 'Porto Naval só pode ser construído em territórios costeiros.' };
  }
  if (terr.infrastructure[infraType]) {
    return { ok: false, error: `${iDef.short} já existe neste território.` };
  }
  if (player.money < iDef.cost) {
    return { ok: false, error: `Custa $${iDef.cost} (você tem $${player.money}).` };
  }

  player.money -= iDef.cost;
  terr.infrastructure[infraType] = true;
  player.lastNetIncome = getPlayerIncome(state, player.id).netIncome;
  addLog(
    state,
    'economy',
    `${iDef.icon} ${player.name} construiu ${iDef.name} em ${tDef.name} (-$${iDef.cost}).`
  );
  return { ok: true };
}

export function buildDefenseWithMoney(
  state: GameState,
  territoryId: string,
  defenseType: DefenseType
): { ok: boolean; error?: string } {
  if (!state.config.enableEconomy || !state.config.enableSpecialWarfare) {
    return { ok: false, error: 'Recurso indisponível nesta configuração.' };
  }
  if (state.phase !== 'reinforce' && state.phase !== 'attack') {
    return { ok: false, error: 'Compre defesas na fase de Reforço ou Ataque.' };
  }
  const player = state.players[state.currentPlayerIndex];
  const terr = state.territories[territoryId];
  const tDef = TERRITORY_BY_ID[territoryId];
  if (!terr || !tDef || terr.ownerId !== player.id) {
    return { ok: false, error: 'Selecione um território seu.' };
  }
  if (defenseType === 'coastal' && !tDef.isCoastal) {
    return { ok: false, error: 'Costa Fortificada exige território costeiro.' };
  }
  if (terr.defenses[defenseType]) {
    return { ok: false, error: 'Defesa já construída neste território.' };
  }
  const cost = getDefenseMoneyCost(player, defenseType);
  if (player.money < cost) {
    return { ok: false, error: `Custa $${cost} (você tem $${player.money}).` };
  }

  player.money -= cost;
  terr.defenses[defenseType] = true;
  const theme = THEMES[state.config.theme];
  addLog(
    state,
    'defense',
    `${player.name} financiou ${theme.defenseLabels[defenseType].icon} ${theme.defenseLabels[defenseType].name} em ${tDef.name} (-$${cost}).`
  );
  return { ok: true };
}

export function upgradeTechnology(
  state: GameState,
  branch: TechBranch
): { ok: boolean; newLevel?: number; error?: string } {
  if (!state.config.enableEconomy) {
    return { ok: false, error: 'Economia desativada nesta partida.' };
  }
  if (state.phase !== 'reinforce' && state.phase !== 'attack') {
    return { ok: false, error: 'Pesquise tecnologias na fase de Reforço ou Ataque.' };
  }
  const player = state.players[state.currentPlayerIndex];
  const cost = getTechUpgradeCost(player, branch);
  if (cost === null) {
    return { ok: false, error: 'Tecnologia já está no nível máximo (Nv.3).' };
  }
  if (player.money < cost) {
    return { ok: false, error: `Custa $${cost} (você tem $${player.money}).` };
  }

  player.money -= cost;
  player.tech[branch] += 1;
  const def = TECH_DEFS[branch];
  addLog(
    state,
    'economy',
    `🔬 ${player.name} desenvolveu ${def.name} para Nível ${player.tech[branch]} (-$${cost}).`
  );
  return { ok: true, newLevel: player.tech[branch] };
}

export function dropBomb(
  state: GameState,
  targetId: string,
  bombType: BombType
): { ok: boolean; result?: CombatResult; error?: string } {
  const player = state.players[state.currentPlayerIndex];
  const check = canDropBombOn(state, player, targetId, bombType);
  if (!check.ok) return { ok: false, error: check.reason };

  const bDef = BOMB_DEFS[bombType];
  const target = state.territories[targetId];
  const targetDef = TERRITORY_BY_ID[targetId];
  const owned = getPlayerTerritories(state, player.id);
  const originId = owned[0]?.id ?? targetId;

  player.money -= bDef.cost;

  // Strategic bomb intercepted by Missile Shield!
  if (bDef.blockedByShield && target.defenses.missile_shield) {
    target.defenses.missile_shield = false;
    const result: CombatResult = {
      mode: 'missile',
      fromId: originId,
      toId: targetId,
      attackerId: player.id,
      defenderId: target.ownerId,
      attackerLosses: 0,
      defenderLosses: 0,
      conquered: false,
      defenseTriggered: 'missile_shield',
      shieldConsumed: true,
      summary: `${bDef.icon} ${bDef.name} contra ${targetDef.name} foi INTERCEPTADA pelo Escudo Antimíssil (escudo descarregado, -$${bDef.cost}).`,
    };
    state.lastCombat = result;
    addLog(state, 'economy', result.summary);
    return { ok: true, result };
  }

  let rawDmg =
    bDef.minDamage + Math.floor(Math.random() * (bDef.maxDamage - bDef.minDamage + 1));
  let aaNote = '';
  if (bDef.mitigatedByAA && target.defenses.anti_air) {
    rawDmg = Math.max(1, rawDmg - 1);
    aaNote = ' (reduzida por AA)';
  }

  const actualLoss = Math.min(Math.max(0, target.troops - 1), rawDmg);
  target.troops -= actualLoss;

  let infraNote = '';
  if (bDef.destroysAllInfra) {
    const hadAny =
      target.infrastructure.factory ||
      target.infrastructure.port ||
      target.infrastructure.airport ||
      target.infrastructure.road;
    target.infrastructure = { factory: false, port: false, airport: false, road: false };
    if (hadAny) infraNote = ' e arrasou toda a infraestrutura';
  } else if (Math.random() < bDef.destroysInfraChance) {
    const destroyed = destroyOneInfrastructure(state, targetId);
    if (destroyed) {
      infraNote = ` e destruiu ${INFRASTRUCTURE_DEFS[destroyed].short}`;
    }
  }

  // Heavy bomb also cracks 1 common defense
  if (bombType === 'heavy' && (target.defenses.coastal || target.defenses.anti_air)) {
    if (target.defenses.anti_air) {
      target.defenses.anti_air = false;
      infraNote += ' + AA';
    } else if (target.defenses.coastal) {
      target.defenses.coastal = false;
      infraNote += ' + Costa';
    }
  }

  const result: CombatResult = {
    mode: bombType === 'strategic' ? 'missile' : 'air',
    fromId: originId,
    toId: targetId,
    attackerId: player.id,
    defenderId: target.ownerId,
    attackerLosses: 0,
    defenderLosses: actualLoss,
    conquered: false,
    defenseTriggered: bDef.mitigatedByAA && target.defenses.anti_air ? 'anti_air' : null,
    shieldConsumed: false,
    summary: `${bDef.icon} ${player.name} lançou ${bDef.name} em ${targetDef.name}: -${actualLoss} tropa(s)${aaNote}${infraNote} (-$${bDef.cost}).`,
  };
  state.lastCombat = result;
  addLog(state, 'economy', result.summary);
  return { ok: true, result };
}

export function conductEspionage(
  state: GameState,
  targetPlayerId: string
): { ok: boolean; error?: string } {
  if (!state.config.enableEconomy) {
    return { ok: false, error: 'Economia desativada nesta partida.' };
  }
  const player = state.players[state.currentPlayerIndex];
  const rival = state.players.find((p) => p.id === targetPlayerId && !p.eliminated);
  if (!rival || rival.id === player.id) {
    return { ok: false, error: 'Escolha um adversário ativo.' };
  }
  if (player.revealedObjectiveIds.includes(rival.id)) {
    return { ok: false, error: `Você já conhece o objetivo secreto de ${rival.name}.` };
  }
  if (player.money < ESPIONAGE_COST) {
    return { ok: false, error: `Espionagem custa $${ESPIONAGE_COST} (você tem $${player.money}).` };
  }
  player.money -= ESPIONAGE_COST;
  player.revealedObjectiveIds.push(rival.id);
  addLog(
    state,
    'economy',
    `🕵️ ${player.name} financiou Espionagem contra ${rival.name} e descobriu seu objetivo secreto (-$${ESPIONAGE_COST})!`
  );
  return { ok: true };
}

// ==================== CARDS & COMBAT ====================

export function tradeCards(
  state: GameState,
  cardIds: string[]
): { ok: boolean; bonus?: number; territoryBonus?: string[]; error?: string } {
  if (state.phase !== 'reinforce') {
    return { ok: false, error: 'Troque cartas na fase de Reforço.' };
  }
  const player = state.players[state.currentPlayerIndex];
  const selected = cardIds
    .map((id) => player.cards.find((c) => c.id === id))
    .filter((c): c is TerritoryCard => Boolean(c));

  if (selected.length !== 3 || !isValidCardSet(selected)) {
    return {
      ok: false,
      error:
        'Selecione 3 cartas com símbolos todos iguais ou todos diferentes (Curinga substitui qualquer símbolo).',
    };
  }

  const bonus = getNextCardTradeValue(state.cardTradeCount);
  state.cardTradeCount += 1;
  state.reinforcementsLeft += bonus;

  const territoryBonus: string[] = [];
  for (const card of selected) {
    if (card.territoryId && state.territories[card.territoryId]?.ownerId === player.id) {
      state.territories[card.territoryId].troops += 2;
      territoryBonus.push(card.territoryName);
    }
  }

  player.cards = player.cards.filter((c) => !cardIds.includes(c.id));
  state.discard.push(...selected);

  const bonusText =
    territoryBonus.length > 0
      ? ` (+2 tropas extras em: ${territoryBonus.join(', ')})`
      : '';
  addLog(
    state,
    'card',
    `${player.name} trocou 3 cartas por +${bonus} reforços${bonusText}.`
  );

  return { ok: true, bonus, territoryBonus };
}

export function executeAttack(
  state: GameState,
  fromId: string,
  toId: string,
  mode: AttackMode
): { ok: boolean; result?: CombatResult; error?: string } {
  if (state.phase !== 'attack') {
    return { ok: false, error: 'Você só pode atacar na fase de Ataque.' };
  }
  const check = canUseAttackMode(state, fromId, toId, mode);
  if (!check.ok) {
    return { ok: false, error: check.reason };
  }

  const defenderId = state.territories[toId].ownerId;
  const result = resolveCombat(state, fromId, toId, mode);
  state.lastCombat = result;

  if (result.conquered) {
    const attacker = state.players[state.currentPlayerIndex];
    const fromTerr = state.territories[fromId];
    const toTerr = state.territories[toId];

    toTerr.ownerId = attacker.id;
    toTerr.defenses = { coastal: false, anti_air: false, missile_shield: false };
    // Infrastructure has a 55% chance to survive capture for the conqueror!
    toTerr.infrastructure = {
      factory: toTerr.infrastructure.factory && Math.random() < 0.55,
      port: toTerr.infrastructure.port && Math.random() < 0.65,
      airport: toTerr.infrastructure.airport && Math.random() < 0.55,
      road: toTerr.infrastructure.road && Math.random() < 0.7,
    };

    if (state.config.enableEconomy) {
      attacker.money += CONQUEST_LOOT_MONEY;
    }

    state.conqueredThisTurn = true;

    const maxMove = Math.max(1, fromTerr.troops - 1);
    const minMove = 1;

    fromTerr.troops -= 1;
    toTerr.troops = 1;

    if (maxMove > 1 && !attacker.isAI) {
      state.pendingConquest = {
        fromId,
        toId,
        minMove,
        maxMove,
        mode,
      };
      state.phase = 'occupy';
    }

    addLog(
      state,
      'conquest',
      `${result.summary}${state.config.enableEconomy ? ` (+$${CONQUEST_LOOT_MONEY} saque)` : ''}`
    );

    const defenderRemaining = getPlayerTerritories(state, defenderId);
    if (defenderRemaining.length === 0) {
      const defender = state.players.find((p) => p.id === defenderId)!;
      defender.eliminated = true;
      // Inherit defender's treasury + cards
      if (state.config.enableEconomy && defender.money > 0) {
        const seized = Math.round(defender.money * 0.5);
        attacker.money += seized;
        defender.money = 0;
        addLog(state, 'economy', `${attacker.name} confiscou $${seized} do tesouro de ${defender.name}!`);
      }
      if (defender.cards.length > 0) {
        attacker.cards.push(...defender.cards);
        addLog(
          state,
          'card',
          `${attacker.name} eliminou ${defender.name} e capturou ${defender.cards.length} carta(s)!`
        );
        defender.cards = [];
      } else {
        addLog(state, 'conquest', `${attacker.name} eliminou completamente ${defender.name}!`);
      }

      state.pacts = state.pacts.filter(
        (p) => p.playerA !== defenderId && p.playerB !== defenderId
      );

      for (const p of state.players) {
        if (
          !p.eliminated &&
          p.id !== attacker.id &&
          p.objective.kind === 'destroy_player' &&
          p.objective.targetPlayerId === defenderId
        ) {
          p.objective = {
            id: `fallback_${p.id}`,
            kind: 'conquer_territories',
            title: 'Objetivo Substituto: 24 Territórios',
            description: `${defender.name} foi eliminado por outro jogador. Agora conquiste 24 territórios!`,
            territoryCount: p.objective.fallbackTerritoryCount ?? 24,
          };
        }
      }

      if (
        attacker.objective.kind === 'destroy_player' &&
        attacker.objective.targetPlayerId === defenderId
      ) {
        state.winnerId = attacker.id;
        state.winReason = `Objetivo secreto cumprido: ${attacker.objective.title}!`;
        state.phase = 'game_over';
        state.pendingConquest = null;
        addLog(state, 'victory', `🏆 ${attacker.name} venceu a partida! (${state.winReason})`);
        return { ok: true, result };
      }
    }

    checkVictory(state);
  } else {
    addLog(state, 'combat', result.summary);
  }

  return { ok: true, result };
}

export function confirmOccupation(
  state: GameState,
  totalMove: number
): { ok: boolean; error?: string } {
  if (state.phase !== 'occupy' || !state.pendingConquest) {
    return { ok: false, error: 'Nenhuma ocupação pendente.' };
  }
  const { fromId, toId, minMove, maxMove } = state.pendingConquest;
  const clamped = Math.max(minMove, Math.min(maxMove, Math.floor(totalMove)));
  const extraMove = clamped - 1;
  if (extraMove > 0) {
    state.territories[fromId].troops -= extraMove;
    state.territories[toId].troops += extraMove;
  }
  state.pendingConquest = null;
  state.phase = state.winnerId ? 'game_over' : 'attack';
  checkVictory(state);
  return { ok: true };
}

export function areOwnedConnected(
  state: GameState,
  playerId: string,
  fromId: string,
  toId: string
): boolean {
  if (fromId === toId) return false;
  if (
    state.territories[fromId]?.ownerId !== playerId ||
    state.territories[toId]?.ownerId !== playerId
  ) {
    return false;
  }
  const visited = new Set<string>([fromId]);
  const queue = [fromId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const next of TERRITORY_BY_ID[curr].neighbors) {
      if (next === toId) return true;
      if (!visited.has(next) && state.territories[next]?.ownerId === playerId) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

export function getFortifyTargets(state: GameState, fromId: string): string[] {
  const player = state.players[state.currentPlayerIndex];
  const from = state.territories[fromId];
  if (!from || from.ownerId !== player.id || from.troops < 2) return [];
  const visited = new Set<string>([fromId]);
  const queue = [fromId];
  const targets: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const next of TERRITORY_BY_ID[curr].neighbors) {
      if (!visited.has(next) && state.territories[next]?.ownerId === player.id) {
        visited.add(next);
        targets.push(next);
        queue.push(next);
      }
    }
  }
  return targets;
}

export function fortifyTroops(
  state: GameState,
  fromId: string,
  toId: string,
  amount: number
): { ok: boolean; error?: string } {
  if (state.phase !== 'fortify') {
    return { ok: false, error: 'Remanejamento só ocorre na fase de Fortificação.' };
  }
  if (state.fortifyUsed) {
    return { ok: false, error: 'Você já realizou seu remanejamento neste turno.' };
  }
  const player = state.players[state.currentPlayerIndex];
  const from = state.territories[fromId];
  const to = state.territories[toId];
  if (!from || !to || from.ownerId !== player.id || to.ownerId !== player.id) {
    return { ok: false, error: 'Selecione dois territórios sob seu controle.' };
  }
  if (!areOwnedConnected(state, player.id, fromId, toId)) {
    return { ok: false, error: 'Os territórios precisam estar conectados por uma rota sob seu controle.' };
  }
  const maxMovable = from.troops - 1;
  if (maxMovable < 1 || amount < 1 || amount > maxMovable) {
    return { ok: false, error: `Mova entre 1 e ${maxMovable} tropas (mínimo 1 permanece na origem).` };
  }

  from.troops -= amount;
  to.troops += amount;
  state.fortifyUsed = true;
  addLog(
    state,
    'info',
    `${player.name} remanejou ${amount} tropa(s) de ${TERRITORY_BY_ID[fromId].name} para ${TERRITORY_BY_ID[toId].name}.`
  );
  checkVictory(state);
  return { ok: true };
}

export function advancePhase(state: GameState): { ok: boolean; error?: string } {
  if (state.phase === 'game_over') return { ok: false, error: 'Partida encerrada.' };
  if (state.phase === 'occupy') {
    return { ok: false, error: 'Confirme quantas tropas ocuparão o território conquistado.' };
  }
  const player = state.players[state.currentPlayerIndex];

  if (state.phase === 'reinforce') {
    if (player.cards.length >= 5) {
      return { ok: false, error: 'Você tem 5 ou mais cartas — realize uma troca obrigatória.' };
    }
    if (state.reinforcementsLeft > 0) {
      return {
        ok: false,
        error: `Distribua os ${state.reinforcementsLeft} reforço(s) restante(s) antes de atacar.`,
      };
    }
    state.phase = 'attack';
    return { ok: true };
  }

  if (state.phase === 'attack') {
    state.phase = 'fortify';
    return { ok: true };
  }

  if (state.phase === 'fortify') {
    endTurn(state);
    return { ok: true };
  }

  return { ok: false };
}

function drawCard(state: GameState, player: Player): void {
  if (state.deck.length === 0 && state.discard.length > 0) {
    state.deck = [...state.discard];
    state.discard = [];
    shuffle(state.deck);
  }
  const card = state.deck.pop();
  if (card) {
    player.cards.push(card);
    addLog(state, 'card', `${player.name} recebeu uma carta de território por conquista no turno.`);
  }
}

export function applyRoundEvent(state: GameState): void {
  if (!state.config.enableRandomEvents) {
    state.activeEvent = null;
    return;
  }
  if (state.round < 2 || Math.random() > 0.72) {
    state.activeEvent = null;
    return;
  }

  const ev = rollRandomEvent();
  state.activeEvent = ev;
  addLog(state, 'event', `${ev.icon} EVENTO DA RODADA: ${ev.title} — ${ev.mechanicalSummary}`);

  if (ev.id === 'popular_revolt' && ev.affectedContinent) {
    let affected = 0;
    for (const def of TERRITORIES) {
      if (def.continentId === ev.affectedContinent) {
        const t = state.territories[def.id];
        if (t.troops >= 3) {
          t.troops -= 1;
          affected++;
        }
      }
    }
    if (affected > 0) {
      addLog(
        state,
        'event',
        `Revolta afetou ${affected} guarnição(ões) em ${CONTINENTS[ev.affectedContinent].name}.`
      );
    }
  } else if (ev.id === 'tech_breakthrough') {
    for (const p of state.players) {
      if (!p.eliminated && p.missileCooldown > 0) {
        p.missileCooldown = Math.max(0, p.missileCooldown - 1);
      }
    }
  } else if (ev.id === 'allied_supply') {
    const alive = state.players.filter((p) => !p.eliminated);
    alive.sort(
      (a, b) =>
        getPlayerTerritories(state, a.id).length - getPlayerTerritories(state, b.id).length
    );
    const underdog = alive[0];
    if (underdog) {
      const terrs = getPlayerTerritories(state, underdog.id);
      terrs.sort((a, b) => a.troops - b.troops);
      if (terrs[0]) {
        terrs[0].troops += 3;
        addLog(
          state,
          'event',
          `Comboio entregou +3 tropas a ${underdog.name} em ${TERRITORY_BY_ID[terrs[0].id].name}.`
        );
      }
    }
  }
}

export function resolveScoreVictory(state: GameState): void {
  const alive = state.players.filter((p) => !p.eliminated);
  const ranked = alive
    .map((p) => ({
      player: p,
      score: getStrategicScore(state, p.id, getOwnedContinents(state, p.id).length),
      terrs: getPlayerTerritories(state, p.id).length,
    }))
    .sort((a, b) => b.score - a.score || b.terrs - a.terrs);

  const champ = ranked[0];
  if (!champ) return;
  state.winnerId = champ.player.id;
  state.winReason = `Vitória por Pontuação Estratégica na Rodada ${state.config.maxRounds} (${champ.score} pts • ${champ.terrs} territórios)!`;
  state.phase = 'game_over';
  state.pendingConquest = null;
  addLog(state, 'victory', `🏆 ${champ.player.name} venceu por pontos! (${state.winReason})`);
}

export function endTurn(state: GameState): void {
  if (state.phase === 'game_over') return;
  const current = state.players[state.currentPlayerIndex];

  if (state.conqueredThisTurn) {
    drawCard(state, current);
  }

  if (checkVictory(state)) return;

  let nextIdx = state.currentPlayerIndex;
  let wrapped = false;
  for (let i = 0; i < state.players.length; i++) {
    nextIdx = (nextIdx + 1) % state.players.length;
    if (nextIdx <= state.currentPlayerIndex) {
      wrapped = true;
    }
    if (!state.players[nextIdx].eliminated) break;
  }

  if (wrapped) {
    // Check max rounds limit for score victory!
    const maxRounds = state.config.maxRounds || 25;
    if (state.round >= maxRounds) {
      resolveScoreVictory(state);
      return;
    }

    state.round += 1;
    for (const pact of state.pacts) {
      pact.turnsRemaining -= 1;
    }
    const expired = state.pacts.filter((p) => p.turnsRemaining <= 0);
    for (const exp of expired) {
      const pa = state.players.find((p) => p.id === exp.playerA);
      const pb = state.players.find((p) => p.id === exp.playerB);
      if (pa && pb) {
        addLog(state, 'diplomacy', `Pacto entre ${pa.name} e ${pb.name} expirou.`);
      }
    }
    state.pacts = state.pacts.filter((p) => p.turnsRemaining > 0);
    applyRoundEvent(state);
  }

  state.currentPlayerIndex = nextIdx;
  const nextPlayer = state.players[nextIdx];
  if (nextPlayer.missileCooldown > 0) {
    nextPlayer.missileCooldown -= 1;
  }

  state.phase = 'reinforce';
  state.conqueredThisTurn = false;
  state.fortifyUsed = false;
  state.pendingConquest = null;

  const calc = calculateReinforcements(state, nextPlayer.id);
  state.reinforcementsLeft = calc.total;

  // Credit Economy net income at start of player's turn
  let ecoNote = '';
  if (state.config.enableEconomy) {
    const inc = getPlayerIncome(state, nextPlayer.id);
    nextPlayer.money += inc.netIncome;
    nextPlayer.lastNetIncome = inc.netIncome;
    ecoNote = `, +$${inc.netIncome} (saldo $${nextPlayer.money})`;
  }

  addLog(
    state,
    'info',
    `Rodada ${state.round}: turno de ${nextPlayer.name} (+${calc.total} reforços${ecoNote}).`
  );
}

export function checkVictory(state: GameState): boolean {
  if (state.winnerId) return true;

  const alive = state.players.filter((p) => !p.eliminated);
  if (alive.length === 1) {
    state.winnerId = alive[0].id;
    state.winReason = 'Último comando sobrevivente no globo!';
    state.phase = 'game_over';
    addLog(state, 'victory', `🏆 ${alive[0].name} venceu a partida!`);
    return true;
  }

  for (const player of alive) {
    const obj = player.objective;
    const owned = getPlayerTerritories(state, player.id);

    if (obj.kind === 'world_domination' && owned.length >= TERRITORIES.length) {
      state.winnerId = player.id;
      state.winReason = 'Dominação Global completa!';
      state.phase = 'game_over';
      addLog(state, 'victory', `🏆 ${player.name} conquistou o mundo!`);
      return true;
    }

    if (obj.kind === 'conquer_territories' && owned.length >= (obj.territoryCount ?? 24)) {
      state.winnerId = player.id;
      state.winReason = `Objetivo cumprido: ${obj.title}`;
      state.phase = 'game_over';
      addLog(state, 'victory', `🏆 ${player.name} venceu! (${state.winReason})`);
      return true;
    }

    if (obj.kind === 'conquer_territories_with_two') {
      const minT = obj.minTroopsPerTerritory ?? 2;
      const qualified = owned.filter((t) => t.troops >= minT).length;
      if (qualified >= (obj.territoryCount ?? 18)) {
        state.winnerId = player.id;
        state.winReason = `Objetivo cumprido: ${obj.title}`;
        state.phase = 'game_over';
        addLog(state, 'victory', `🏆 ${player.name} venceu! (${state.winReason})`);
        return true;
      }
    }

    if (obj.kind === 'conquer_continents' && obj.continents) {
      const ownedConts = getOwnedContinents(state, player.id);
      if (obj.continents.every((c) => ownedConts.includes(c))) {
        state.winnerId = player.id;
        state.winReason = `Objetivo cumprido: ${obj.title}`;
        state.phase = 'game_over';
        addLog(state, 'victory', `🏆 ${player.name} venceu! (${state.winReason})`);
        return true;
      }
    }
  }

  return false;
}

// ==================== DIPLOMACY ====================

export function createPact(
  state: GameState,
  playerA: string,
  playerB: string,
  duration = 3
): { ok: boolean; error?: string } {
  if (!state.config.enableDiplomacy) {
    return { ok: false, error: 'Diplomacia está desativada nesta partida.' };
  }
  if (playerA === playerB) return { ok: false, error: 'Jogador inválido.' };
  if (hasActivePact(state, playerA, playerB)) {
    return { ok: false, error: 'Já existe um pacto ativo entre vocês.' };
  }
  state.pacts.push({
    id: makeId('pact'),
    playerA,
    playerB,
    turnsRemaining: duration,
    createdRound: state.round,
  });
  const a = state.players.find((p) => p.id === playerA);
  const b = state.players.find((p) => p.id === playerB);
  if (a && b) {
    addLog(
      state,
      'diplomacy',
      `🤝 ${a.name} e ${b.name} assinaram um Pacto de Não Agressão por ${duration} rodadas.`
    );
  }
  return { ok: true };
}

export function breakPact(
  state: GameState,
  breakerId: string,
  otherId: string
): { ok: boolean; error?: string } {
  const idx = state.pacts.findIndex(
    (p) =>
      (p.playerA === breakerId && p.playerB === otherId) ||
      (p.playerA === otherId && p.playerB === breakerId)
  );
  if (idx === -1) return { ok: false, error: 'Nenhum pacto ativo encontrado.' };
  state.pacts.splice(idx, 1);
  const breaker = state.players.find((p) => p.id === breakerId);
  const other = state.players.find((p) => p.id === otherId);
  if (breaker) breaker.betrayals += 1;
  if (breaker && other) {
    addLog(
      state,
      'diplomacy',
      `💔 ${breaker.name} rompeu o Pacto de Não Agressão com ${other.name}! (Reputação diplomática reduzida)`
    );
  }
  return { ok: true };
}

export function respondToPactOffer(
  state: GameState,
  fromPlayerId: string,
  toPlayerId: string,
  accept: boolean
): void {
  const idx = state.pendingPactOffers.findIndex(
    (o) => o.fromPlayerId === fromPlayerId && o.toPlayerId === toPlayerId
  );
  if (idx === -1) return;
  const offer = state.pendingPactOffers[idx];
  state.pendingPactOffers.splice(idx, 1);
  if (accept) {
    createPact(state, offer.fromPlayerId, offer.toPlayerId, offer.duration);
  } else {
    const from = state.players.find((p) => p.id === fromPlayerId);
    const to = state.players.find((p) => p.id === toPlayerId);
    if (from && to) {
      addLog(state, 'diplomacy', `${to.name} recusou a proposta de pacto de ${from.name}.`);
    }
  }
}
