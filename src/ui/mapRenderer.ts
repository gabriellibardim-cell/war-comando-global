import type { AttackMode, CombatResult, DefenseType, GameState } from '../types.ts';
import {
  CONTINENTS,
  MAP_Y_SCALE,
  SEA_ROUTES,
  TERRITORIES,
  TERRITORY_BY_ID,
} from '../data/mapData.ts';
import { TERRITORY_SVG_PATHS } from '../data/mapPaths.ts';
import { THEMES } from '../data/themes.ts';
import {
  UNIT_ICONS,
  getCombatUnitProfile,
  getDefenseIconId,
  getLandUnitIconId,
  renderCompassRoseSvg,
  renderOceanVesselMarker,
  renderSvgEmbeddedIcon,
} from './icons.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
const VB_X = 166;
const VB_Y = 104;
const VB_W = 752;
const VB_H = 428;

export interface MapHighlightOptions {
  selectedId: string | null;
  targetId: string | null;
  validTargetIds: Set<string>;
  attackMode: AttackMode;
  activeCombatFx: CombatResult | null;
}

export class MapRenderer {
  private container: HTMLElement;
  private svg: SVGSVGElement;
  private viewportGroup: SVGGElement;
  private fxGroup: SVGGElement;
  private modeBadgeGroup: SVGGElement;
  private compassGroup: SVGGElement;
  private oceanShipsGroup: SVGGElement;
  private onTerritoryClick: (id: string) => void;

  // Pan & zoom state
  private scale = 1;
  private tx = 0;
  private ty = 0;
  private minScale = 0.85;
  private maxScale = 3.6;

  // Pointer tracking for pan + pinch zoom
  private activePointers = new Map<number, { x: number; y: number }>();
  private lastPanPoint: { x: number; y: number } | null = null;
  private lastPinchDist: number | null = null;
  private pointerDownStart: { x: number; y: number } | null = null;
  private didDrag = false;

  // Cached SVG elements for fast incremental updates
  private territoryPaths = new Map<string, SVGPathElement>();
  private territoryNameTexts = new Map<string, SVGTextElement>();
  private tokenPillRects = new Map<string, SVGRectElement>();
  private tokenIconGroups = new Map<string, SVGGElement>();
  private tokenTierCache = new Map<string, string>();
  private troopTexts = new Map<string, SVGTextElement>();
  private defenseBadgeGroups = new Map<string, SVGGElement>();
  private infraBadgeTexts = new Map<string, SVGTextElement>();
  private lastHighlightIds: { selectedId: string | null; targetId: string | null } = {
    selectedId: null,
    targetId: null,
  };

  // Theme-reactive SVG nodes
  private oceanStopInner!: SVGStopElement;
  private oceanStopOuter!: SVGStopElement;
  private wavePatternPath!: SVGPathElement;
  private graticuleGroup!: SVGGElement;
  private seaRoutesGroup!: SVGGElement;
  private haloOuterUse!: SVGUseElement;
  private haloMidUse!: SVGUseElement;
  private haloInnerUse!: SVGUseElement;
  private boardFrameRect!: SVGRectElement;

  constructor(container: HTMLElement, onTerritoryClick: (id: string) => void) {
    this.container = container;
    this.onTerritoryClick = onTerritoryClick;

    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('viewBox', `${VB_X} ${VB_Y} ${VB_W} ${VB_H}`);
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.svg.classList.add('world-map-svg');

    this.viewportGroup = document.createElementNS(SVG_NS, 'g');
    this.viewportGroup.classList.add('map-viewport');
    this.compassGroup = document.createElementNS(SVG_NS, 'g');
    this.oceanShipsGroup = document.createElementNS(SVG_NS, 'g');
    this.modeBadgeGroup = document.createElementNS(SVG_NS, 'g');
    this.modeBadgeGroup.classList.add('map-mode-badge-layer');
    this.fxGroup = document.createElementNS(SVG_NS, 'g');
    this.fxGroup.classList.add('map-fx-layer');

    this.buildStaticSvg();
    this.svg.appendChild(this.viewportGroup);
    this.container.innerHTML = '';
    this.container.appendChild(this.svg);

    this.bindInteractions();
  }

  private buildStaticSvg(): void {
    const defs = document.createElementNS(SVG_NS, 'defs');

    // Ocean depth radial gradient
    const oceanGrad = document.createElementNS(SVG_NS, 'radialGradient');
    oceanGrad.setAttribute('id', 'ocean-depth-grad');
    oceanGrad.setAttribute('cx', '50%');
    oceanGrad.setAttribute('cy', '46%');
    oceanGrad.setAttribute('r', '70%');

    this.oceanStopInner = document.createElementNS(SVG_NS, 'stop');
    this.oceanStopInner.setAttribute('offset', '0%');
    this.oceanStopInner.setAttribute('stop-color', '#125a8c');

    this.oceanStopOuter = document.createElementNS(SVG_NS, 'stop');
    this.oceanStopOuter.setAttribute('offset', '100%');
    this.oceanStopOuter.setAttribute('stop-color', '#0a3960');

    oceanGrad.appendChild(this.oceanStopInner);
    oceanGrad.appendChild(this.oceanStopOuter);
    defs.appendChild(oceanGrad);

    // Subtle scalloped ocean wave texture
    const wavePat = document.createElementNS(SVG_NS, 'pattern');
    wavePat.setAttribute('id', 'ocean-waves-pattern');
    wavePat.setAttribute('width', '44');
    wavePat.setAttribute('height', '22');
    wavePat.setAttribute('patternUnits', 'userSpaceOnUse');

    const wPath = document.createElementNS(SVG_NS, 'path');
    wPath.setAttribute('d', 'M 0 11 Q 11 6 22 11 T 44 11');
    wPath.setAttribute('fill', 'none');
    wPath.setAttribute('stroke', 'rgba(186, 230, 253, 0.14)');
    wPath.setAttribute('stroke-width', '1.2');
    this.wavePatternPath = wPath;
    wavePat.appendChild(wPath);
    defs.appendChild(wavePat);

    // Subtle landmass relief drop shadow
    const landShadow = document.createElementNS(SVG_NS, 'filter');
    landShadow.setAttribute('id', 'land-relief');
    landShadow.setAttribute('x', '-8%');
    landShadow.setAttribute('y', '-8%');
    landShadow.setAttribute('width', '116%');
    landShadow.setAttribute('height', '116%');
    const feDrop = document.createElementNS(SVG_NS, 'feDropShadow');
    feDrop.setAttribute('dx', '0');
    feDrop.setAttribute('dy', '1.8');
    feDrop.setAttribute('stdDeviation', '1.7');
    feDrop.setAttribute('flood-color', '#000000');
    feDrop.setAttribute('flood-opacity', '0.42');
    landShadow.appendChild(feDrop);
    defs.appendChild(landShadow);

    // Combined landmass silhouette for bathymetry halos
    const landmassDef = document.createElementNS(SVG_NS, 'g');
    landmassDef.setAttribute('id', 'world-landmass-silhouette');
    landmassDef.setAttribute('stroke-linejoin', 'round');
    landmassDef.setAttribute('stroke-linecap', 'round');
    for (const def of TERRITORIES) {
      const geom = TERRITORY_SVG_PATHS[def.id];
      if (!geom) continue;
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', geom.d);
      if (geom.transform) p.setAttribute('transform', geom.transform);
      landmassDef.appendChild(p);
    }
    defs.appendChild(landmassDef);

    // Attack arrow marker
    const arrowMarker = document.createElementNS(SVG_NS, 'marker');
    arrowMarker.setAttribute('id', 'fx-arrow');
    arrowMarker.setAttribute('viewBox', '0 0 10 10');
    arrowMarker.setAttribute('refX', '8');
    arrowMarker.setAttribute('refY', '5');
    arrowMarker.setAttribute('markerWidth', '5.5');
    arrowMarker.setAttribute('markerHeight', '5.5');
    arrowMarker.setAttribute('orient', 'auto-start-reverse');
    const arrowPath = document.createElementNS(SVG_NS, 'path');
    arrowPath.setAttribute('d', 'M 0 1 L 10 5 L 0 9 z');
    arrowPath.setAttribute('fill', '#fbbf24');
    arrowMarker.appendChild(arrowPath);
    defs.appendChild(arrowMarker);

    this.svg.appendChild(defs);

    // 1) Ocean base + wave pattern + tabletop frame
    const bgRect = document.createElementNS(SVG_NS, 'rect');
    bgRect.setAttribute('x', String(VB_X - 300));
    bgRect.setAttribute('y', String(VB_Y - 220));
    bgRect.setAttribute('width', String(VB_W + 600));
    bgRect.setAttribute('height', String(VB_H + 440));
    bgRect.setAttribute('fill', 'url(#ocean-depth-grad)');
    this.viewportGroup.appendChild(bgRect);

    const waveRect = document.createElementNS(SVG_NS, 'rect');
    waveRect.setAttribute('x', String(VB_X - 240));
    waveRect.setAttribute('y', String(VB_Y - 180));
    waveRect.setAttribute('width', String(VB_W + 480));
    waveRect.setAttribute('height', String(VB_H + 360));
    waveRect.setAttribute('fill', 'url(#ocean-waves-pattern)');
    waveRect.setAttribute('pointer-events', 'none');
    this.viewportGroup.appendChild(waveRect);

    this.boardFrameRect = document.createElementNS(SVG_NS, 'rect');
    this.boardFrameRect.setAttribute('x', String(VB_X + 4));
    this.boardFrameRect.setAttribute('y', String(VB_Y + 4));
    this.boardFrameRect.setAttribute('width', String(VB_W - 8));
    this.boardFrameRect.setAttribute('height', String(VB_H - 8));
    this.boardFrameRect.setAttribute('rx', '8');
    this.boardFrameRect.setAttribute('fill', 'none');
    this.boardFrameRect.setAttribute('stroke', '#e5d5b5');
    this.boardFrameRect.setAttribute('stroke-opacity', '0.28');
    this.boardFrameRect.setAttribute('stroke-width', '1.5');
    this.boardFrameRect.setAttribute('pointer-events', 'none');
    this.viewportGroup.appendChild(this.boardFrameRect);

    // 2) Cartographic graticule
    this.graticuleGroup = document.createElementNS(SVG_NS, 'g');
    this.graticuleGroup.setAttribute('fill', 'none');
    this.graticuleGroup.setAttribute('stroke-width', '0.55');
    this.graticuleGroup.setAttribute('pointer-events', 'none');

    const latYs = [150, 208, 268, 326, 384, 442, 496];
    latYs.forEach((y, idx) => {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(VB_X + 6));
      line.setAttribute('x2', String(VB_X + VB_W - 6));
      line.setAttribute('y1', String(y));
      line.setAttribute('y2', String(y));
      if (idx === 3) {
        line.setAttribute('stroke-dasharray', '6 4');
        line.setAttribute('stroke-width', '0.85');
      }
      this.graticuleGroup.appendChild(line);
    });
    for (let x = 200; x <= 900; x += 70) {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(x));
      line.setAttribute('x2', String(x));
      line.setAttribute('y1', String(VB_Y + 6));
      line.setAttribute('y2', String(VB_Y + VB_H - 6));
      this.graticuleGroup.appendChild(line);
    }
    this.viewportGroup.appendChild(this.graticuleGroup);

    // 3) Ocean Labels
    const oceanLabels = [
      { text: 'OCEANO PACÍFICO', x: 222, y: 360 },
      { text: 'ATLÂNTICO NORTE', x: 406, y: 294 },
      { text: 'ATLÂNTICO SUL', x: 468, y: 486 },
      { text: 'OCEANO ÍNDICO', x: 705, y: 422 },
      { text: 'PACÍFICO OESTE', x: 874, y: 368 },
    ];
    const oceanTxtGroup = document.createElementNS(SVG_NS, 'g');
    oceanTxtGroup.setAttribute('pointer-events', 'none');
    for (const ol of oceanLabels) {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', String(ol.x));
      t.setAttribute('y', String(ol.y));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('fill', '#e0f2fe');
      t.setAttribute('opacity', '0.26');
      t.setAttribute('font-size', '6.8');
      t.setAttribute('font-style', 'italic');
      t.setAttribute('font-weight', '700');
      t.setAttribute('letter-spacing', '1.4');
      t.textContent = ol.text;
      oceanTxtGroup.appendChild(t);
    }
    this.viewportGroup.appendChild(oceanTxtGroup);

    // 4) Compass rose
    this.viewportGroup.appendChild(this.compassGroup);

    // 5) Layered coastal bathymetry halos
    const haloGroup = document.createElementNS(SVG_NS, 'g');
    haloGroup.setAttribute('transform', `scale(1, ${MAP_Y_SCALE})`);
    haloGroup.setAttribute('fill', 'none');
    haloGroup.setAttribute('pointer-events', 'none');

    this.haloOuterUse = document.createElementNS(SVG_NS, 'use');
    this.haloOuterUse.setAttribute('href', '#world-landmass-silhouette');
    this.haloOuterUse.setAttribute('stroke-width', '15');

    this.haloMidUse = document.createElementNS(SVG_NS, 'use');
    this.haloMidUse.setAttribute('href', '#world-landmass-silhouette');
    this.haloMidUse.setAttribute('stroke-width', '8.5');

    this.haloInnerUse = document.createElementNS(SVG_NS, 'use');
    this.haloInnerUse.setAttribute('href', '#world-landmass-silhouette');
    this.haloInnerUse.setAttribute('stroke-width', '3.8');

    haloGroup.appendChild(this.haloOuterUse);
    haloGroup.appendChild(this.haloMidUse);
    haloGroup.appendChild(this.haloInnerUse);
    this.viewportGroup.appendChild(haloGroup);

    // 6) Golden Dashed Maritime Routes + Transoceanic Naval Corridors
    this.seaRoutesGroup = document.createElementNS(SVG_NS, 'g');
    this.seaRoutesGroup.classList.add('sea-routes-layer');
    this.seaRoutesGroup.setAttribute('fill', 'none');
    this.seaRoutesGroup.setAttribute('pointer-events', 'none');

    for (const r of SEA_ROUTES) {
      const a = TERRITORY_BY_ID[r.from];
      const b = TERRITORY_BY_ID[r.to];
      if (!a || !b) continue;

      if (r.wrapEdge === 'left-right') {
        const arc = document.createElementNS(SVG_NS, 'path');
        arc.setAttribute('d', 'M 223,152 Q 223,115 265,115 H 805 Q 842,115 842,146');
        arc.classList.add('sea-route-line');
        this.seaRoutesGroup.appendChild(arc);
      } else if (r.curved) {
        const path = document.createElementNS(SVG_NS, 'path');
        const mx = (a.labelX + b.labelX) / 2;
        const my = (a.labelY + b.labelY) / 2 - 14;
        path.setAttribute('d', `M ${a.labelX} ${a.labelY} Q ${mx} ${my} ${b.labelX} ${b.labelY}`);
        path.classList.add('sea-route-line');
        this.seaRoutesGroup.appendChild(path);
      } else {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', String(a.labelX));
        line.setAttribute('y1', String(a.labelY));
        line.setAttribute('x2', String(b.labelX));
        line.setAttribute('y2', String(b.labelY));
        line.classList.add('sea-route-line');
        this.seaRoutesGroup.appendChild(line);
      }
    }

    const navalCorridors = [
      'M 366,274 Q 422,254 468,282',
      'M 426,412 Q 486,496 588,504 Q 684,502 764,442',
      'M 642,388 Q 686,386 716,356',
      'M 284,306 Q 248,290 264,252',
    ];
    for (const d of navalCorridors) {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d);
      p.classList.add('naval-corridor-line');
      this.seaRoutesGroup.appendChild(p);
    }

    this.viewportGroup.appendChild(this.seaRoutesGroup);
    this.viewportGroup.appendChild(this.oceanShipsGroup);

    // 7) Territory landmass shapes
    const shapesLayer = document.createElementNS(SVG_NS, 'g');
    shapesLayer.setAttribute('transform', `scale(1, ${MAP_Y_SCALE})`);
    shapesLayer.setAttribute('filter', 'url(#land-relief)');
    shapesLayer.classList.add('territories-shapes-layer');

    for (const def of TERRITORIES) {
      const geom = TERRITORY_SVG_PATHS[def.id];
      if (!geom) continue;

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', geom.d);
      if (geom.transform) path.setAttribute('transform', geom.transform);
      path.classList.add('territory-shape');
      path.setAttribute('stroke-linejoin', 'round');
      path.dataset.id = def.id;

      path.addEventListener('click', (e) => {
        if (this.didDrag) return;
        e.stopPropagation();
        this.onTerritoryClick(def.id);
      });

      this.territoryPaths.set(def.id, path);
      shapesLayer.appendChild(path);
    }
    this.viewportGroup.appendChild(shapesLayer);

    // 8) Continent labels + bonus badges
    const contLabels: Array<{ id: keyof typeof CONTINENTS; x: number; y: number }> = [
      { id: 'america_norte', x: 286, y: 132 },
      { id: 'america_sul', x: 278, y: 440 },
      { id: 'europa', x: 545, y: 132 },
      { id: 'africa', x: 486, y: 446 },
      { id: 'asia', x: 862, y: 315 },
      { id: 'oceania', x: 724, y: 472 },
    ];
    const labelGroup = document.createElementNS(SVG_NS, 'g');
    labelGroup.classList.add('continent-watermarks');
    for (const item of contLabels) {
      const c = CONTINENTS[item.id];
      const txt = document.createElementNS(SVG_NS, 'text');
      txt.setAttribute('x', String(item.x));
      txt.setAttribute('y', String(item.y));
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('fill', c.accentColor);
      txt.setAttribute('opacity', '0.96');
      txt.setAttribute('font-size', '8.2');
      txt.setAttribute('font-weight', '800');
      txt.setAttribute('letter-spacing', '0.6');
      txt.setAttribute('paint-order', 'stroke');
      txt.setAttribute('stroke', 'rgba(4, 15, 32, 0.78)');
      txt.setAttribute('stroke-width', '2.2');
      txt.setAttribute('pointer-events', 'none');
      txt.textContent = `${c.name.toUpperCase()} (+${c.bonus})`;
      labelGroup.appendChild(txt);
    }
    this.viewportGroup.appendChild(labelGroup);

    // 9) Unscaled Board-Game Troop Tokens (Unit Silhouette + Count) & Defense Medallions
    const overlaysLayer = document.createElementNS(SVG_NS, 'g');
    overlaysLayer.classList.add('territories-overlays-layer');

    for (const def of TERRITORIES) {
      const g = document.createElementNS(SVG_NS, 'g');
      g.classList.add('territory-overlay');
      g.setAttribute('pointer-events', 'none');

      const nameText = document.createElementNS(SVG_NS, 'text');
      nameText.setAttribute('x', String(def.labelX));
      nameText.setAttribute('y', String(def.labelY - 10));
      nameText.setAttribute('text-anchor', 'middle');
      nameText.classList.add('territory-name');
      nameText.textContent = def.name;
      this.territoryNameTexts.set(def.id, nameText);
      g.appendChild(nameText);

      // Troop token pill (slightly wider for crisp game-icons silhouettes on mobile)
      const pill = document.createElementNS(SVG_NS, 'rect');
      pill.setAttribute('x', String(def.labelX - 14.5));
      pill.setAttribute('y', String(def.labelY - 6.6));
      pill.setAttribute('width', '29');
      pill.setAttribute('height', '15.2');
      pill.setAttribute('rx', '7.6');
      pill.classList.add('troop-token-pill');
      this.tokenPillRects.set(def.id, pill);
      g.appendChild(pill);

      // Unit icon slot on left half of token pill
      const iconG = document.createElementNS(SVG_NS, 'g');
      this.tokenIconGroups.set(def.id, iconG);
      g.appendChild(iconG);

      // Bold troop count on right half of token pill
      const troopText = document.createElementNS(SVG_NS, 'text');
      troopText.setAttribute('x', String(def.labelX + 6.4));
      troopText.setAttribute('y', String(def.labelY + 4));
      troopText.setAttribute('text-anchor', 'middle');
      troopText.classList.add('troop-badge-text');
      troopText.textContent = '1';
      this.troopTexts.set(def.id, troopText);
      g.appendChild(troopText);

      // Defense medallions below troop token
      const defGroup = document.createElementNS(SVG_NS, 'g');
      defGroup.classList.add('defense-medallions');
      this.defenseBadgeGroups.set(def.id, defGroup);
      g.appendChild(defGroup);

      // Compact infrastructure icons badge (top-right of token)
      const infraTxt = document.createElementNS(SVG_NS, 'text');
      infraTxt.setAttribute('x', String(def.labelX + 16));
      infraTxt.setAttribute('y', String(def.labelY - 4));
      infraTxt.setAttribute('font-size', '6.6');
      infraTxt.classList.add('infra-badge-text');
      infraTxt.textContent = '';
      this.infraBadgeTexts.set(def.id, infraTxt);
      g.appendChild(infraTxt);

      overlaysLayer.appendChild(g);
    }

    this.viewportGroup.appendChild(overlaysLayer);
    this.viewportGroup.appendChild(this.modeBadgeGroup);
    this.viewportGroup.appendChild(this.fxGroup);
  }

  public render(state: GameState, opts: MapHighlightOptions): void {
    const theme = THEMES[state.config.theme];

    // Theme cartographic palette
    this.oceanStopInner.setAttribute('stop-color', theme.oceanBg);
    this.oceanStopOuter.setAttribute('stop-color', theme.oceanBgDeep);
    this.wavePatternPath.setAttribute('stroke', theme.oceanWave);
    this.graticuleGroup.setAttribute('stroke', theme.oceanGrid);
    this.seaRoutesGroup.setAttribute('stroke', theme.seaRouteColor);
    this.haloOuterUse.setAttribute('stroke', theme.haloOuter);
    this.haloMidUse.setAttribute('stroke', theme.haloMid);
    this.haloInnerUse.setAttribute('stroke', theme.haloInner);
    this.boardFrameRect.setAttribute('stroke', theme.boardFrame);
    this.compassGroup.innerHTML = renderCompassRoseSvg(218, 466, theme.compassColor);

    // Distinct naval silhouettes patrolling major ocean corridors (Encouraçado, Porta-Aviões, Submarino)
    this.oceanShipsGroup.innerHTML = [
      renderOceanVesselMarker('navio', 422, 260, theme.seaRouteColor),
      renderOceanVesselMarker('porta_avioes', 504, 496, theme.seaRouteColor),
      renderOceanVesselMarker('submarino', 694, 468, theme.seaRouteColor),
      renderOceanVesselMarker('navio', 246, 286, theme.seaRouteColor),
    ].join('');

    const playerColorMap = new Map(state.players.map((p) => [p.id, p.color]));

    for (const def of TERRITORIES) {
      const ts = state.territories[def.id];
      if (!ts) continue;

      const ownerColor = playerColorMap.get(ts.ownerId) ?? '#64748b';
      const path = this.territoryPaths.get(def.id)!;
      const pill = this.tokenPillRects.get(def.id)!;
      const iconG = this.tokenIconGroups.get(def.id)!;
      const troopTxt = this.troopTexts.get(def.id)!;
      const defGroup = this.defenseBadgeGroups.get(def.id)!;
      const infraTxt = this.infraBadgeTexts.get(def.id)!;

      const isSelected = opts.selectedId === def.id;
      const isTarget = opts.targetId === def.id;
      const isValidTarget = opts.validTargetIds.has(def.id);

      path.setAttribute('fill', ownerColor);
      path.setAttribute('fill-opacity', isSelected || isTarget ? '0.97' : '0.86');

      path.classList.toggle('is-selected', isSelected);
      path.classList.toggle('is-target', isTarget);
      path.classList.toggle('is-valid-target', isValidTarget && !isTarget);
      path.classList.toggle('mode-naval', isValidTarget && opts.attackMode === 'naval');
      path.classList.toggle('mode-air', isValidTarget && opts.attackMode === 'air');
      path.classList.toggle('mode-missile', isValidTarget && opts.attackMode === 'missile');

      pill.setAttribute('stroke', isSelected ? '#ffffff' : ownerColor);
      troopTxt.textContent = String(ts.troops);

      // Render licensed land unit icon (Infantaria 1-3, Tanque 4-7, Artilharia 8+)
      const unitId = getLandUnitIconId(ts.troops);
      if (this.tokenTierCache.get(def.id) !== unitId) {
        this.tokenTierCache.set(def.id, unitId);
        iconG.innerHTML = renderSvgEmbeddedIcon(
          unitId,
          def.labelX - 6.2,
          def.labelY + 1,
          10.8,
          '#f8fafc'
        );
      }

      // Render defense medallions (Costa, Antiaérea, Escudo)
      const activeDefs: DefenseType[] = [];
      if (ts.defenses.coastal) activeDefs.push('coastal');
      if (ts.defenses.anti_air) activeDefs.push('anti_air');
      if (ts.defenses.missile_shield) activeDefs.push('missile_shield');

      if (activeDefs.length === 0) {
        if (defGroup.childNodes.length > 0) defGroup.innerHTML = '';
      } else {
        const spacing = 13;
        const startX = def.labelX - ((activeDefs.length - 1) * spacing) / 2;
        const y = def.labelY + 15.2;
        defGroup.innerHTML = activeDefs
          .map((dt, idx) => {
            const cx = startX + idx * spacing;
            const iconId = getDefenseIconId(dt);
            const iconDef = UNIT_ICONS[iconId];
            return `
              <g>
                <circle cx="${cx}" cy="${y}" r="6" fill="#0f172a" stroke="${iconDef.color}" stroke-width="1.2"/>
                ${renderSvgEmbeddedIcon(iconId, cx, y, 8.6, iconDef.color)}
              </g>`;
          })
          .join('');
      }
      // Render compact infrastructure icons on built territories
      const infraIcons: string[] = [];
      if (ts.infrastructure?.factory) infraIcons.push('🏭');
      if (ts.infrastructure?.port) infraIcons.push('⚓');
      if (ts.infrastructure?.airport) infraIcons.push('🛫');
      if (ts.infrastructure?.road) infraIcons.push('🛣️');
      infraTxt.textContent = infraIcons.join('');
    }

    this.lastHighlightIds = { selectedId: opts.selectedId, targetId: opts.targetId };
    this.updateLabelVisibility();
    this.renderSelectedModeBadge(state, opts);
    this.renderCombatFx(state, opts.activeCombatFx);
  }

  /**
   * Mobile-friendly zoom-adaptive territory labels:
   * On compact/mobile viewports at low zoom (< 1.38x), hides crowded territory names
   * (showing crisp unit-icon + troop-count tokens) EXCEPT for selected/target territories.
   * Zooming in cleanly reveals all territory names.
   */
  private updateLabelVisibility(): void {
    const isCompactViewport = this.container.clientWidth > 0 && this.container.clientWidth < 740;
    const hideCrowded = isCompactViewport && this.scale < 1.38;

    for (const [id, txt] of this.territoryNameTexts.entries()) {
      const isFocused =
        id === this.lastHighlightIds.selectedId || id === this.lastHighlightIds.targetId;
      txt.classList.toggle('is-hidden-zoom', hideCrowded && !isFocused);
      txt.classList.toggle('is-focused-label', isFocused);
    }
  }

  /**
   * When selecting an origin territory in Naval, Air, or Missile mode,
   * displays a crisp floating tactical badge (Submarino / Encouraçado / Porta-Aviões / Caça / Bombardeiro / Silo)
   * right beside the origin territory on the map!
   */
  private renderSelectedModeBadge(state: GameState, opts: MapHighlightOptions): void {
    this.modeBadgeGroup.innerHTML = '';
    if (state.phase !== 'attack' || !opts.selectedId || opts.attackMode === 'land') return;
    const def = TERRITORY_BY_ID[opts.selectedId];
    const ts = state.territories[opts.selectedId];
    if (!def || !ts) return;

    const profile = getCombatUnitProfile(opts.attackMode, ts.troops);
    const badgeIcon = profile.baseIconId ?? profile.iconId;
    const iconDef = UNIT_ICONS[badgeIcon];
    const bx = def.labelX + 19;
    const by = def.labelY - 6;

    this.modeBadgeGroup.innerHTML = `
      <g pointer-events="none">
        <circle cx="${bx}" cy="${by}" r="8.2" fill="#0f172a" stroke="${iconDef.color}" stroke-width="1.5"/>
        ${renderSvgEmbeddedIcon(badgeIcon, bx, by, 11.4, iconDef.color)}
      </g>
    `;
  }

  private renderCombatFx(state: GameState, combat: CombatResult | null): void {
    this.fxGroup.innerHTML = '';
    if (!combat) return;
    const from = TERRITORY_BY_ID[combat.fromId];
    const to = TERRITORY_BY_ID[combat.toId];
    if (!from || !to) return;

    const fxColor =
      combat.mode === 'missile'
        ? '#fb7185'
        : combat.mode === 'air'
          ? '#38bdf8'
          : combat.mode === 'naval'
            ? '#2dd4bf'
            : '#fbbf24';

    const mx = (from.labelX + to.labelX) / 2;
    const dist = Math.hypot(to.labelX - from.labelX, to.labelY - from.labelY);
    const arcLift =
      combat.mode === 'missile'
        ? Math.min(95, dist * 0.32 + 28)
        : combat.mode === 'air'
          ? 30
          : 14;
    const my = Math.min(from.labelY, to.labelY) - arcLift;

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute(
      'd',
      `M ${from.labelX} ${from.labelY} Q ${mx} ${my} ${to.labelX} ${to.labelY}`
    );
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', fxColor);
    path.setAttribute('stroke-width', combat.mode === 'missile' ? '2.8' : '2.4');
    path.setAttribute(
      'stroke-dasharray',
      combat.mode === 'naval' ? '6 3.5' : combat.mode === 'air' ? '4 2.5' : 'none'
    );
    path.setAttribute('marker-end', 'url(#fx-arrow)');
    path.classList.add('combat-fx-arc');
    this.fxGroup.appendChild(path);

    // Midpoint flying unit medallion along the quadratic Bezier curve (t = 0.5)
    const midX = 0.25 * from.labelX + 0.5 * mx + 0.25 * to.labelX;
    const midY = 0.25 * from.labelY + 0.5 * my + 0.25 * to.labelY;
    const fromTroops = (state.territories[combat.fromId]?.troops ?? 4) + combat.attackerLosses;
    const profile = getCombatUnitProfile(combat.mode, fromTroops);

    const badgeG = document.createElementNS(SVG_NS, 'g');
    badgeG.classList.add('combat-fx-arc');
    badgeG.innerHTML = `
      <circle cx="${midX.toFixed(1)}" cy="${midY.toFixed(1)}" r="9" fill="#0f172a" stroke="${fxColor}" stroke-width="1.6"/>
      ${renderSvgEmbeddedIcon(profile.iconId, midX, midY, 12.2, fxColor)}
    `;
    this.fxGroup.appendChild(badgeG);

    const pulse = document.createElementNS(SVG_NS, 'circle');
    pulse.setAttribute('cx', String(to.labelX));
    pulse.setAttribute('cy', String(to.labelY));
    pulse.setAttribute('r', '15');
    pulse.setAttribute('fill', 'none');
    pulse.setAttribute('stroke', combat.shieldConsumed ? '#c084fc' : fxColor);
    pulse.setAttribute('stroke-width', '2.5');
    pulse.classList.add('combat-fx-ring');
    this.fxGroup.appendChild(pulse);
  }

  public zoomBy(factor: number): void {
    const next = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor));
    const ratio = next / this.scale;
    const cx = VB_X + VB_W / 2;
    const cy = VB_Y + VB_H / 2;
    this.tx = cx - (cx - this.tx) * ratio;
    this.ty = cy - (cy - this.ty) * ratio;
    this.scale = next;
    this.clampTransform();
    this.applyTransform();
  }

  public resetView(): void {
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this.applyTransform();
  }

  private clampTransform(): void {
    const maxOffsetX = VB_W * 0.72 * this.scale;
    const maxOffsetY = VB_H * 0.72 * this.scale;
    const cx = VB_X + VB_W / 2;
    const cy = VB_Y + VB_H / 2;
    const baseTx = cx - cx * this.scale;
    const baseTy = cy - cy * this.scale;
    this.tx = Math.max(baseTx - maxOffsetX, Math.min(baseTx + maxOffsetX, this.tx));
    this.ty = Math.max(baseTy - maxOffsetY, Math.min(baseTy + maxOffsetY, this.ty));
  }

  private applyTransform(): void {
    this.viewportGroup.setAttribute(
      'transform',
      `translate(${this.tx.toFixed(1)}, ${this.ty.toFixed(1)}) scale(${this.scale.toFixed(3)})`
    );
    this.updateLabelVisibility();
  }

  private clientToSvgDelta(dx: number, dy: number): { dx: number; dy: number } {
    const rect = this.svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { dx, dy };
    const ratio = Math.max(VB_W / rect.width, VB_H / rect.height);
    return { dx: dx * ratio, dy: dy * ratio };
  }

  private bindInteractions(): void {
    this.svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        this.zoomBy(factor);
      },
      { passive: false }
    );

    this.svg.addEventListener('pointerdown', (e) => {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.activePointers.size === 1) {
        this.lastPanPoint = { x: e.clientX, y: e.clientY };
        this.pointerDownStart = { x: e.clientX, y: e.clientY };
        this.didDrag = false;
      } else if (this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        this.lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        this.didDrag = true;
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.activePointers.has(e.pointerId)) return;
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        if (this.lastPinchDist && this.lastPinchDist > 10) {
          this.zoomBy(dist / this.lastPinchDist);
        }
        this.lastPinchDist = dist;
        return;
      }

      if (this.activePointers.size === 1 && this.lastPanPoint && this.pointerDownStart) {
        const movedFromStart = Math.hypot(
          e.clientX - this.pointerDownStart.x,
          e.clientY - this.pointerDownStart.y
        );
        if (movedFromStart > 7) {
          this.didDrag = true;
        }
        if (this.didDrag) {
          const delta = this.clientToSvgDelta(
            e.clientX - this.lastPanPoint.x,
            e.clientY - this.lastPanPoint.y
          );
          this.tx += delta.dx;
          this.ty += delta.dy;
          this.clampTransform();
          this.applyTransform();
        }
        this.lastPanPoint = { x: e.clientX, y: e.clientY };
      }
    });

    const endPointer = (e: PointerEvent) => {
      this.activePointers.delete(e.pointerId);
      if (this.activePointers.size < 2) {
        this.lastPinchDist = null;
      }
      if (this.activePointers.size === 0) {
        this.lastPanPoint = null;
        this.pointerDownStart = null;
        setTimeout(() => {
          this.didDrag = false;
        }, 40);
      }
    };

    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);
  }
}
