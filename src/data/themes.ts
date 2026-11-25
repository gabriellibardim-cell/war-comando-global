import type { AttackMode, DefenseType, ThemeId } from '../types.ts';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  subtitle: string;
  fictionNotice: string;
  cssClass: string;
  oceanBg: string;
  oceanBgDeep: string;
  oceanWave: string;
  oceanGrid: string;
  seaRouteColor: string;
  haloOuter: string;
  haloMid: string;
  haloInner: string;
  boardFrame: string;
  compassColor: string;
  attackLabels: Record<AttackMode, { name: string; icon: string; short: string }>;
  defenseLabels: Record<DefenseType, { name: string; icon: string; short: string }>;
  troopTerm: string;
  commanderTitles: string[];
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  classic: {
    id: 'classic',
    name: 'Clássico Moderno',
    subtitle: 'Tabuleiro War com oceanos azuis texturizados, faixas costeiras e rotas douradas.',
    fictionNotice: 'Ambientação lúdica de jogo de tabuleiro moderno.',
    cssClass: 'theme-classic',
    oceanBg: '#125a8c',
    oceanBgDeep: '#0a3960',
    oceanWave: 'rgba(186, 230, 253, 0.14)',
    oceanGrid: 'rgba(186, 230, 253, 0.13)',
    seaRouteColor: '#f6d365',
    haloOuter: 'rgba(56, 189, 248, 0.22)',
    haloMid: 'rgba(125, 211, 252, 0.30)',
    haloInner: 'rgba(224, 242, 254, 0.42)',
    boardFrame: '#e5d5b5',
    compassColor: '#f6d365',
    attackLabels: {
      land: { name: 'Terrestre', icon: '⚔️', short: 'Terra' },
      naval: { name: 'Naval', icon: '⚓', short: 'Naval' },
      air: { name: 'Aéreo', icon: '✈️', short: 'Aéreo' },
      missile: { name: 'Míssil', icon: '🚀', short: 'Míssil' },
    },
    defenseLabels: {
      coastal: { name: 'Costa Fortificada', icon: '🏰', short: 'Costa' },
      anti_air: { name: 'Defesa Antiaérea', icon: '📡', short: 'AA' },
      missile_shield: { name: 'Escudo Antimíssil', icon: '🛡️', short: 'Escudo' },
    },
    troopTerm: 'exércitos',
    commanderTitles: ['General', 'Almirante', 'Marechal', 'Comandante', 'Brigadeiro', 'Coronel'],
  },
  napoleonic: {
    id: 'napoleonic',
    name: 'Era Napoleônica (Tema Ficcional)',
    subtitle: 'Cartografia antiga em pergaminho e sépia inspirada em atlas históricos.',
    fictionNotice:
      'Aviso: modo estritamente temático e ficcional para fins lúdicos; não representa eventos ou dados históricos reais.',
    cssClass: 'theme-napoleonic',
    oceanBg: '#463826',
    oceanBgDeep: '#281f14',
    oceanWave: 'rgba(240, 214, 165, 0.14)',
    oceanGrid: 'rgba(232, 202, 148, 0.16)',
    seaRouteColor: '#f3d082',
    haloOuter: 'rgba(217, 178, 118, 0.20)',
    haloMid: 'rgba(234, 206, 156, 0.28)',
    haloInner: 'rgba(248, 234, 203, 0.40)',
    boardFrame: '#d8ba84',
    compassColor: '#f3d082',
    attackLabels: {
      land: { name: 'Infantaria', icon: '⚔️', short: 'Linha' },
      naval: { name: 'Frota de Linha', icon: '⛵', short: 'Frota' },
      air: { name: 'Balão Tático', icon: '🎈', short: 'Balão' },
      missile: { name: 'Artilharia Longa', icon: '💣', short: 'Canhão' },
    },
    defenseLabels: {
      coastal: { name: 'Forte Costeiro', icon: '🏰', short: 'Forte' },
      anti_air: { name: 'Bateria Elevada', icon: '🎯', short: 'Elevada' },
      missile_shield: { name: 'Bastião Blindado', icon: '🛡️', short: 'Bastião' },
    },
    troopTerm: 'regimentos',
    commanderTitles: ['Marechal', 'Duque', 'Almirante', 'Visconde', 'General', 'Barão'],
  },
  theater1940: {
    id: 'theater1940',
    name: 'Teatro Global 1940s (Tema Ficcional)',
    subtitle: 'Mesa de operações militares em verde-oliva, aço naval e rotas táticas.',
    fictionNotice:
      'Aviso: ambientação estética e ficcional de estratégia; nomes e regras são de jogo e não constituem registro histórico.',
    cssClass: 'theme-theater1940',
    oceanBg: '#1c3934',
    oceanBgDeep: '#0f221f',
    oceanWave: 'rgba(167, 243, 208, 0.12)',
    oceanGrid: 'rgba(163, 190, 140, 0.16)',
    seaRouteColor: '#facc15',
    haloOuter: 'rgba(134, 239, 172, 0.16)',
    haloMid: 'rgba(167, 243, 208, 0.24)',
    haloInner: 'rgba(220, 252, 231, 0.34)',
    boardFrame: '#a3b18a',
    compassColor: '#d9f99d',
    attackLabels: {
      land: { name: 'Blindados', icon: '🪖', short: 'Terra' },
      naval: { name: 'Força-Tarefa', icon: '🚢', short: 'Naval' },
      air: { name: 'Esquadrão Aéreo', icon: '🛩️', short: 'Aéreo' },
      missile: { name: 'Foguete Balístico', icon: '🚀', short: 'Foguete' },
    },
    defenseLabels: {
      coastal: { name: 'Bateria Costeira', icon: '🧱', short: 'Costa' },
      anti_air: { name: 'Flak Antiaérea', icon: '📡', short: 'Flak' },
      missile_shield: { name: 'Radar Interceptador', icon: '🛡️', short: 'Radar' },
    },
    troopTerm: 'divisões',
    commanderTitles: ['Comandante', 'Marechal', 'Almirante', 'General', 'Coronel', 'Major'],
  },
  cyber: {
    id: 'cyber',
    name: 'Horizonte Cibernético (Ficção)',
    subtitle: 'Estética futurista de comando orbital com contornos holográficos neon.',
    fictionNotice: 'Ambientação 100% de ficção científica.',
    cssClass: 'theme-cyber',
    oceanBg: '#0d193d',
    oceanBgDeep: '#060a1f',
    oceanWave: 'rgba(56, 189, 248, 0.15)',
    oceanGrid: 'rgba(56, 189, 248, 0.20)',
    seaRouteColor: '#38bdf8',
    haloOuter: 'rgba(6, 182, 212, 0.24)',
    haloMid: 'rgba(34, 211, 238, 0.34)',
    haloInner: 'rgba(165, 243, 252, 0.48)',
    boardFrame: '#38bdf8',
    compassColor: '#22d3ee',
    attackLabels: {
      land: { name: 'Assalto Terrestre', icon: '⚡', short: 'Terra' },
      naval: { name: 'Cruzador Marítimo', icon: '🛥️', short: 'Naval' },
      air: { name: 'Enxame de Drones', icon: '🛸', short: 'Drones' },
      missile: { name: 'Pulso Orbital', icon: '☄️', short: 'Pulso' },
    },
    defenseLabels: {
      coastal: { name: 'Muralha Costeira', icon: '🔷', short: 'Costa' },
      anti_air: { name: 'Rede Antidrone', icon: '📡', short: 'Rede AA' },
      missile_shield: { name: 'Domo de Plasma', icon: '🛡️', short: 'Domo' },
    },
    troopTerm: 'unidades',
    commanderTitles: ['Arquiteto', 'Vetor', 'Nexo', 'Sentinela', 'Oráculo', 'Apex'],
  },
};
