import type {
  AttackMode,
  CombatPreview,
  CombatResult,
  DefenseType,
  GameState,
} from '../types.ts';
import {
  SEA_ROUTES,
  SEA_ZONE_NAMES,
  TERRITORY_BY_ID,
  getTerritoryDistance,
  sharesSeaZone,
} from '../data/mapData.ts';
import { THEMES } from '../data/themes.ts';

export const DEFENSE_COSTS: Record<DefenseType, number> = {
  coastal: 2,
  anti_air: 2,
  missile_shield: 3,
};

export const MISSILE_TROOP_COST = 2;
export const MISSILE_COOLDOWN_TURNS = 3;

export function getDefenseCost(state: GameState, type: DefenseType): number {
  const base = DEFENSE_COSTS[type];
  if (state.activeEvent?.id === 'tech_breakthrough') {
    return Math.max(1, base - 1);
  }
  return base;
}

export function isSeaRouteBorder(fromId: string, toId: string): boolean {
  return SEA_ROUTES.some(
    (r) => (r.from === fromId && r.to === toId) || (r.from === toId && r.to === fromId)
  );
}

export function hasActivePact(state: GameState, p1: string, p2: string): boolean {
  return state.pacts.some(
    (p) =>
      p.turnsRemaining > 0 &&
      ((p.playerA === p1 && p.playerB === p2) || (p.playerA === p2 && p.playerB === p1))
  );
}

export function getAirRangeFrom(state: GameState, fromId: string): number {
  const fromState = state.territories[fromId];
  return fromState?.infrastructure?.airport ? 3 : 2;
}

export function canUseAttackMode(
  state: GameState,
  fromId: string,
  toId: string,
  mode: AttackMode
): { ok: boolean; reason?: string; seaZone?: string } {
  if (fromId === toId) return { ok: false, reason: 'Selecione um território inimigo.' };
  const fromState = state.territories[fromId];
  const toState = state.territories[toId];
  const fromDef = TERRITORY_BY_ID[fromId];
  const toDef = TERRITORY_BY_ID[toId];
  if (!fromState || !toState || !fromDef || !toDef) {
    return { ok: false, reason: 'Território inválido.' };
  }

  const attacker = state.players[state.currentPlayerIndex];
  if (fromState.ownerId !== attacker.id) {
    return { ok: false, reason: 'O território de origem precisa ser seu.' };
  }
  if (toState.ownerId === attacker.id) {
    return { ok: false, reason: 'Você não pode atacar seu próprio território.' };
  }

  if (state.config.enableDiplomacy && hasActivePact(state, attacker.id, toState.ownerId)) {
    return {
      ok: false,
      reason: 'Pacto de Não Agressão ativo com este jogador (quebre o pacto em Diplomacia para atacar).',
    };
  }

  if (mode !== 'land' && !state.config.enableSpecialWarfare) {
    return { ok: false, reason: 'Operações especiais estão desativadas nesta partida.' };
  }

  if (mode === 'land') {
    if (fromState.troops < 2) {
      return { ok: false, reason: 'Precisa de pelo menos 2 tropas na origem para atacar.' };
    }
    if (!fromDef.neighbors.includes(toId)) {
      return { ok: false, reason: 'Ataque terrestre exige fronteira direta.' };
    }
    return { ok: true };
  }

  if (mode === 'naval') {
    if (fromState.troops < 3) {
      return { ok: false, reason: 'Ataque naval exige pelo menos 3 tropas na origem.' };
    }
    if (!fromDef.isCoastal || !toDef.isCoastal) {
      return { ok: false, reason: 'Ataque naval só ocorre entre territórios costeiros.' };
    }
    const zone = sharesSeaZone(fromId, toId);
    if (!zone) {
      return { ok: false, reason: 'Territórios precisam compartilhar uma zona oceânica.' };
    }
    return { ok: true, seaZone: zone };
  }

  if (mode === 'air') {
    if (fromState.troops < 3) {
      return { ok: false, reason: 'Ataque aéreo exige pelo menos 3 tropas na base de origem.' };
    }
    const maxRange = getAirRangeFrom(state, fromId);
    const dist = getTerritoryDistance(fromId, toId);
    if (dist > maxRange) {
      return {
        ok: false,
        reason: `Alcance aéreo máximo é de ${maxRange} territórios${maxRange === 2 ? ' (construa um Aeroporto para alcance 3)' : ''}.`,
      };
    }
    return { ok: true };
  }

  // Missile
  if (attacker.missileCooldown > 0) {
    return {
      ok: false,
      reason: `Míssil em recarga (${attacker.missileCooldown} turno${attacker.missileCooldown > 1 ? 's' : ''} restante${attacker.missileCooldown > 1 ? 's' : ''}).`,
    };
  }
  if (fromState.troops < MISSILE_TROOP_COST + 1) {
    return {
      ok: false,
      reason: `Lançar míssil custa ${MISSILE_TROOP_COST} tropas da base (exige ao menos ${MISSILE_TROOP_COST + 1} na origem).`,
    };
  }
  return { ok: true };
}

export function getValidTargets(
  state: GameState,
  fromId: string,
  mode: AttackMode
): string[] {
  const results: string[] = [];
  for (const id of Object.keys(state.territories)) {
    if (canUseAttackMode(state, fromId, id, mode).ok) {
      results.push(id);
    }
  }
  return results;
}

export function previewCombat(
  state: GameState,
  fromId: string,
  toId: string,
  mode: AttackMode
): CombatPreview {
  const check = canUseAttackMode(state, fromId, toId, mode);
  if (!check.ok) {
    return {
      mode,
      canAttack: false,
      reason: check.reason,
      attackerPower: 0,
      defenderPower: 0,
      winChancePct: 0,
      expectedAttackerLoss: '-',
      expectedDefenderLoss: '-',
      defenseTriggered: null,
      notes: [],
    };
  }

  const from = state.territories[fromId];
  const to = state.territories[toId];
  const toDef = TERRITORY_BY_ID[toId];
  const attacker = state.players.find((p) => p.id === from.ownerId)!;
  const defender = state.players.find((p) => p.id === to.ownerId)!;
  const theme = THEMES[state.config.theme];
  const notes: string[] = [];

  if (mode === 'missile') {
    const shielded = to.defenses.missile_shield;
    const bonusDmg = state.config.enableEconomy ? attacker.tech.missiles : 0;
    const minD = 2 + bonusDmg;
    const maxD = 4 + bonusDmg;
    const cdTurns =
      state.config.enableEconomy && attacker.tech.missiles >= 2
        ? Math.max(1, MISSILE_COOLDOWN_TURNS - 1)
        : MISSILE_COOLDOWN_TURNS;

    if (shielded) {
      notes.push(
        `${theme.defenseLabels.missile_shield.name} ativo: interceptará o míssil (0 de dano), mas será consumido.`
      );
    } else {
      notes.push(
        `Causa ${minD} a ${maxD} baixas à distância (mantém mín. 1 tropa) e pode destruir 1 defesa comum.`
      );
    }
    notes.push(`Custo: ${MISSILE_TROOP_COST} tropas da base • Recarga: ${cdTurns} turnos.`);
    return {
      mode,
      canAttack: true,
      attackerPower: shielded ? 0 : minD + 1,
      defenderPower: shielded ? 10 : 1,
      winChancePct: shielded ? 0 : 100,
      expectedAttackerLoss: `${MISSILE_TROOP_COST} (custo)`,
      expectedDefenderLoss: shielded ? '0 (interceptado)' : `${minD} a ${maxD}`,
      defenseTriggered: shielded ? 'missile_shield' : null,
      missileCost: MISSILE_TROOP_COST,
      notes,
    };
  }

  const atkCommit = Math.min(3, from.troops - 1);
  const defCommit = Math.min(2, to.troops);

  // Rebalanced tactical momentum: decisive attacks prevent endless stalemates!
  let atkMult = 1.08;
  let defMult = 1.04;
  let defenseTriggered: DefenseType | null = null;

  // Late-game escalation (desgaste/ofensiva decisiva a partir da rodada 8)
  if (state.round >= 8) {
    const escalation = Math.min(0.36, Math.floor((state.round - 5) / 3) * 0.08);
    if (escalation > 0) {
      atkMult += escalation;
      notes.push(`Ofensiva de Guerra (R${state.round}): +${Math.round(escalation * 100)}% impacto.`);
    }
  }

  // Numerical superiority scaling
  if (from.troops >= to.troops * 2.4) {
    atkMult += 0.28;
    notes.push('Superioridade esmagadora (+28% ataque).');
  } else if (from.troops >= to.troops * 1.5) {
    atkMult += 0.14;
    notes.push('Superioridade numérica (+14% ataque).');
  }

  // Economy: Tech & Infrastructure modifiers
  if (state.config.enableEconomy) {
    if (defender.tech.defense > 0) {
      const defTechBonus = defender.tech.defense * 0.1;
      defMult += defTechBonus;
      notes.push(`Tech Defesa Nv.${defender.tech.defense}: +${Math.round(defTechBonus * 100)}% defesa.`);
    }
  }

  if (mode === 'land') {
    if (state.config.enableEconomy) {
      if (attacker.tech.armor > 0) {
        const b = attacker.tech.armor * 0.12;
        atkMult += b;
        notes.push(`Tech Blindados Nv.${attacker.tech.armor}: +${Math.round(b * 100)}% ataque.`);
      }
      if (from.infrastructure.road) {
        atkMult += 0.15;
        notes.push('Rodovias locais: +15% ímpeto terrestre.');
      }
    }
    if (isSeaRouteBorder(fromId, toId) && to.defenses.coastal) {
      defMult += 0.15;
      defenseTriggered = 'coastal';
      notes.push(`${theme.defenseLabels.coastal.name}: +15% defesa contra travessia.`);
    }
    if (
      state.activeEvent?.id === 'cold_front' &&
      state.activeEvent.affectedContinent === toDef.continentId
    ) {
      atkMult -= 0.2;
      notes.push('Evento Inverno Rigoroso: -20% força terrestre.');
    }
  } else if (mode === 'naval') {
    if (check.seaZone) {
      notes.push(`Rota marítima via ${SEA_ZONE_NAMES[check.seaZone] ?? check.seaZone}.`);
    }
    if (state.config.enableEconomy) {
      if (attacker.tech.navy > 0) {
        const b = attacker.tech.navy * 0.15;
        atkMult += b;
        notes.push(`Tech Marinha Nv.${attacker.tech.navy}: +${Math.round(b * 100)}% ataque naval.`);
      }
      if (from.infrastructure.port) {
        atkMult += 0.15;
        notes.push('Porto Naval na origem: +15% ataque naval.');
      }
    }
    if (to.defenses.coastal) {
      const fortBonus = state.config.enableEconomy && attacker.tech.navy >= 2 ? 0.2 : 0.35;
      defMult += fortBonus;
      defenseTriggered = 'coastal';
      notes.push(
        `${theme.defenseLabels.coastal.name}: +${Math.round(fortBonus * 100)}% defesa e contra-fogo naval.`
      );
    } else {
      atkMult += 0.12;
      notes.push('Costa desprotegida: +12% ímpeto anfíbio.');
    }
    if (state.activeEvent?.id === 'storm_sea_air') {
      atkMult -= 0.2;
      notes.push('Evento Tempestade Oceânica: -20% força naval.');
    }
  } else if (mode === 'air') {
    const airRange = getAirRangeFrom(state, fromId);
    notes.push(`Operação aérea (alcance ${airRange} saltos).`);
    if (state.config.enableEconomy) {
      if (attacker.tech.air_force > 0) {
        const b = attacker.tech.air_force * 0.15;
        atkMult += b;
        notes.push(`Tech Força Aérea Nv.${attacker.tech.air_force}: +${Math.round(b * 100)}% ataque.`);
      }
      if (from.infrastructure.airport) {
        atkMult += 0.15;
        notes.push('Aeroporto na origem: +15% poder aéreo e alcance 3.');
      }
    }
    if (to.defenses.anti_air) {
      atkMult -= 0.32;
      defenseTriggered = 'anti_air';
      notes.push(`${theme.defenseLabels.anti_air.name}: -32% força aérea + 1 baixa de interceptação.`);
    }
    if (state.activeEvent?.id === 'storm_sea_air') {
      atkMult -= 0.2;
      notes.push('Evento Tempestade Oceânica: -20% força aérea.');
    }
  }

  if (state.activeEvent?.id === 'dense_fog') {
    defMult += 0.15;
    notes.push('Evento Nevoeiro Estratégico: +15% defesa.');
  }

  atkMult = Math.max(0.4, atkMult);
  const attackerPower = Number((atkCommit * atkMult).toFixed(2));
  const defenderPower = Number((defCommit * defMult).toFixed(2));
  const winChancePct = Math.round((attackerPower / (attackerPower + defenderPower)) * 100);
  const clashes = Math.min(atkCommit, defCommit);
  const extraAtkLoss = mode === 'air' && to.defenses.anti_air ? ' +1 AA' : '';

  return {
    mode,
    canAttack: true,
    attackerPower,
    defenderPower,
    winChancePct,
    expectedAttackerLoss: `0–${clashes}${extraAtkLoss}`,
    expectedDefenderLoss: `0–${clashes}`,
    defenseTriggered,
    notes,
  };
}

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function resolveCombat(
  state: GameState,
  fromId: string,
  toId: string,
  mode: AttackMode
): CombatResult {
  const from = state.territories[fromId];
  const to = state.territories[toId];
  const fromDef = TERRITORY_BY_ID[fromId];
  const toDef = TERRITORY_BY_ID[toId];
  const attacker = state.players.find((p) => p.id === from.ownerId)!;
  const theme = THEMES[state.config.theme];
  const preview = previewCombat(state, fromId, toId, mode);

  // 1) Missile strike
  if (mode === 'missile') {
    from.troops -= MISSILE_TROOP_COST;
    let cd = MISSILE_COOLDOWN_TURNS;
    if (state.config.enableEconomy && attacker.tech.missiles >= 2) cd -= 1;
    if (state.activeEvent?.id === 'tech_breakthrough') cd -= 1;
    attacker.missileCooldown = Math.max(1, cd);

    if (to.defenses.missile_shield) {
      to.defenses.missile_shield = false;
      return {
        mode,
        fromId,
        toId,
        attackerId: from.ownerId,
        defenderId: to.ownerId,
        attackerLosses: MISSILE_TROOP_COST,
        defenderLosses: 0,
        conquered: false,
        defenseTriggered: 'missile_shield',
        shieldConsumed: true,
        summary: `${theme.attackLabels.missile.icon} ${theme.attackLabels.missile.name} contra ${toDef.name} foi INTERCEPTADO pelo ${theme.defenseLabels.missile_shield.name} (escudo descarregado).`,
      };
    }

    const techDmg = state.config.enableEconomy ? attacker.tech.missiles : 0;
    const rawDmg = 2 + techDmg + Math.floor(Math.random() * 3);
    const actualLoss = Math.min(Math.max(0, to.troops - 1), rawDmg);
    to.troops -= actualLoss;

    let destroyedDefNote = '';
    if (to.defenses.anti_air || to.defenses.coastal) {
      if (Math.random() < 0.65) {
        if (to.defenses.anti_air) {
          to.defenses.anti_air = false;
          destroyedDefNote = ` e destruiu ${theme.defenseLabels.anti_air.name}`;
        } else if (to.defenses.coastal) {
          to.defenses.coastal = false;
          destroyedDefNote = ` e destruiu ${theme.defenseLabels.coastal.name}`;
        }
      }
    }

    return {
      mode,
      fromId,
      toId,
      attackerId: from.ownerId,
      defenderId: to.ownerId,
      attackerLosses: MISSILE_TROOP_COST,
      defenderLosses: actualLoss,
      conquered: false,
      defenseTriggered: null,
      shieldConsumed: false,
      summary: `${theme.attackLabels.missile.icon} ${theme.attackLabels.missile.name} de ${fromDef.name} atingiu ${toDef.name}: -${actualLoss} tropas inimigas${destroyedDefNote}.`,
    };
  }

  // 2) Land / Naval / Air combat
  const atkCommit = Math.min(3, from.troops - 1);
  const defCommit = Math.min(2, to.troops);
  const clashes = Math.min(atkCommit, defCommit);

  let attackerLosses = 0;
  let defenderLosses = 0;
  let diceAttacker: number[] | undefined;
  let diceDefender: number[] | undefined;

  if (state.config.combatSystem === 'classic_dice') {
    diceAttacker = Array.from({ length: atkCommit }, rollDie).sort((a, b) => b - a);
    diceDefender = Array.from({ length: defCommit }, rollDie).sort((a, b) => b - a);

    const effAtk = [...diceAttacker];
    const effDef = [...diceDefender];

    if (
      (mode === 'naval' && to.defenses.coastal) ||
      (mode === 'air' && to.defenses.anti_air) ||
      state.activeEvent?.id === 'dense_fog'
    ) {
      effDef[0] = Math.min(6, effDef[0] + 1);
    }
    if (
      (state.activeEvent?.id === 'storm_sea_air' && (mode === 'naval' || mode === 'air')) ||
      (state.activeEvent?.id === 'cold_front' &&
        mode === 'land' &&
        state.activeEvent.affectedContinent === toDef.continentId)
    ) {
      effAtk[0] = Math.max(1, effAtk[0] - 1);
    }

    for (let i = 0; i < clashes; i++) {
      if (effAtk[i] > effDef[i]) {
        defenderLosses++;
      } else {
        attackerLosses++;
      }
    }
  } else {
    // Tactical Hybrid system: sharper decisive combat ratio (exponent 1.25 rewards tactical advantage)
    const aPow = Math.pow(Math.max(0.1, preview.attackerPower), 1.25);
    const dPow = Math.pow(Math.max(0.1, preview.defenderPower), 1.25);
    const pWin = aPow / (aPow + dPow);
    for (let i = 0; i < clashes; i++) {
      if (Math.random() < pWin) {
        defenderLosses++;
      } else {
        attackerLosses++;
      }
    }
    // Overwhelming shockwave: if attacker wins all clashes with >=2.2x power, inflict +1 bonus casualty
    if (
      attackerLosses === 0 &&
      defenderLosses > 0 &&
      preview.attackerPower >= preview.defenderPower * 1.9 &&
      to.troops - defenderLosses > 0
    ) {
      defenderLosses++;
    }
  }

  // Anti-air guaranteed interception casualty
  if (mode === 'air' && to.defenses.anti_air && from.troops - attackerLosses > 1) {
    attackerLosses++;
  }

  // Coastal Fortification counter-battery if naval attack fails to break defense
  const coastalCounterChance =
    state.config.enableEconomy && attacker.tech.navy >= 2 ? 0.35 : 0.65;
  if (
    mode === 'naval' &&
    to.defenses.coastal &&
    to.troops - defenderLosses > 0 &&
    from.troops - attackerLosses > 1 &&
    Math.random() < coastalCounterChance
  ) {
    attackerLosses++;
  }

  attackerLosses = Math.min(attackerLosses, from.troops - 1);
  defenderLosses = Math.min(defenderLosses, to.troops);

  from.troops -= attackerLosses;
  to.troops -= defenderLosses;

  const conquered = to.troops <= 0;
  const modeLabel = theme.attackLabels[mode];
  const diceInfo =
    diceAttacker && diceDefender
      ? ` [Dados ${diceAttacker.join(',')} vs ${diceDefender.join(',')}]`
      : '';
  const defNote = preview.defenseTriggered
    ? ` (${theme.defenseLabels[preview.defenseTriggered].short} ativa)`
    : '';

  const summary = conquered
    ? `${modeLabel.icon} ${fromDef.name} conquistou ${toDef.name} via ${modeLabel.name}! Baixas: -${attackerLosses} atq / -${defenderLosses} def${defNote}${diceInfo}.`
    : `${modeLabel.icon} ${modeLabel.name}: ${fromDef.name} → ${toDef.name} | Baixas: -${attackerLosses} atq / -${defenderLosses} def${defNote}${diceInfo}.`;

  return {
    mode,
    fromId,
    toId,
    attackerId: from.ownerId,
    defenderId: to.ownerId,
    attackerLosses,
    defenderLosses,
    conquered,
    defenseTriggered: preview.defenseTriggered,
    shieldConsumed: false,
    diceAttacker,
    diceDefender,
    summary,
  };
}
