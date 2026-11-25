import type { ContinentDef, ContinentId, SeaRoute, TerritoryDef } from '../types.ts';
import { TERRITORY_SVG_PATHS } from './mapPaths.ts';

export const MAP_Y_SCALE = 0.85;

export const CONTINENTS: Record<ContinentId, ContinentDef> = {
  america_sul: {
    id: 'america_sul',
    name: 'América do Sul',
    bonus: 2,
    color: '#9f2a3d',
    accentColor: '#fb7185',
  },
  america_norte: {
    id: 'america_norte',
    name: 'América do Norte',
    bonus: 5,
    color: '#9a7b24',
    accentColor: '#fbbf24',
  },
  europa: {
    id: 'europa',
    name: 'Europa',
    bonus: 5,
    color: '#2c5b9e',
    accentColor: '#60a5fa',
  },
  africa: {
    id: 'africa',
    name: 'África',
    bonus: 3,
    color: '#9a4f26',
    accentColor: '#fb923c',
  },
  asia: {
    id: 'asia',
    name: 'Ásia',
    bonus: 7,
    color: '#2c7a4b',
    accentColor: '#4ade80',
  },
  oceania: {
    id: 'oceania',
    name: 'Oceania',
    bonus: 2,
    color: '#733899',
    accentColor: '#c084fc',
  },
};

interface TerritorySpec {
  id: string;
  name: string;
  continentId: ContinentId;
  rawX: number;
  rawY: number;
  neighbors: string[];
  isCoastal: boolean;
  seaZones: TerritoryDef['seaZones'];
}

/**
 * 42 authentic classic War/Risk territories with plausible world geography,
 * matching real organic coastlines extracted from refs/mapa/risk-territory-diagram.svg.
 */
const TERRITORY_SPECS: TerritorySpec[] = [
  // ==================== AMÉRICA DO NORTE (9) ====================
  {
    id: 'alaska',
    name: 'Alasca',
    continentId: 'america_norte',
    rawX: 223,
    rawY: 204,
    neighbors: ['northwest_territory', 'alberta', 'kamchatka'],
    isCoastal: true,
    seaZones: ['pacific_north', 'arctic'],
  },
  {
    id: 'northwest_territory',
    name: 'Terr. Noroeste',
    continentId: 'america_norte',
    rawX: 300,
    rawY: 194,
    neighbors: ['alaska', 'alberta', 'ontario', 'greenland'],
    isCoastal: true,
    seaZones: ['arctic'],
  },
  {
    id: 'greenland',
    name: 'Groenlândia',
    continentId: 'america_norte',
    rawX: 432,
    rawY: 182,
    neighbors: ['northwest_territory', 'ontario', 'quebec', 'iceland'],
    isCoastal: true,
    seaZones: ['atlantic_north', 'arctic'],
  },
  {
    id: 'alberta',
    name: 'Alberta',
    continentId: 'america_norte',
    rawX: 285,
    rawY: 242,
    neighbors: ['alaska', 'northwest_territory', 'ontario', 'western_united_states'],
    isCoastal: false,
    seaZones: [],
  },
  {
    id: 'ontario',
    name: 'Ontário',
    continentId: 'america_norte',
    rawX: 336,
    rawY: 252,
    neighbors: [
      'northwest_territory',
      'greenland',
      'quebec',
      'eastern_united_states',
      'western_united_states',
      'alberta',
    ],
    isCoastal: true,
    seaZones: ['arctic'],
  },
  {
    id: 'quebec',
    name: 'Quebec',
    continentId: 'america_norte',
    rawX: 388,
    rawY: 258,
    neighbors: ['ontario', 'greenland', 'eastern_united_states'],
    isCoastal: true,
    seaZones: ['atlantic_north'],
  },
  {
    id: 'western_united_states',
    name: 'EUA Oeste',
    continentId: 'america_norte',
    rawX: 286,
    rawY: 294,
    neighbors: ['alberta', 'ontario', 'eastern_united_states', 'central_america'],
    isCoastal: true,
    seaZones: ['pacific_north'],
  },
  {
    id: 'eastern_united_states',
    name: 'EUA Leste',
    continentId: 'america_norte',
    rawX: 344,
    rawY: 310,
    neighbors: ['ontario', 'quebec', 'western_united_states', 'central_america'],
    isCoastal: true,
    seaZones: ['atlantic_north'],
  },
  {
    id: 'central_america',
    name: 'México',
    continentId: 'america_norte',
    rawX: 300,
    rawY: 358,
    neighbors: ['western_united_states', 'eastern_united_states', 'venezuela'],
    isCoastal: true,
    seaZones: ['pacific_north', 'atlantic_north'],
  },

  // ==================== AMÉRICA DO SUL (4) ====================
  {
    id: 'venezuela',
    name: 'Venezuela',
    continentId: 'america_sul',
    rawX: 358,
    rawY: 398,
    neighbors: ['central_america', 'peru', 'brazil'],
    isCoastal: true,
    seaZones: ['atlantic_north', 'pacific_south'],
  },
  {
    id: 'peru',
    name: 'Peru',
    continentId: 'america_sul',
    rawX: 354,
    rawY: 468,
    neighbors: ['venezuela', 'brazil', 'argentina'],
    isCoastal: true,
    seaZones: ['pacific_south'],
  },
  {
    id: 'brazil',
    name: 'Brasil',
    continentId: 'america_sul',
    rawX: 406,
    rawY: 454,
    neighbors: ['venezuela', 'peru', 'argentina', 'north_africa'],
    isCoastal: true,
    seaZones: ['atlantic_south'],
  },
  {
    id: 'argentina',
    name: 'Argentina',
    continentId: 'america_sul',
    rawX: 368,
    rawY: 525,
    neighbors: ['peru', 'brazil'],
    isCoastal: true,
    seaZones: ['atlantic_south', 'pacific_south'],
  },

  // ==================== EUROPA (7) ====================
  {
    id: 'iceland',
    name: 'Islândia',
    continentId: 'europa',
    rawX: 490,
    rawY: 222,
    neighbors: ['greenland', 'great_britain', 'scandinavia'],
    isCoastal: true,
    seaZones: ['atlantic_north', 'arctic'],
  },
  {
    id: 'great_britain',
    name: 'Grã-Bretanha',
    continentId: 'europa',
    rawX: 478,
    rawY: 280,
    neighbors: ['iceland', 'scandinavia', 'northern_europe', 'western_europe'],
    isCoastal: true,
    seaZones: ['atlantic_north'],
  },
  {
    id: 'scandinavia',
    name: 'Escandinávia',
    continentId: 'europa',
    rawX: 550,
    rawY: 222,
    neighbors: ['iceland', 'great_britain', 'northern_europe', 'ukraine'],
    isCoastal: true,
    seaZones: ['atlantic_north', 'arctic'],
  },
  {
    id: 'northern_europe',
    name: 'Europa Norte',
    continentId: 'europa',
    rawX: 540,
    rawY: 284,
    neighbors: ['great_britain', 'scandinavia', 'ukraine', 'southern_europe', 'western_europe'],
    isCoastal: true,
    seaZones: ['atlantic_north'],
  },
  {
    id: 'western_europe',
    name: 'Europa Ocid.',
    continentId: 'europa',
    rawX: 484,
    rawY: 342,
    neighbors: ['great_britain', 'northern_europe', 'southern_europe', 'north_africa'],
    isCoastal: true,
    seaZones: ['atlantic_north', 'mediterranean'],
  },
  {
    id: 'southern_europe',
    name: 'Europa Sul',
    continentId: 'europa',
    rawX: 548,
    rawY: 336,
    neighbors: ['western_europe', 'northern_europe', 'ukraine', 'middle_east', 'egypt', 'north_africa'],
    isCoastal: true,
    seaZones: ['mediterranean'],
  },
  {
    id: 'ukraine',
    name: 'Ucrânia',
    continentId: 'europa',
    rawX: 604,
    rawY: 266,
    neighbors: ['scandinavia', 'northern_europe', 'southern_europe', 'ural', 'afghanistan', 'middle_east'],
    isCoastal: true,
    seaZones: ['arctic'],
  },

  // ==================== ÁFRICA (6) ====================
  {
    id: 'north_africa',
    name: 'Norte África',
    continentId: 'africa',
    rawX: 520,
    rawY: 432,
    neighbors: ['brazil', 'western_europe', 'southern_europe', 'egypt', 'east_africa', 'congo'],
    isCoastal: true,
    seaZones: ['atlantic_north', 'atlantic_south', 'mediterranean'],
  },
  {
    id: 'egypt',
    name: 'Egito',
    continentId: 'africa',
    rawX: 572,
    rawY: 412,
    neighbors: ['southern_europe', 'middle_east', 'east_africa', 'north_africa'],
    isCoastal: true,
    seaZones: ['mediterranean', 'indian'],
  },
  {
    id: 'congo',
    name: 'Congo',
    continentId: 'africa',
    rawX: 570,
    rawY: 494,
    neighbors: ['north_africa', 'east_africa', 'south_africa'],
    isCoastal: true,
    seaZones: ['atlantic_south'],
  },
  {
    id: 'east_africa',
    name: 'África Oriental',
    continentId: 'africa',
    rawX: 608,
    rawY: 458,
    neighbors: ['egypt', 'middle_east', 'north_africa', 'congo', 'south_africa', 'madagascar'],
    isCoastal: true,
    seaZones: ['indian'],
  },
  {
    id: 'south_africa',
    name: 'África do Sul',
    continentId: 'africa',
    rawX: 578,
    rawY: 554,
    neighbors: ['congo', 'east_africa', 'madagascar'],
    isCoastal: true,
    seaZones: ['atlantic_south', 'indian'],
  },
  {
    id: 'madagascar',
    name: 'Madagascar',
    continentId: 'africa',
    rawX: 650,
    rawY: 552,
    neighbors: ['east_africa', 'south_africa'],
    isCoastal: true,
    seaZones: ['indian'],
  },

  // ==================== ÁSIA (12) ====================
  {
    id: 'middle_east',
    name: 'Oriente Médio',
    continentId: 'asia',
    rawX: 632,
    rawY: 378,
    neighbors: ['southern_europe', 'ukraine', 'afghanistan', 'india', 'east_africa', 'egypt'],
    isCoastal: true,
    seaZones: ['mediterranean', 'indian'],
  },
  {
    id: 'afghanistan',
    name: 'Afeganistão',
    continentId: 'asia',
    rawX: 675,
    rawY: 308,
    neighbors: ['ukraine', 'ural', 'china', 'india', 'middle_east'],
    isCoastal: false,
    seaZones: [],
  },
  {
    id: 'ural',
    name: 'Urais',
    continentId: 'asia',
    rawX: 682,
    rawY: 235,
    neighbors: ['ukraine', 'siberia', 'china', 'afghanistan'],
    isCoastal: false,
    seaZones: [],
  },
  {
    id: 'siberia',
    name: 'Sibéria',
    continentId: 'asia',
    rawX: 726,
    rawY: 215,
    neighbors: ['ural', 'yakutsk', 'irkutsk', 'mongolia', 'china'],
    isCoastal: true,
    seaZones: ['arctic'],
  },
  {
    id: 'yakutsk',
    name: 'Yakutsk',
    continentId: 'asia',
    rawX: 782,
    rawY: 186,
    neighbors: ['siberia', 'kamchatka', 'irkutsk'],
    isCoastal: true,
    seaZones: ['arctic'],
  },
  {
    id: 'irkutsk',
    name: 'Irkutsk',
    continentId: 'asia',
    rawX: 766,
    rawY: 252,
    neighbors: ['siberia', 'yakutsk', 'kamchatka', 'mongolia'],
    isCoastal: false,
    seaZones: [],
  },
  {
    id: 'kamchatka',
    name: 'Kamchatka',
    continentId: 'asia',
    rawX: 830,
    rawY: 204,
    neighbors: ['yakutsk', 'irkutsk', 'mongolia', 'japan', 'alaska'],
    isCoastal: true,
    seaZones: ['pacific_north', 'arctic'],
  },
  {
    id: 'mongolia',
    name: 'Mongólia',
    continentId: 'asia',
    rawX: 775,
    rawY: 300,
    neighbors: ['siberia', 'irkutsk', 'kamchatka', 'japan', 'china'],
    isCoastal: false,
    seaZones: [],
  },
  {
    id: 'japan',
    name: 'Japão',
    continentId: 'asia',
    rawX: 856,
    rawY: 298,
    neighbors: ['kamchatka', 'mongolia'],
    isCoastal: true,
    seaZones: ['pacific_north'],
  },
  {
    id: 'china',
    name: 'China',
    continentId: 'asia',
    rawX: 760,
    rawY: 350,
    neighbors: ['ural', 'siberia', 'mongolia', 'siam', 'india', 'afghanistan'],
    isCoastal: true,
    seaZones: ['pacific_north', 'pacific_south'],
  },
  {
    id: 'india',
    name: 'Índia',
    continentId: 'asia',
    rawX: 716,
    rawY: 386,
    neighbors: ['middle_east', 'afghanistan', 'china', 'siam'],
    isCoastal: true,
    seaZones: ['indian'],
  },
  {
    id: 'siam',
    name: 'Sudeste Ásia',
    continentId: 'asia',
    rawX: 774,
    rawY: 406,
    neighbors: ['india', 'china', 'indonesia'],
    isCoastal: true,
    seaZones: ['indian', 'pacific_south'],
  },

  // ==================== OCEANIA (4) ====================
  {
    id: 'indonesia',
    name: 'Indonésia',
    continentId: 'oceania',
    rawX: 776,
    rawY: 494,
    neighbors: ['siam', 'new_guinea', 'western_australia'],
    isCoastal: true,
    seaZones: ['indian', 'pacific_south'],
  },
  {
    id: 'new_guinea',
    name: 'Nova Guiné',
    continentId: 'oceania',
    rawX: 854,
    rawY: 454,
    neighbors: ['indonesia', 'western_australia', 'eastern_australia'],
    isCoastal: true,
    seaZones: ['pacific_south'],
  },
  {
    id: 'western_australia',
    name: 'Austrália O.',
    continentId: 'oceania',
    rawX: 806,
    rawY: 556,
    neighbors: ['indonesia', 'new_guinea', 'eastern_australia'],
    isCoastal: true,
    seaZones: ['indian', 'pacific_south'],
  },
  {
    id: 'eastern_australia',
    name: 'Austrália L.',
    continentId: 'oceania',
    rawX: 848,
    rawY: 540,
    neighbors: ['new_guinea', 'western_australia'],
    isCoastal: true,
    seaZones: ['pacific_south'],
  },
];

export const TERRITORIES: TerritoryDef[] = TERRITORY_SPECS.map((spec) => ({
  id: spec.id,
  name: spec.name,
  continentId: spec.continentId,
  svgPath: TERRITORY_SVG_PATHS[spec.id]?.d ?? '',
  labelX: spec.rawX,
  labelY: Math.round(spec.rawY * MAP_Y_SCALE),
  neighbors: spec.neighbors,
  isCoastal: spec.isCoastal,
  seaZones: spec.seaZones,
}));

export const TERRITORY_BY_ID: Record<string, TerritoryDef> = Object.fromEntries(
  TERRITORIES.map((t) => [t.id, t])
);

export const SEA_ROUTES: SeaRoute[] = [
  { from: 'alaska', to: 'kamchatka', wrapEdge: 'left-right' },
  { from: 'northwest_territory', to: 'greenland' },
  { from: 'ontario', to: 'greenland' },
  { from: 'quebec', to: 'greenland' },
  { from: 'greenland', to: 'iceland' },
  { from: 'iceland', to: 'great_britain' },
  { from: 'iceland', to: 'scandinavia' },
  { from: 'great_britain', to: 'scandinavia' },
  { from: 'great_britain', to: 'northern_europe' },
  { from: 'great_britain', to: 'western_europe' },
  { from: 'brazil', to: 'north_africa', curved: true },
  { from: 'western_europe', to: 'north_africa' },
  { from: 'southern_europe', to: 'north_africa' },
  { from: 'southern_europe', to: 'egypt' },
  { from: 'east_africa', to: 'middle_east' },
  { from: 'east_africa', to: 'madagascar' },
  { from: 'south_africa', to: 'madagascar' },
  { from: 'kamchatka', to: 'japan' },
  { from: 'mongolia', to: 'japan' },
  { from: 'siam', to: 'indonesia' },
  { from: 'indonesia', to: 'new_guinea' },
  { from: 'indonesia', to: 'western_australia' },
  { from: 'new_guinea', to: 'western_australia' },
  { from: 'new_guinea', to: 'eastern_australia' },
];

export const PLAYER_PALETTE = [
  { color: '#dc2626', name: 'Vermelho' },
  { color: '#2563eb', name: 'Azul' },
  { color: '#16a34a', name: 'Verde' },
  { color: '#d97706', name: 'Amarelo' },
  { color: '#9333ea', name: 'Roxo' },
  { color: '#0891b2', name: 'Ciano' },
];

export const SEA_ZONE_NAMES: Record<string, string> = {
  atlantic_north: 'Atlântico Norte',
  atlantic_south: 'Atlântico Sul',
  pacific_north: 'Pacífico Norte',
  pacific_south: 'Pacífico Sul',
  indian: 'Oceano Índico',
  mediterranean: 'Mar Mediterrâneo',
  arctic: 'Oceano Ártico',
};

/**
 * Compute shortest graph distance (number of territory hops) between two territories.
 */
export function getTerritoryDistance(fromId: string, toId: string): number {
  if (fromId === toId) return 0;
  const visited = new Set<string>([fromId]);
  const queue: Array<{ id: string; dist: number }> = [{ id: fromId, dist: 0 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const def = TERRITORY_BY_ID[current.id];
    if (!def) continue;
    for (const next of def.neighbors) {
      if (next === toId) return current.dist + 1;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push({ id: next, dist: current.dist + 1 });
      }
    }
  }
  return Infinity;
}

/**
 * Checks if two coastal territories share at least one ocean zone for Naval raids.
 */
export function sharesSeaZone(fromId: string, toId: string): string | null {
  const a = TERRITORY_BY_ID[fromId];
  const b = TERRITORY_BY_ID[toId];
  if (!a || !b || !a.isCoastal || !b.isCoastal) return null;
  for (const zone of a.seaZones) {
    if (b.seaZones.includes(zone)) {
      return zone;
    }
  }
  return null;
}
