import type { AttackMode, DefenseType } from '../types.ts';
import { GAME_ICON_PATHS } from './gameIconPaths.ts';

/**
 * Full 12-unit + defense vector icon system combining licensed game-icons.net SVGs (CC BY 3.0)
 * from refs/ sectors with clean custom rifleman infantry & coastal bastion silhouettes.
 */

export type UnitIconId =
  | 'infantaria'
  | 'tanque'
  | 'artilharia'
  | 'navio'
  | 'porta_avioes'
  | 'submarino'
  | 'caca'
  | 'bombardeiro'
  | 'antiaerea'
  | 'missil'
  | 'silo'
  | 'escudo'
  | 'costa';

export interface UnitIconDef {
  id: UnitIconId;
  label: string;
  sector: 'terra' | 'naval' | 'aereo' | 'missil' | 'defesa';
  viewBox: string;
  color: string;
  body: string;
  credit: string;
}

function fromGameIcon(paths: string[]): string {
  return paths.map((d) => `<path d="${d}" fill="currentColor"/>`).join('');
}

// Standing rifleman infantry (per refs/REFS.md: rifle infantry, NOT flamethrower)
const INFANTRY_BODY = `
  <circle cx="10.2" cy="5.2" r="2.5" fill="currentColor"/>
  <path d="M7.6 4.7c.4-1.5 1.7-2.2 2.9-2.2 1.4 0 2.6.8 2.8 2.2H7.6z" fill="currentColor"/>
  <path d="M7.2 9.2c0-.9.8-1.5 1.8-1.5h2.5c1 0 1.7.6 1.9 1.5l.6 3.8-1.6.5-.4-2.5v4.5l1.6 5.2h-2.1l-1.2-3.9-1.2 3.9H7l1.5-5.2V11l-.8 2.2-1.5-.6 1-3.4z" fill="currentColor"/>
  <path d="M10.4 12.1l8.6-6.2 1 1.3-8.6 6.2-1-1.3z" fill="currentColor"/>
`;

// Coastal fortress bastion over ocean waves
const COASTAL_BODY = `
  <path d="M4.8 15.2V7.8h2.8v2.2h2.2V7.8h4.4v2.2h2.2V7.8h2.8v7.4H4.8z" fill="currentColor"/>
  <rect x="9.8" y="11.6" width="4.4" height="3.6" rx="0.7" fill="#0f172a"/>
  <path d="M2.6 18.8c1.8-1 3.6-1 5.4 0 1.8 1 3.6 1 5.4 0 1.8-1 3.6-1 5.4 0 1 .5 1.8.8 2.4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
`;

export const UNIT_ICONS: Record<UnitIconId, UnitIconDef> = {
  infantaria: {
    id: 'infantaria',
    label: 'Infantaria (1–3)',
    sector: 'terra',
    viewBox: '0 0 24 24',
    color: '#fde047',
    body: INFANTRY_BODY,
    credit: 'Silhueta original (fuzileiro)',
  },
  tanque: {
    id: 'tanque',
    label: 'Tanque (4–7)',
    sector: 'terra',
    viewBox: '0 0 512 512',
    color: '#fbbf24',
    body: fromGameIcon(GAME_ICON_PATHS.tanque),
    credit: 'Lorc — game-icons.net (CC BY 3.0)',
  },
  artilharia: {
    id: 'artilharia',
    label: 'Artilharia (8+)',
    sector: 'terra',
    viewBox: '0 0 512 512',
    color: '#f59e0b',
    body: fromGameIcon(GAME_ICON_PATHS.artilharia),
    credit: 'Lorc — game-icons.net (CC BY 3.0)',
  },
  submarino: {
    id: 'submarino',
    label: 'Submarino (3–4)',
    sector: 'naval',
    viewBox: '0 0 512 512',
    color: '#2dd4bf',
    body: fromGameIcon(GAME_ICON_PATHS.submarino),
    credit: 'Delapouite — game-icons.net (CC BY 3.0)',
  },
  navio: {
    id: 'navio',
    label: 'Encouraçado (5–7)',
    sector: 'naval',
    viewBox: '0 0 512 512',
    color: '#5eead4',
    body: fromGameIcon(GAME_ICON_PATHS.navio),
    credit: 'Cathelineau — game-icons.net (CC BY 3.0)',
  },
  porta_avioes: {
    id: 'porta_avioes',
    label: 'Porta-Aviões (8+)',
    sector: 'naval',
    viewBox: '0 0 512 512',
    color: '#99f6e4',
    body: fromGameIcon(GAME_ICON_PATHS.porta_avioes),
    credit: 'Cathelineau — game-icons.net (CC BY 3.0)',
  },
  caca: {
    id: 'caca',
    label: 'Caça (3–5)',
    sector: 'aereo',
    viewBox: '0 0 512 512',
    color: '#7dd3fc',
    body: fromGameIcon(GAME_ICON_PATHS.caca),
    credit: 'Delapouite — game-icons.net (CC BY 3.0)',
  },
  bombardeiro: {
    id: 'bombardeiro',
    label: 'Bombardeiro (6+)',
    sector: 'aereo',
    viewBox: '0 0 512 512',
    color: '#38bdf8',
    body: fromGameIcon(GAME_ICON_PATHS.bombardeiro),
    credit: 'Lord Berandas — game-icons.net (CC BY 3.0)',
  },
  antiaerea: {
    id: 'antiaerea',
    label: 'Antiaérea (AA)',
    sector: 'defesa',
    viewBox: '0 0 512 512',
    color: '#60a5fa',
    body: fromGameIcon(GAME_ICON_PATHS.antiaerea),
    credit: 'Pierre Leducq — game-icons.net (CC BY 3.0)',
  },
  missil: {
    id: 'missil',
    label: 'Míssil Estratégico',
    sector: 'missil',
    viewBox: '0 0 512 512',
    color: '#fda4af',
    body: fromGameIcon(GAME_ICON_PATHS.missil),
    credit: 'Lorc — game-icons.net (CC BY 3.0)',
  },
  silo: {
    id: 'silo',
    label: 'Silo de Lançamento',
    sector: 'missil',
    viewBox: '0 0 512 512',
    color: '#fb923c',
    body: fromGameIcon(GAME_ICON_PATHS.silo),
    credit: 'Delapouite — game-icons.net (CC BY 3.0)',
  },
  escudo: {
    id: 'escudo',
    label: 'Escudo Antimíssil',
    sector: 'defesa',
    viewBox: '0 0 512 512',
    color: '#c084fc',
    body: fromGameIcon(GAME_ICON_PATHS.escudo),
    credit: 'Lorc — game-icons.net (CC BY 3.0)',
  },
  costa: {
    id: 'costa',
    label: 'Costa Fortificada',
    sector: 'defesa',
    viewBox: '0 0 24 24',
    color: '#34d399',
    body: COASTAL_BODY,
    credit: 'Silhueta original (bastião costeiro)',
  },
};

export function getLandUnitIconId(troops: number): UnitIconId {
  if (troops >= 8) return 'artilharia';
  if (troops >= 4) return 'tanque';
  return 'infantaria';
}

export function getCombatUnitProfile(
  mode: AttackMode,
  originTroops = 5
): { iconId: UnitIconId; unitName: string; baseIconId?: UnitIconId } {
  if (mode === 'land') {
    if (originTroops >= 8) return { iconId: 'artilharia', unitName: 'Artilharia Pesada' };
    if (originTroops >= 4) return { iconId: 'tanque', unitName: 'Blindados (Tanque)' };
    return { iconId: 'infantaria', unitName: 'Infantaria' };
  }
  if (mode === 'naval') {
    if (originTroops >= 8) return { iconId: 'porta_avioes', unitName: 'Porta-Aviões' };
    if (originTroops >= 5) return { iconId: 'navio', unitName: 'Encouraçado' };
    return { iconId: 'submarino', unitName: 'Submarino' };
  }
  if (mode === 'air') {
    if (originTroops >= 6) return { iconId: 'bombardeiro', unitName: 'Bombardeiro' };
    return { iconId: 'caca', unitName: 'Caça a Jato' };
  }
  return { iconId: 'missil', unitName: 'Míssil Balístico', baseIconId: 'silo' };
}

export function getDefenseIconId(type: DefenseType): UnitIconId {
  if (type === 'coastal') return 'costa';
  if (type === 'anti_air') return 'antiaerea';
  return 'escudo';
}

/**
 * Renders any UnitIconId as a crisp inline SVG element.
 */
export function renderUnitIcon(
  id: UnitIconId,
  size = 22,
  colorOverride?: string,
  className = 'unit-svg-icon'
): string {
  const def = UNIT_ICONS[id];
  const color = colorOverride ?? def.color;
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="${def.viewBox}" style="color:${color}" aria-hidden="true">${def.body}</svg>`;
}

/**
 * Renders a UnitIconId inside an existing parent <svg> at center (cx, cy) with box width/height = size.
 */
export function renderSvgEmbeddedIcon(
  id: UnitIconId,
  cx: number,
  cy: number,
  size: number,
  colorOverride?: string
): string {
  const def = UNIT_ICONS[id];
  const is512 = def.viewBox === '0 0 512 512';
  const scale = is512 ? size / 512 : size / 24;
  const x = cx - size / 2;
  const y = cy - size / 2;
  const color = colorOverride ?? def.color;
  return `<g transform="translate(${x.toFixed(2)}, ${y.toFixed(2)}) scale(${scale.toFixed(5)})" style="color:${color}">${def.body}</g>`;
}

export function renderAttackIcon(
  mode: AttackMode,
  size = 24,
  originTroops?: number,
  className = 'unit-svg-icon'
): string {
  const defaultTroops = mode === 'naval' ? 6 : mode === 'air' ? 4 : mode === 'land' ? 5 : 4;
  const profile = getCombatUnitProfile(mode, originTroops ?? defaultTroops);
  return renderUnitIcon(profile.iconId, size, undefined, className);
}

export function renderDefenseIcon(
  type: DefenseType,
  size = 20,
  className = 'unit-svg-icon'
): string {
  return renderUnitIcon(getDefenseIconId(type), size, undefined, className);
}

export function renderFortifyIcon(size = 20): string {
  return `<svg class="unit-svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V7h3v3h3V7h4v3h3V7h3v13h-6v-5h-4v5H4z" fill="currentColor"/></svg>`;
}

export function renderDieSvg(value: number, side: 'atk' | 'def'): string {
  const pipMap: Record<number, Array<[number, number]>> = {
    1: [[12, 12]],
    2: [[7, 7], [17, 17]],
    3: [[7, 7], [12, 12], [17, 17]],
    4: [[7, 7], [17, 7], [7, 17], [17, 17]],
    5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
    6: [[7, 6.5], [17, 6.5], [7, 12], [17, 12], [7, 17.5], [17, 17.5]],
  };
  const pips = (pipMap[value] ?? pipMap[1])
    .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="2.1" fill="#ffffff"/>`)
    .join('');
  const bg = side === 'atk' ? '#dc2626' : '#2563eb';
  return `<svg class="die-svg" width="22" height="22" viewBox="0 0 24 24" aria-label="Dado ${value}"><rect x="1.5" y="1.5" width="21" height="21" rx="4.5" fill="${bg}" stroke="rgba(255,255,255,0.45)" stroke-width="1.2"/>${pips}</svg>`;
}

export function renderOceanVesselMarker(
  iconId: 'navio' | 'porta_avioes' | 'submarino',
  x: number,
  y: number,
  color: string
): string {
  return `
    <g opacity="0.86" pointer-events="none">
      <circle cx="${x}" cy="${y}" r="8.2" fill="rgba(7, 25, 45, 0.72)" stroke="${color}" stroke-width="0.95"/>
      ${renderSvgEmbeddedIcon(iconId, x, y, 11.5, color)}
    </g>
  `;
}

export function renderCompassRoseSvg(x: number, y: number, color: string): string {
  return `
    <g transform="translate(${x}, ${y})" opacity="0.65" pointer-events="none">
      <circle cx="0" cy="0" r="22" fill="none" stroke="${color}" stroke-width="0.95" stroke-dasharray="2 2"/>
      <circle cx="0" cy="0" r="15" fill="none" stroke="${color}" stroke-width="0.85"/>
      <polygon points="0,-24 3.5,-4 0,-1 -3.5,-4" fill="${color}"/>
      <polygon points="0,24 3.5,4 0,1 -3.5,4" fill="${color}" opacity="0.65"/>
      <polygon points="24,0 4,3.5 1,0 4,-3.5" fill="${color}" opacity="0.65"/>
      <polygon points="-24,0 -4,3.5 -1,0 -4,-3.5" fill="${color}" opacity="0.65"/>
      <polygon points="14,-14 2.5,-0.5 0,0 0.5,-2.5" fill="${color}" opacity="0.45"/>
      <polygon points="-14,-14 -0.5,-2.5 0,0 -2.5,-0.5" fill="${color}" opacity="0.45"/>
      <polygon points="14,14 0.5,2.5 0,0 2.5,0.5" fill="${color}" opacity="0.45"/>
      <polygon points="-14,14 -2.5,0.5 0,0 -0.5,2.5" fill="${color}" opacity="0.45"/>
      <circle cx="0" cy="0" r="2.2" fill="${color}"/>
      <text x="0" y="-26.5" text-anchor="middle" font-size="6.5" font-weight="800" fill="${color}">N</text>
      <text x="0" y="31.5" text-anchor="middle" font-size="5.5" font-weight="700" fill="${color}">S</text>
      <text x="29" y="2" text-anchor="middle" font-size="5.5" font-weight="700" fill="${color}">L</text>
      <text x="-29" y="2" text-anchor="middle" font-size="5.5" font-weight="700" fill="${color}">O</text>
    </g>
  `;
}

export const LICENSE_CREDITS = [
  {
    item: 'Mapa base (42 territórios)',
    author: 'CMG Lee & Gr0gmint (Risk game board.svg) + Natural Earth',
    license: 'CC BY-SA 4.0 / CC0',
  },
  {
    item: 'Rotas marítimas (referência)',
    author: 'Heinrich-Böll-Stiftung European Union',
    license: 'CC BY-SA 4.0',
  },
  {
    item: 'Tanque, Artilharia, Míssil, Escudo',
    author: 'Lorc — game-icons.net',
    license: 'CC BY 3.0',
  },
  {
    item: 'Encouraçado, Porta-Aviões',
    author: 'Cathelineau — game-icons.net',
    license: 'CC BY 3.0',
  },
  {
    item: 'Submarino, Caça a Jato, Silo',
    author: 'Delapouite — game-icons.net',
    license: 'CC BY 3.0',
  },
  {
    item: 'Bombardeiro',
    author: 'Lord Berandas — game-icons.net',
    license: 'CC BY 3.0',
  },
  {
    item: 'Canhão Antiaéreo',
    author: 'Pierre Leducq — game-icons.net',
    license: 'CC BY 3.0',
  },
  {
    item: 'Referência de UI tátil',
    author: 'Kenney (UI Pack — kenney.nl)',
    license: 'CC0',
  },
];
