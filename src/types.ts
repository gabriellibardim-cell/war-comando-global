export type ContinentId =
  | 'america_sul'
  | 'america_norte'
  | 'europa'
  | 'africa'
  | 'asia'
  | 'oceania';

export type SeaZone =
  | 'atlantic_north'
  | 'atlantic_south'
  | 'pacific_north'
  | 'pacific_south'
  | 'indian'
  | 'mediterranean'
  | 'arctic';

export type AttackMode = 'land' | 'naval' | 'air' | 'missile';

export type DefenseType = 'coastal' | 'anti_air' | 'missile_shield';

export type InfrastructureType = 'factory' | 'port' | 'airport' | 'road';

export type TechBranch = 'armor' | 'navy' | 'air_force' | 'missiles' | 'defense';

export type BombType = 'conventional' | 'heavy' | 'strategic';

export type CombatSystem = 'tactical' | 'classic_dice';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type ThemeId = 'classic' | 'napoleonic' | 'theater1940' | 'cyber';

export type GamePhase = 'reinforce' | 'attack' | 'occupy' | 'fortify' | 'game_over';

export type CardSymbol = 'triangle' | 'square' | 'circle' | 'wild';

export interface TerritoryDef {
  id: string;
  name: string;
  continentId: ContinentId;
  svgPath: string;
  labelX: number;
  labelY: number;
  neighbors: string[];
  isCoastal: boolean;
  seaZones: SeaZone[];
}

export interface ContinentDef {
  id: ContinentId;
  name: string;
  bonus: number;
  color: string;
  accentColor: string;
}

export interface SeaRoute {
  from: string;
  to: string;
  curved?: boolean;
  wrapEdge?: 'left-right';
}

export interface TerritoryState {
  id: string;
  ownerId: string;
  troops: number;
  defenses: {
    coastal: boolean;
    anti_air: boolean;
    missile_shield: boolean;
  };
  infrastructure: {
    factory: boolean;
    port: boolean;
    airport: boolean;
    road: boolean;
  };
}

export interface TerritoryCard {
  id: string;
  territoryId: string | null; // null for wild card
  territoryName: string;
  symbol: CardSymbol;
}

export type ObjectiveKind =
  | 'conquer_continents'
  | 'conquer_territories'
  | 'conquer_territories_with_two'
  | 'destroy_player'
  | 'world_domination';

export interface SecretObjective {
  id: string;
  kind: ObjectiveKind;
  title: string;
  description: string;
  continents?: ContinentId[];
  territoryCount?: number;
  minTroopsPerTerritory?: number;
  targetPlayerId?: string;
  fallbackTerritoryCount?: number;
}

export interface PlayerTechLevels {
  armor: number; // 0..3
  navy: number; // 0..3
  air_force: number; // 0..3
  missiles: number; // 0..3
  defense: number; // 0..3
}

export interface Player {
  id: string;
  name: string;
  color: string;
  colorName: string;
  isAI: boolean;
  difficulty: Difficulty;
  eliminated: boolean;
  cards: TerritoryCard[];
  objective: SecretObjective;
  missileCooldown: number;
  betrayals: number;
  money: number;
  lastNetIncome: number;
  tech: PlayerTechLevels;
  revealedObjectiveIds: string[]; // rival player IDs spied on
}

export interface Pact {
  id: string;
  playerA: string;
  playerB: string;
  turnsRemaining: number;
  createdRound: number;
}

export interface PendingPactOffer {
  fromPlayerId: string;
  toPlayerId: string;
  duration: number;
}

export type EventEffectType =
  | 'storm_sea_air'
  | 'good_harvest'
  | 'popular_revolt'
  | 'tech_breakthrough'
  | 'dense_fog'
  | 'allied_supply'
  | 'cold_front'
  | 'armistice_tension';

export interface RandomEvent {
  id: EventEffectType;
  title: string;
  icon: string;
  description: string;
  mechanicalSummary: string;
  affectedContinent?: ContinentId;
}

export interface PendingConquest {
  fromId: string;
  toId: string;
  minMove: number;
  maxMove: number;
  mode: AttackMode;
}

export interface CombatPreview {
  mode: AttackMode;
  canAttack: boolean;
  reason?: string;
  attackerPower: number;
  defenderPower: number;
  winChancePct: number;
  expectedAttackerLoss: string;
  expectedDefenderLoss: string;
  defenseTriggered: DefenseType | null;
  missileCost?: number;
  notes: string[];
}

export interface CombatResult {
  mode: AttackMode;
  fromId: string;
  toId: string;
  attackerId: string;
  defenderId: string;
  attackerLosses: number;
  defenderLosses: number;
  conquered: boolean;
  defenseTriggered: DefenseType | null;
  shieldConsumed: boolean;
  diceAttacker?: number[];
  diceDefender?: number[];
  summary: string;
}

export interface IncomeBreakdown {
  territoryIncome: number;
  continentIncome: number;
  infraIncome: number;
  grossIncome: number;
  totalTroops: number;
  freeUpkeepLimit: number;
  upkeepCost: number;
  netIncome: number;
}

export interface LogEntry {
  id: string;
  round: number;
  type:
    | 'info'
    | 'combat'
    | 'conquest'
    | 'event'
    | 'diplomacy'
    | 'defense'
    | 'card'
    | 'economy'
    | 'victory';
  message: string;
}

export interface GameConfig {
  players: Array<{
    name: string;
    color: string;
    colorName: string;
    isAI: boolean;
    difficulty: Difficulty;
  }>;
  combatSystem: CombatSystem;
  theme: ThemeId;
  enableRandomEvents: boolean;
  enableSpecialWarfare: boolean; // Naval, Air, Missile + Defenses
  enableDiplomacy: boolean;
  enableEconomy: boolean; // Money, Infrastructure, Techs, Manpower, Bombs
  maxRounds: number; // Score victory limit (default 25)
  victoryMode: 'objectives' | 'domination';
}

export interface GameState {
  version: number;
  config: GameConfig;
  round: number;
  currentPlayerIndex: number;
  phase: GamePhase;
  players: Player[];
  territories: Record<string, TerritoryState>;
  reinforcementsLeft: number;
  conqueredThisTurn: boolean;
  fortifyUsed: boolean;
  deck: TerritoryCard[];
  discard: TerritoryCard[];
  cardTradeCount: number;
  pacts: Pact[];
  pendingPactOffers: PendingPactOffer[];
  activeEvent: RandomEvent | null;
  pendingConquest: PendingConquest | null;
  lastCombat: CombatResult | null;
  winnerId: string | null;
  winReason: string | null;
  logs: LogEntry[];
}
