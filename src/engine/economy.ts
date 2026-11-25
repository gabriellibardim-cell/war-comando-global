import type {
  BombType,
  DefenseType,
  GameState,
  IncomeBreakdown,
  InfrastructureType,
  Player,
  TechBranch,
} from '../types.ts';
import { CONTINENTS, TERRITORY_BY_ID, getTerritoryDistance } from '../data/mapData.ts';
import { hasActivePact } from './combat.ts';

export const STARTING_MONEY = 120;
export const CONQUEST_LOOT_MONEY = 15;
export const ESPIONAGE_COST = 90;

export interface InfraDef {
  id: InfrastructureType;
  name: string;
  short: string;
  icon: string;
  cost: number;
  incomePerTurn: number;
  coastalOnly?: boolean;
  effectText: string;
}

export const INFRASTRUCTURE_DEFS: Record<InfrastructureType, InfraDef> = {
  factory: {
    id: 'factory',
    name: 'Fábrica Industrial',
    short: 'Fábrica',
    icon: '🏭',
    cost: 60,
    incomePerTurn: 25,
    effectText: '+$25/turno e +3 limite de manutenção gratuita de tropas.',
  },
  port: {
    id: 'port',
    name: 'Porto Naval',
    short: 'Porto',
    icon: '⚓',
    cost: 55,
    incomePerTurn: 15,
    coastalOnly: true,
    effectText: '+$15/turno e +15% força em ataques Navais saindo deste território.',
  },
  airport: {
    id: 'airport',
    name: 'Aeroporto Tático',
    short: 'Aeroporto',
    icon: '🛫',
    cost: 65,
    incomePerTurn: 10,
    effectText: '+$10/turno, alcance Aéreo sobe para 3 saltos e +15% ataque Aéreo.',
  },
  road: {
    id: 'road',
    name: 'Rodovias & Logística',
    short: 'Rodovia',
    icon: '🛣️',
    cost: 50,
    incomePerTurn: 10,
    effectText: '+$10/turno e +15% ímpeto em ataques Terrestres saindo deste território.',
  },
};

export interface TechDef {
  id: TechBranch;
  name: string;
  short: string;
  icon: string;
  costs: [number, number, number]; // Levels 1, 2, 3
  effectSummary: string;
}

export const TECH_DEFS: Record<TechBranch, TechDef> = {
  armor: {
    id: 'armor',
    name: 'Blindados & Infantaria',
    short: 'Blindados',
    icon: '🪖',
    costs: [70, 120, 180],
    effectSummary: '+12% ataque Terrestre por nível (até +36%).',
  },
  navy: {
    id: 'navy',
    name: 'Doutrina Naval',
    short: 'Marinha',
    icon: '🚢',
    costs: [70, 120, 180],
    effectSummary: '+15% ataque Naval por nível; Nv.2+ reduz contra-fogo de Costa Fortificada.',
  },
  air_force: {
    id: 'air_force',
    name: 'Força Aérea',
    short: 'Aérea',
    icon: '✈️',
    costs: [70, 120, 180],
    effectSummary: '+15% ataque Aéreo por nível; Nv.1+ libera Bomba Pesada.',
  },
  missiles: {
    id: 'missiles',
    name: 'Programa de Mísseis',
    short: 'Mísseis',
    icon: '🚀',
    costs: [80, 130, 190],
    effectSummary: '+1 dano de Míssil por nível; Nv.2 reduz recarga e libera Bomba Estratégica.',
  },
  defense: {
    id: 'defense',
    name: 'Engenharia de Defesa',
    short: 'Defesas',
    icon: '🛡️',
    costs: [70, 120, 180],
    effectSummary: '+12% defesa global por nível e -20% custo em $ de defesas.',
  },
};

export interface BombDef {
  id: BombType;
  name: string;
  short: string;
  icon: string;
  cost: number;
  rangeHops: number; // Infinity for global
  minDamage: number;
  maxDamage: number;
  requiredTech?: { branch: TechBranch; level: number };
  destroysInfraChance: number; // 0..1 (1 = destroys all infra for strategic)
  destroysAllInfra?: boolean;
  blockedByShield?: boolean;
  mitigatedByAA?: boolean;
  description: string;
}

export const BOMB_DEFS: Record<BombType, BombDef> = {
  conventional: {
    id: 'conventional',
    name: 'Bomba Convencional',
    short: 'Convencional',
    icon: '💣',
    cost: 55,
    rangeHops: 2,
    minDamage: 1,
    maxDamage: 2,
    destroysInfraChance: 0.55,
    mitigatedByAA: true,
    description: 'Alcance 2 saltos. Causa 1–2 baixas (mín. 1 tropa) e pode destruir 1 infraestrutura.',
  },
  heavy: {
    id: 'heavy',
    name: 'Bomba Pesada',
    short: 'Pesada',
    icon: '🔥',
    cost: 95,
    rangeHops: 3,
    minDamage: 2,
    maxDamage: 4,
    requiredTech: { branch: 'air_force', level: 1 },
    destroysInfraChance: 1.0,
    mitigatedByAA: true,
    description: 'Requer Força Aérea Nv.1. Alcance 3 saltos. Causa 2–4 baixas e destrói 1 infraestrutura.',
  },
  strategic: {
    id: 'strategic',
    name: 'Bomba Estratégica',
    short: 'Estratégica',
    icon: '☢️',
    cost: 175,
    rangeHops: Infinity,
    minDamage: 4,
    maxDamage: 6,
    requiredTech: { branch: 'missiles', level: 2 },
    destroysInfraChance: 1.0,
    destroysAllInfra: true,
    blockedByShield: true,
    description: 'Requer Mísseis Nv.2. Alcance GLOBAL. 4–6 baixas e arrasa infraestrutura (bloqueada por Escudo).',
  },
};

export interface ManpowerPack {
  id: 'recruit_1' | 'recruit_3' | 'recruit_5';
  troops: number;
  cost: number;
  label: string;
}

export const MANPOWER_PACKS: ManpowerPack[] = [
  { id: 'recruit_1', troops: 1, cost: 30, label: '+1 Tropa' },
  { id: 'recruit_3', troops: 3, cost: 80, label: '+3 Tropas' },
  { id: 'recruit_5', troops: 5, cost: 125, label: '+5 Tropas' },
];

export const DEFENSE_MONEY_COSTS: Record<DefenseType, number> = {
  coastal: 45,
  anti_air: 45,
  missile_shield: 65,
};

export function getDefenseMoneyCost(player: Player, type: DefenseType): number {
  const base = DEFENSE_MONEY_COSTS[type];
  if (player.tech.defense >= 1) {
    return Math.round(base * 0.8);
  }
  return base;
}

export function getTechUpgradeCost(player: Player, branch: TechBranch): number | null {
  const level = player.tech[branch];
  if (level >= 3) return null;
  return TECH_DEFS[branch].costs[level];
}

export function calculateIncomeBreakdown(
  state: GameState,
  playerId: string,
  ownedContinentIds: Array<keyof typeof CONTINENTS>
): IncomeBreakdown {
  const owned = Object.values(state.territories).filter((t) => t.ownerId === playerId);
  const territoryIncome = owned.length * 10;
  const continentIncome = ownedContinentIds.reduce(
    (sum, cid) => sum + CONTINENTS[cid].bonus * 15,
    0
  );

  let infraIncome = 0;
  let factories = 0;
  let totalTroops = 0;

  for (const t of owned) {
    totalTroops += t.troops;
    if (t.infrastructure.factory) {
      infraIncome += INFRASTRUCTURE_DEFS.factory.incomePerTurn;
      factories += 1;
    }
    if (t.infrastructure.port) infraIncome += INFRASTRUCTURE_DEFS.port.incomePerTurn;
    if (t.infrastructure.airport) infraIncome += INFRASTRUCTURE_DEFS.airport.incomePerTurn;
    if (t.infrastructure.road) infraIncome += INFRASTRUCTURE_DEFS.road.incomePerTurn;
  }

  const grossIncome = territoryIncome + continentIncome + infraIncome;
  const freeUpkeepLimit = 15 + factories * 3;
  const excessTroops = Math.max(0, totalTroops - freeUpkeepLimit);
  const upkeepCost = excessTroops * 2;
  const netIncome = Math.max(10, grossIncome - upkeepCost);

  return {
    territoryIncome,
    continentIncome,
    infraIncome,
    grossIncome,
    totalTroops,
    freeUpkeepLimit,
    upkeepCost,
    netIncome,
  };
}

export function canDropBombOn(
  state: GameState,
  player: Player,
  targetId: string,
  bombType: BombType
): { ok: boolean; reason?: string } {
  if (!state.config.enableEconomy) {
    return { ok: false, reason: 'Camada econômica desativada nesta partida.' };
  }
  if (state.phase !== 'attack' && state.phase !== 'reinforce') {
    return { ok: false, reason: 'Lance bombas na fase de Reforço ou Ataque.' };
  }
  const target = state.territories[targetId];
  if (!target || target.ownerId === player.id) {
    return { ok: false, reason: 'Selecione um território inimigo como alvo.' };
  }
  if (state.config.enableDiplomacy && hasActivePact(state, player.id, target.ownerId)) {
    return { ok: false, reason: 'Pacto de Não Agressão ativo com o dono deste território.' };
  }
  const def = BOMB_DEFS[bombType];
  if (def.requiredTech) {
    const curLvl = player.tech[def.requiredTech.branch];
    if (curLvl < def.requiredTech.level) {
      return {
        ok: false,
        reason: `Requer ${TECH_DEFS[def.requiredTech.branch].short} Nv.${def.requiredTech.level}.`,
      };
    }
  }
  if (player.money < def.cost) {
    return { ok: false, reason: `Custa $${def.cost} (você tem $${player.money}).` };
  }

  if (Number.isFinite(def.rangeHops)) {
    const owned = Object.values(state.territories).filter((t) => t.ownerId === player.id);
    const inRange = owned.some((t) => {
      const extraRange = t.infrastructure.airport ? 1 : 0;
      return getTerritoryDistance(t.id, targetId) <= def.rangeHops + extraRange;
    });
    if (!inRange) {
      return {
        ok: false,
        reason: `Alvo fora de alcance (${def.rangeHops} saltos, ou +1 de um Aeroporto seu).`,
      };
    }
  }

  return { ok: true };
}

export function getStrategicScore(
  state: GameState,
  playerId: string,
  ownedContinentsCount: number
): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.eliminated) return 0;
  const owned = Object.values(state.territories).filter((t) => t.ownerId === playerId);
  let infraCount = 0;
  let troops = 0;
  for (const t of owned) {
    troops += t.troops;
    if (t.infrastructure.factory) infraCount++;
    if (t.infrastructure.port) infraCount++;
    if (t.infrastructure.airport) infraCount++;
    if (t.infrastructure.road) infraCount++;
  }
  const techSum =
    player.tech.armor +
    player.tech.navy +
    player.tech.air_force +
    player.tech.missiles +
    player.tech.defense;

  return (
    owned.length * 3 +
    ownedContinentsCount * 8 +
    Math.floor(troops / 4) +
    infraCount * 2 +
    techSum * 3 +
    Math.floor(player.money / 60)
  );
}

export function countTerritoryInfra(state: GameState, terrId: string): number {
  const t = state.territories[terrId];
  if (!t) return 0;
  return (
    (t.infrastructure.factory ? 1 : 0) +
    (t.infrastructure.port ? 1 : 0) +
    (t.infrastructure.airport ? 1 : 0) +
    (t.infrastructure.road ? 1 : 0)
  );
}

export function destroyOneInfrastructure(state: GameState, terrId: string): InfrastructureType | null {
  const t = state.territories[terrId];
  if (!t) return null;
  const active = (['factory', 'airport', 'port', 'road'] as InfrastructureType[]).filter(
    (k) => t.infrastructure[k]
  );
  if (active.length === 0) return null;
  const pick = active[Math.floor(Math.random() * active.length)];
  t.infrastructure[pick] = false;
  return pick;
}

export function getTerritoryName(terrId: string): string {
  return TERRITORY_BY_ID[terrId]?.name ?? terrId;
}
