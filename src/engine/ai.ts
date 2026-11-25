import type {
  AttackMode,
  BombType,
  CombatResult,
  DefenseType,
  GameState,
  Player,
  TechBranch,
} from '../types.ts';
import { CONTINENTS, TERRITORIES, TERRITORY_BY_ID } from '../data/mapData.ts';
import {
  getDefenseCost,
  getValidTargets,
  hasActivePact,
  previewCombat,
} from './combat.ts';
import {
  INFRASTRUCTURE_DEFS,
  canDropBombOn,
  countTerritoryInfra,
  getTechUpgradeCost,
} from './economy.ts';
import {
  addLog,
  advancePhase,
  buildDefense,
  buildInfrastructure,
  createPact,
  dropBomb,
  executeAttack,
  findValidCardSet,
  fortifyTroops,
  getFortifyTargets,
  getPlayerTerritories,
  placeReinforcement,
  recruitTroopsWithMoney,
  tradeCards,
  upgradeTechnology,
} from './gameEngine.ts';

function isBorderTerritory(state: GameState, terrId: string, playerId: string): boolean {
  return TERRITORY_BY_ID[terrId].neighbors.some(
    (n) => state.territories[n]?.ownerId !== playerId
  );
}

function scoreTerritoryPriority(state: GameState, player: Player, terrId: string): number {
  const def = TERRITORY_BY_ID[terrId];
  const terr = state.territories[terrId];
  let score = 0;

  const enemyNeighbors = def.neighbors.filter(
    (n) => state.territories[n]?.ownerId !== player.id
  );
  if (enemyNeighbors.length === 0) return -10;
  score += enemyNeighbors.length * 4;

  const maxEnemy = Math.max(
    0,
    ...enemyNeighbors.map((n) => state.territories[n].troops)
  );
  if (maxEnemy > terr.troops) score += (maxEnemy - terr.troops) * 2.5;

  if (
    player.objective.kind === 'conquer_continents' &&
    player.objective.continents?.includes(def.continentId)
  ) {
    score += 12;
  }

  if (player.objective.kind === 'destroy_player' && player.objective.targetPlayerId) {
    if (
      enemyNeighbors.some(
        (n) => state.territories[n].ownerId === player.objective.targetPlayerId
      )
    ) {
      score += 14;
    }
  }

  const contTerrs = TERRITORIES.filter((t) => t.continentId === def.continentId);
  const ownedInCont = contTerrs.filter(
    (t) => state.territories[t.id].ownerId === player.id
  ).length;
  if (ownedInCont >= contTerrs.length - 2) {
    score += 9;
  }

  return score;
}

export function evaluateAIPactProposal(
  state: GameState,
  aiPlayer: Player,
  proposerId: string
): { accepted: boolean; reason: string } {
  const proposer = state.players.find((p) => p.id === proposerId);
  if (!proposer || proposer.eliminated) {
    return { accepted: false, reason: 'Proponente inválido.' };
  }

  if (
    aiPlayer.objective.kind === 'destroy_player' &&
    aiPlayer.objective.targetPlayerId === proposerId
  ) {
    return {
      accepted: false,
      reason: `${aiPlayer.name} recusou: interesses estratégicos incompatíveis.`,
    };
  }

  if (proposer.betrayals >= 2) {
    return {
      accepted: false,
      reason: `${aiPlayer.name} recusou por desconfiança devido a pactos rompidos anteriormente.`,
    };
  }

  const aiTerrs = getPlayerTerritories(state, aiPlayer.id).length;
  const propTerrs = getPlayerTerritories(state, proposerId).length;
  const aliveCount = state.players.filter((p) => !p.eliminated).length;

  if (aliveCount <= 2) {
    return {
      accepted: false,
      reason: `${aiPlayer.name} recusou: restam apenas dois comandos em guerra total!`,
    };
  }

  if (propTerrs >= 19) {
    return {
      accepted: false,
      reason: `${aiPlayer.name} recusou: considera seu império uma ameaça global.`,
    };
  }

  let acceptChance = 0.55;
  if (proposer.betrayals === 1) acceptChance -= 0.3;
  if (aiTerrs < propTerrs) acceptChance += 0.2;
  if (aiPlayer.difficulty === 'easy') acceptChance += 0.15;
  if (aiPlayer.difficulty === 'hard') acceptChance -= 0.1;

  const existingPacts = state.pacts.filter(
    (p) => p.playerA === aiPlayer.id || p.playerB === aiPlayer.id
  ).length;
  if (existingPacts >= 2) acceptChance -= 0.35;

  const accepted = Math.random() < Math.max(0.1, Math.min(0.9, acceptChance));
  return {
    accepted,
    reason: accepted
      ? `${aiPlayer.name} aceitou o Pacto de Não Agressão!`
      : `${aiPlayer.name} recusou a proposta no momento.`,
  };
}

export function proposePactToAI(
  state: GameState,
  fromPlayerId: string,
  toAIId: string,
  duration = 3
): { ok: boolean; accepted: boolean; message: string } {
  if (!state.config.enableDiplomacy) {
    return { ok: false, accepted: false, message: 'Diplomacia desativada.' };
  }
  if (hasActivePact(state, fromPlayerId, toAIId)) {
    return { ok: false, accepted: false, message: 'Já existe um pacto ativo.' };
  }
  const ai = state.players.find((p) => p.id === toAIId);
  if (!ai || !ai.isAI || ai.eliminated) {
    return { ok: false, accepted: false, message: 'Alvo diplomático inválido.' };
  }
  const evalRes = evaluateAIPactProposal(state, ai, fromPlayerId);
  if (evalRes.accepted) {
    createPact(state, fromPlayerId, toAIId, duration);
  } else {
    addLog(state, 'diplomacy', evalRes.reason);
  }
  return { ok: true, accepted: evalRes.accepted, message: evalRes.reason };
}

/**
 * Sensible AI economic management: factories, ports/airports/roads, military tech, manpower, and bombs!
 */
function runAIEconomySpending(
  state: GameState,
  player: Player,
  topFrontlineId: string
): void {
  if (!state.config.enableEconomy || player.money < 30) return;

  const owned = getPlayerTerritories(state, player.id);
  if (owned.length === 0) return;

  // 1) Early-game economy investment: build a Factory in a safer interior or strong territory
  const factoryCount = owned.filter((t) => t.infrastructure.factory).length;
  const maxFactories = player.difficulty === 'hard' ? 4 : player.difficulty === 'medium' ? 3 : 1;
  if (
    state.round <= 12 &&
    factoryCount < maxFactories &&
    player.money >= INFRASTRUCTURE_DEFS.factory.cost + 20
  ) {
    const safeCandidate =
      owned.find((t) => !t.infrastructure.factory && !isBorderTerritory(state, t.id, player.id)) ??
      owned.find((t) => !t.infrastructure.factory && t.troops >= 3);
    if (safeCandidate) {
      buildInfrastructure(state, safeCandidate.id, 'factory');
    }
  }

  // 2) Military Technology upgrades (prioritize offensive tech on Medium/Hard)
  const techOrder: TechBranch[] =
    player.difficulty === 'hard'
      ? ['armor', 'air_force', 'navy', 'missiles', 'defense']
      : ['armor', 'navy', 'air_force', 'defense', 'missiles'];
  if (player.difficulty !== 'easy' || Math.random() < 0.4) {
    for (const branch of techOrder) {
      const cost = getTechUpgradeCost(player, branch);
      if (cost !== null && player.money >= cost + (player.difficulty === 'hard' ? 30 : 45)) {
        upgradeTechnology(state, branch);
        break;
      }
    }
  }

  // 3) Strategic frontline infrastructure (Road / Airport / Port) on key staging hub
  const hub = state.territories[topFrontlineId];
  const hubDef = TERRITORY_BY_ID[topFrontlineId];
  if (hub && hubDef && player.difficulty !== 'easy') {
    if (!hub.infrastructure.road && player.money >= INFRASTRUCTURE_DEFS.road.cost + 40) {
      buildInfrastructure(state, hub.id, 'road');
    } else if (
      hubDef.isCoastal &&
      !hub.infrastructure.port &&
      player.money >= INFRASTRUCTURE_DEFS.port.cost + 45
    ) {
      buildInfrastructure(state, hub.id, 'port');
    } else if (!hub.infrastructure.airport && player.money >= INFRASTRUCTURE_DEFS.airport.cost + 50) {
      buildInfrastructure(state, hub.id, 'airport');
    }
  }

  // 4) Recruit extra manpower onto key frontline border
  let recruitLoops = 0;
  while (player.money >= 80 && recruitLoops < 2) {
    if (player.money >= 125) {
      recruitTroopsWithMoney(state, topFrontlineId, 'recruit_5');
    } else {
      recruitTroopsWithMoney(state, topFrontlineId, 'recruit_3');
    }
    recruitLoops++;
  }
  if (player.money >= 30 && player.difficulty === 'hard' && Math.random() < 0.5) {
    recruitTroopsWithMoney(state, topFrontlineId, 'recruit_1');
  }
}

export function runAIReinforcePhase(state: GameState): void {
  const player = state.players[state.currentPlayerIndex];
  if (!player.isAI || state.phase !== 'reinforce') return;

  // 1) Trade cards if required or beneficial
  let cardSet = findValidCardSet(player.cards);
  while (
    cardSet &&
    (player.cards.length >= 5 || player.difficulty !== 'easy' || Math.random() < 0.65)
  ) {
    tradeCards(
      state,
      cardSet.map((c) => c.id)
    );
    cardSet = findValidCardSet(player.cards);
  }

  const owned = getPlayerTerritories(state, player.id);
  if (owned.length === 0) return;

  const borders = owned.filter((t) => isBorderTerritory(state, t.id, player.id));
  const candidates = borders.length > 0 ? borders : owned;

  const scored = candidates
    .map((t) => ({
      terr: t,
      score:
        scoreTerritoryPriority(state, player, t.id) +
        (player.difficulty === 'easy' ? Math.random() * 14 : Math.random() * 3),
    }))
    .sort((a, b) => b.score - a.score);

  // 2) Spend economic treasury sensibly before attacking
  if (scored[0]) {
    runAIEconomySpending(state, player, scored[0].terr.id);
  }

  // 3) Optionally construct special defenses on high-value borders
  if (state.config.enableSpecialWarfare && state.reinforcementsLeft >= 3) {
    const defChance =
      player.difficulty === 'hard' ? 0.5 : player.difficulty === 'medium' ? 0.3 : 0.1;
    if (Math.random() < defChance) {
      const hub = scored[0]?.terr;
      if (hub) {
        const defDef = TERRITORY_BY_ID[hub.id];
        const options: DefenseType[] = [];
        if (defDef.isCoastal && !hub.defenses.coastal) options.push('coastal');
        if (!hub.defenses.anti_air) options.push('anti_air');
        if (!hub.defenses.missile_shield && hub.troops >= 5) {
          options.push('missile_shield');
        }
        if (options.length > 0) {
          const chosen = options[Math.floor(Math.random() * options.length)];
          const cost = getDefenseCost(state, chosen);
          if (state.reinforcementsLeft >= cost + 2) {
            buildDefense(state, hub.id, chosen);
          }
        }
      }
    }
  }

  // 4) Distribute remaining reinforcements (concentrated push for decisive campaigns!)
  if (player.difficulty === 'easy') {
    while (state.reinforcementsLeft > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      placeReinforcement(state, pick.id, 1);
    }
  } else {
    const topTargets = scored.slice(0, Math.min(2, scored.length));
    let idx = 0;
    while (state.reinforcementsLeft > 0) {
      const target = topTargets[idx % topTargets.length].terr;
      placeReinforcement(state, target.id, 1);
      idx++;
    }
  }

  // 5) Occasional diplomatic proposal to human
  if (state.config.enableDiplomacy && state.round >= 2 && Math.random() < 0.16) {
    const aliveCount = state.players.filter((p) => !p.eliminated).length;
    if (aliveCount >= 3) {
      const humans = state.players.filter(
        (p) =>
          !p.isAI &&
          !p.eliminated &&
          !hasActivePact(state, player.id, p.id) &&
          !state.pendingPactOffers.some(
            (o) => o.fromPlayerId === player.id && o.toPlayerId === p.id
          ) &&
          !(
            player.objective.kind === 'destroy_player' &&
            player.objective.targetPlayerId === p.id
          )
      );
      if (humans.length > 0) {
        const targetHuman = humans[0];
        state.pendingPactOffers.push({
          fromPlayerId: player.id,
          toPlayerId: targetHuman.id,
          duration: 3,
        });
        addLog(
          state,
          'diplomacy',
          `📩 ${player.name} enviou uma proposta de Pacto de Não Agressão (3 rodadas) para ${targetHuman.name}.`
        );
      }
    }
  }

  advancePhase(state);
}

interface CandidateAttack {
  fromId: string;
  toId: string;
  mode: AttackMode;
  score: number;
}

function pickBestAIAttack(state: GameState, player: Player): CandidateAttack | null {
  const owned = getPlayerTerritories(state, player.id).filter((t) => t.troops >= 2);
  const modes: AttackMode[] = state.config.enableSpecialWarfare
    ? ['land', 'naval', 'air', 'missile']
    : ['land'];

  const candidates: CandidateAttack[] = [];

  for (const from of owned) {
    for (const mode of modes) {
      if (mode === 'missile' && (player.missileCooldown > 0 || from.troops < 4)) continue;
      if ((mode === 'naval' || mode === 'air') && from.troops < 3) continue;

      const targets = getValidTargets(state, from.id, mode);
      for (const toId of targets) {
        const to = state.territories[toId];
        const toDef = TERRITORY_BY_ID[toId];
        const preview = previewCombat(state, from.id, toId, mode);
        if (!preview.canAttack) continue;

        let score = 0;

        if (mode === 'missile') {
          if (to.troops < 4 && !to.defenses.missile_shield) continue;
          if (to.defenses.missile_shield && player.difficulty === 'hard') {
            score = to.troops >= 7 ? 38 : -50;
          } else {
            score = to.troops * 8 + (to.defenses.coastal || to.defenses.anti_air ? 10 : 0);
          }
          if (player.difficulty === 'easy') score -= 18;
        } else {
          const minWinChance =
            player.difficulty === 'hard' ? 48 : player.difficulty === 'medium' ? 45 : 40;
          if (preview.winChancePct < minWinChance && from.troops < to.troops + 2) {
            continue;
          }

          score = preview.winChancePct + (from.troops - to.troops) * 5.5;

          if (mode === 'land') score += 7;
          if (mode === 'air' && to.defenses.anti_air) score -= 24;
          if (mode === 'naval' && to.defenses.coastal) score -= 20;

          // Bonus for valuable industrial territories
          if (state.config.enableEconomy) {
            score += countTerritoryInfra(state, toId) * 6;
          }

          const contTerrs = TERRITORIES.filter((t) => t.continentId === toDef.continentId);
          const ourCount = contTerrs.filter(
            (t) => state.territories[t.id].ownerId === player.id
          ).length;
          const enemyCount = contTerrs.filter(
            (t) => state.territories[t.id].ownerId === to.ownerId
          ).length;

          if (enemyCount === contTerrs.length) {
            score += CONTINENTS[toDef.continentId].bonus * 6;
          }
          if (ourCount >= contTerrs.length - 2) {
            score += 20;
          }

          if (
            player.objective.kind === 'conquer_continents' &&
            player.objective.continents?.includes(toDef.continentId)
          ) {
            score += 24;
          }
          if (
            player.objective.kind === 'destroy_player' &&
            player.objective.targetPlayerId === to.ownerId
          ) {
            score += 26;
          }

          if (!state.conqueredThisTurn) {
            score += 12;
          }

          if (player.difficulty === 'easy') {
            score += Math.random() * 22 - 10;
          }
        }

        if (score > 40) {
          candidates.push({ fromId: from.id, toId, mode, score });
        }
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

function tryAIBombStrike(state: GameState, player: Player): CombatResult | null {
  if (!state.config.enableEconomy || player.money < 55) return null;
  const bombOrder: BombType[] = ['strategic', 'heavy', 'conventional'];
  const enemies = Object.values(state.territories)
    .filter((t) => t.ownerId !== player.id && (t.troops >= 5 || countTerritoryInfra(state, t.id) >= 1))
    .sort(
      (a, b) =>
        b.troops + countTerritoryInfra(state, b.id) * 3 - (a.troops + countTerritoryInfra(state, a.id) * 3)
    );

  if (enemies.length === 0) return null;

  for (const bombType of bombOrder) {
    for (const target of enemies.slice(0, 5)) {
      if (bombType === 'strategic' && target.defenses.missile_shield && player.difficulty === 'hard') {
        continue;
      }
      const check = canDropBombOn(state, player, target.id, bombType);
      if (check.ok) {
        const res = dropBomb(state, target.id, bombType);
        if (res.ok && res.result) return res.result;
      }
    }
  }
  return null;
}

export function runSingleAIAttackStep(state: GameState): CombatResult | null {
  const player = state.players[state.currentPlayerIndex];
  if (!player.isAI || state.phase !== 'attack' || state.winnerId) return null;

  // Occasionally soften a heavily fortified or industrial target with a Bomb before invading!
  if (state.config.enableEconomy && player.money >= 90 && Math.random() < 0.35) {
    const bombRes = tryAIBombStrike(state, player);
    if (bombRes) return bombRes;
  }

  const best = pickBestAIAttack(state, player);
  if (!best) return null;

  const res = executeAttack(state, best.fromId, best.toId, best.mode);
  if (!res.ok || !res.result) return null;

  if (res.result.conquered && !state.winnerId) {
    const from = state.territories[best.fromId];
    const to = state.territories[best.toId];
    const extraAvailable = from.troops - 1;
    if (extraAvailable > 0) {
      const originStillBorder = isBorderTerritory(state, from.id, player.id);
      const destIsBorder = isBorderTerritory(state, to.id, player.id);
      let toMove = 0;
      if (!originStillBorder && destIsBorder) {
        toMove = extraAvailable;
      } else if (originStillBorder && destIsBorder) {
        toMove = Math.floor(extraAvailable * 0.65);
      } else {
        toMove = Math.floor(extraAvailable * 0.5);
      }
      if (toMove > 0) {
        from.troops -= toMove;
        to.troops += toMove;
      }
    }
  }

  return res.result;
}

export function runAIFortifyAndEndTurn(state: GameState): void {
  const player = state.players[state.currentPlayerIndex];
  if (!player.isAI || state.winnerId) return;

  if (state.phase === 'attack') {
    advancePhase(state);
  }
  if (state.phase === 'fortify' && !state.fortifyUsed) {
    const owned = getPlayerTerritories(state, player.id);
    const interiorDonors = owned
      .filter((t) => t.troops >= 2 && !isBorderTerritory(state, t.id, player.id))
      .sort((a, b) => b.troops - a.troops);

    for (const donor of interiorDonors) {
      const reachable = getFortifyTargets(state, donor.id);
      const reachableBorders = reachable
        .filter((id) => isBorderTerritory(state, id, player.id))
        .sort(
          (a, b) =>
            scoreTerritoryPriority(state, player, b) -
            scoreTerritoryPriority(state, player, a)
        );
      if (reachableBorders.length > 0) {
        fortifyTroops(state, donor.id, reachableBorders[0], donor.troops - 1);
        break;
      }
    }
  }

  if (state.phase === 'fortify') {
    advancePhase(state);
  }
}

export function runCompleteAITurn(state: GameState, maxAttacks = 12): CombatResult[] {
  const results: CombatResult[] = [];
  if (state.phase === 'reinforce') {
    runAIReinforcePhase(state);
  }
  let count = 0;
  while (state.phase === 'attack' && !state.winnerId && count < maxAttacks) {
    const r = runSingleAIAttackStep(state);
    if (!r) break;
    results.push(r);
    count++;
  }
  if (!state.winnerId) {
    runAIFortifyAndEndTurn(state);
  }
  return results;
}
