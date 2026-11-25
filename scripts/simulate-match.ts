import { TERRITORIES, TERRITORY_BY_ID, PLAYER_PALETTE } from '../src/data/mapData.ts';
import {
  advancePhase,
  buildDefense,
  buildInfrastructure,
  conductEspionage,
  createNewGame,
  dropBomb,
  executeAttack,
  findValidCardSet,
  getPlayerIncome,
  getPlayerTerritories,
  placeReinforcement,
  recruitTroopsWithMoney,
  tradeCards,
  upgradeTechnology,
} from '../src/engine/gameEngine.ts';
import { getValidTargets, previewCombat } from '../src/engine/combat.ts';
import { proposePactToAI, runCompleteAITurn } from '../src/engine/ai.ts';
import type { AttackMode, GameConfig } from '../src/types.ts';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

// 1. Validate map topology symmetry & connectivity
console.log('1) Validando topologia do mapa (42 territórios)...');
assert(TERRITORIES.length === 42, `Expected 42 territories, got ${TERRITORIES.length}`);
for (const t of TERRITORIES) {
  for (const n of t.neighbors) {
    const nDef = TERRITORY_BY_ID[n];
    assert(Boolean(nDef), `Neighbor ${n} of ${t.id} does not exist`);
    assert(
      nDef.neighbors.includes(t.id),
      `Asymmetric border: ${t.id} -> ${n} but ${n} does not list ${t.id}`
    );
  }
}
const visited = new Set<string>([TERRITORIES[0].id]);
const q = [TERRITORIES[0].id];
while (q.length > 0) {
  const c = q.shift()!;
  for (const n of TERRITORY_BY_ID[c].neighbors) {
    if (!visited.has(n)) {
      visited.add(n);
      q.push(n);
    }
  }
}
assert(visited.size === TERRITORIES.length, `Map is not fully connected (${visited.size}/${TERRITORIES.length})`);
console.log('   OK: 42 territórios simétricos e 100% conectados.');

// 2. Test special warfare, economy (infra, manpower, tech, bombs, espionage), defenses & diplomacy
console.log('2) Testando economia (infra, mão de obra, tech, bombas, espionagem), mísseis e diplomacia...');
const testConfig: GameConfig = {
  players: [
    { name: 'Humano', color: PLAYER_PALETTE[0].color, colorName: 'Vermelho', isAI: false, difficulty: 'medium' },
    { name: 'IA Alfa', color: PLAYER_PALETTE[1].color, colorName: 'Azul', isAI: true, difficulty: 'medium' },
    { name: 'IA Beta', color: PLAYER_PALETTE[2].color, colorName: 'Verde', isAI: true, difficulty: 'hard' },
  ],
  combatSystem: 'tactical',
  theme: 'classic',
  enableRandomEvents: true,
  enableSpecialWarfare: true,
  enableDiplomacy: true,
  enableEconomy: true,
  maxRounds: 25,
  victoryMode: 'objectives',
};

const state = createNewGame(testConfig);
const p1 = state.players[0];
assert(p1.money === 120, `Expected starting money 120, got ${p1.money}`);
const p1Terrs = getPlayerTerritories(state, p1.id);
const coastalOwned = p1Terrs.find((t) => TERRITORY_BY_ID[t.id].isCoastal) ?? p1Terrs[0];

// Build Factory & verify income increases by +$25
const incBefore = getPlayerIncome(state, p1.id).infraIncome;
assert(buildInfrastructure(state, coastalOwned.id, 'factory').ok, 'Factory build should succeed');
const incAfter = getPlayerIncome(state, p1.id).infraIncome;
assert(incAfter === incBefore + 25, `Expected +25 infra income, got ${incAfter - incBefore}`);

// Recruit +1 troop with money
const troopsBefore = state.territories[coastalOwned.id].troops;
assert(recruitTroopsWithMoney(state, coastalOwned.id, 'recruit_1').ok, 'Recruit +1 should succeed');
assert(state.territories[coastalOwned.id].troops === troopsBefore + 1, 'Troops should increase by 1');

// Upgrade tech + test strategic bomb vs Missile Shield + Espionage
p1.money = 800;
assert(upgradeTechnology(state, 'missiles').ok, 'Missile tech lvl 1 should succeed');
assert(upgradeTechnology(state, 'missiles').ok, 'Missile tech lvl 2 should succeed');
assert(p1.tech.missiles === 2, 'Expected missiles tech level 2');
assert(conductEspionage(state, state.players[1].id).ok, 'Espionage should succeed');
assert(p1.revealedObjectiveIds.includes(state.players[1].id), 'Rival objective should be revealed');

// Build defense during reinforce
assert(buildDefense(state, coastalOwned.id, 'anti_air').ok, 'Anti-air build should succeed');
while (state.reinforcementsLeft > 0) {
  assert(placeReinforcement(state, coastalOwned.id, 1).ok, 'Reinforce should succeed');
}
assert(advancePhase(state).ok, 'Failed to advance to attack phase');

// Test strategic bomb intercepted by Missile Shield, then second strategic bomb hitting
const enemyTerr = Object.values(state.territories).find((t) => t.ownerId !== p1.id)!;
enemyTerr.troops = 8;
enemyTerr.infrastructure.factory = true;
enemyTerr.defenses.missile_shield = true;
const bombBlocked = dropBomb(state, enemyTerr.id, 'strategic');
assert(bombBlocked.ok && bombBlocked.result?.shieldConsumed === true, 'Strategic bomb should be intercepted by shield');
assert(enemyTerr.troops === 8 && enemyTerr.defenses.missile_shield === false, 'Shield should absorb bomb');
const bombHit = dropBomb(state, enemyTerr.id, 'strategic');
assert(bombHit.ok && (bombHit.result?.defenderLosses ?? 0) >= 4, 'Strategic bomb should deal 4-6 losses');
assert(enemyTerr.infrastructure.factory === false, 'Strategic bomb should destroy infrastructure');

// Test regular missile launch & cooldown
state.territories[coastalOwned.id].troops = Math.max(state.territories[coastalOwned.id].troops, 6);
enemyTerr.troops = 6;
const prevM = previewCombat(state, coastalOwned.id, enemyTerr.id, 'missile');
assert(prevM.canAttack, 'Missile preview should allow attack');
const mHit = executeAttack(state, coastalOwned.id, enemyTerr.id, 'missile');
assert(mHit.ok && p1.missileCooldown > 0, 'Missile should launch and enter cooldown');

// Test diplomacy pact proposal
const pactRes = proposePactToAI(state, p1.id, state.players[1].id, 3);
assert(pactRes.ok, 'Diplomacy proposal call should succeed');
console.log(`   OK: Economia, Infra, Tech, Bombas, Espionagem, Míssil e Diplomacia (${pactRes.accepted ? 'aceito' : 'recusado'}) validados.`);

// 3. Simulate full matches and STRICTLY assert BOTH Tactical and Classic Dice matches ALWAYS finish with a winner!
const runs: Array<{ label: string; system: 'tactical' | 'classic_dice' }> = [
  { label: 'tactical #1', system: 'tactical' },
  { label: 'tactical #2', system: 'tactical' },
  { label: 'tactical #3', system: 'tactical' },
  { label: 'classic_dice #1', system: 'classic_dice' },
];

for (const run of runs) {
  console.log(`3) Simulando partida completa contra IA (${run.label})...`);
  const sim = createNewGame({
    players: [
      { name: 'Jogador', color: PLAYER_PALETTE[0].color, colorName: 'Vermelho', isAI: false, difficulty: 'medium' },
      { name: 'IA Recruta', color: PLAYER_PALETTE[1].color, colorName: 'Azul', isAI: true, difficulty: 'easy' },
      { name: 'IA Estrategista', color: PLAYER_PALETTE[2].color, colorName: 'Verde', isAI: true, difficulty: 'medium' },
      { name: 'IA Marechal', color: PLAYER_PALETTE[3].color, colorName: 'Amarelo', isAI: true, difficulty: 'hard' },
    ],
    combatSystem: run.system,
    theme: run.system === 'tactical' ? 'classic' : 'napoleonic',
    enableRandomEvents: true,
    enableSpecialWarfare: true,
    enableDiplomacy: true,
    enableEconomy: true,
    maxRounds: 25,
    victoryMode: 'objectives',
  });

  const modeUsage: Record<AttackMode, number> = { land: 0, naval: 0, air: 0, missile: 0 };
  let turns = 0;

  while (!sim.winnerId && turns < 140) {
    const curr = sim.players[sim.currentPlayerIndex];
    if (curr.isAI) {
      const results = runCompleteAITurn(sim, 12);
      for (const r of results) modeUsage[r.mode]++;
    } else {
      const set = findValidCardSet(curr.cards);
      if (set && curr.cards.length >= 3) {
        tradeCards(sim, set.map((c) => c.id));
      }
      const owned = getPlayerTerritories(sim, curr.id);
      const border =
        owned.find((t) =>
          TERRITORY_BY_ID[t.id].neighbors.some((n) => sim.territories[n].ownerId !== curr.id)
        ) ?? owned[0];
      if (curr.money >= 80) {
        recruitTroopsWithMoney(sim, border.id, 'recruit_3');
      }
      while (sim.reinforcementsLeft > 0) {
        placeReinforcement(sim, border.id, 1);
      }
      advancePhase(sim);

      for (const mode of ['land', 'naval', 'air'] as AttackMode[]) {
        const strong = getPlayerTerritories(sim, curr.id).find((t) => t.troops >= 4);
        if (!strong) continue;
        const targets = getValidTargets(sim, strong.id, mode);
        if (targets.length > 0 && sim.phase === 'attack') {
          const r = executeAttack(sim, strong.id, targets[0], mode);
          if (r.ok && r.result) {
            modeUsage[r.result.mode]++;
            if (sim.phase === 'occupy' && sim.pendingConquest) {
              const maxM = sim.pendingConquest.maxMove;
              const fromT = sim.territories[sim.pendingConquest.fromId];
              const toT = sim.territories[sim.pendingConquest.toId];
              const extra = Math.max(0, maxM - 1);
              fromT.troops -= extra;
              toT.troops += extra;
              sim.pendingConquest = null;
              sim.phase = sim.winnerId ? 'game_over' : 'attack';
            }
          }
        }
      }

      if (!sim.winnerId && sim.phase === 'attack') advancePhase(sim);
      if (!sim.winnerId && sim.phase === 'fortify') advancePhase(sim);
    }
    turns++;
  }

  for (const t of Object.values(sim.territories)) {
    assert(t.troops >= 1, `Territory ${t.id} ended with ${t.troops} troops!`);
  }

  const winner = sim.players.find((p) => p.id === sim.winnerId);
  assert(Boolean(winner), `Partida ${run.label} terminou SEM VENCEDOR após ${turns} turnos (rodada ${sim.round})!`);
  console.log(
    `   OK (${run.label}): ${turns} turnos, rodada ${sim.round}. Vencedor: ${winner!.name} (${sim.winReason}) | Ataques: ${JSON.stringify(modeUsage)}`
  );
}

console.log('✅ Todos os testes de motor, economia e partidas táticas/clássicas contra IA passaram com vencedor garantido!');
