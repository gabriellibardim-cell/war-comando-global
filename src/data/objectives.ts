import type { Player, SecretObjective } from '../types.ts';
import { CONTINENTS, TERRITORIES } from './mapData.ts';

export function assignSecretObjectives(
  players: Player[],
  victoryMode: 'objectives' | 'domination'
): void {
  if (victoryMode === 'domination') {
    for (const p of players) {
      p.objective = {
        id: `dom_${p.id}`,
        kind: 'world_domination',
        title: 'Dominação Global',
        description: `Conquistar todos os ${TERRITORIES.length} territórios do mapa.`,
        territoryCount: TERRITORIES.length,
      };
    }
    return;
  }

  const continentPairs: Array<[keyof typeof CONTINENTS, keyof typeof CONTINENTS]> = [
    ['america_sul', 'europa'],
    ['america_norte', 'oceania'],
    ['asia', 'america_sul'],
    ['asia', 'africa'],
    ['america_norte', 'africa'],
    ['europa', 'oceania'],
  ];

  const pool: SecretObjective[] = [
    ...continentPairs.map(([c1, c2], idx) => ({
      id: `cont_${idx}`,
      kind: 'conquer_continents' as const,
      title: `Eixo ${CONTINENTS[c1].name} + ${CONTINENTS[c2].name}`,
      description: `Conquistar na totalidade ${CONTINENTS[c1].name} e ${CONTINENTS[c2].name}.`,
      continents: [c1, c2],
    })),
    {
      id: 'terr_24',
      kind: 'conquer_territories',
      title: 'Expansão Continental',
      description: 'Conquistar e manter pelo menos 24 territórios à sua escolha.',
      territoryCount: 24,
    },
    {
      id: 'terr_18_2',
      kind: 'conquer_territories_with_two',
      title: 'Fortalezas Consolidadas',
      description: 'Conquistar pelo menos 18 territórios com no mínimo 2 exércitos em cada um.',
      territoryCount: 18,
      minTroopsPerTerritory: 2,
    },
  ];

  // Add "Destroy Player" objectives when there are 3+ players
  if (players.length >= 3) {
    for (const target of players) {
      pool.push({
        id: `destroy_${target.id}`,
        kind: 'destroy_player',
        title: `Destruir Exército ${target.colorName}`,
        description: `Eliminar totalmente o exército ${target.colorName} (${target.name}). Se ele já for eliminado por outro jogador, seu objetivo passa a ser conquistar 24 territórios.`,
        targetPlayerId: target.id,
        fallbackTerritoryCount: 24,
      });
    }
  }

  // Shuffle pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const usedIds = new Set<string>();
  for (const player of players) {
    const candidate = pool.find(
      (obj) =>
        !usedIds.has(obj.id) &&
        !(obj.kind === 'destroy_player' && obj.targetPlayerId === player.id)
    );
    if (candidate) {
      usedIds.add(candidate.id);
      player.objective = { ...candidate };
    } else {
      player.objective = {
        id: `fallback_${player.id}`,
        kind: 'conquer_territories',
        title: 'Expansão Estratégica',
        description: 'Conquistar e manter pelo menos 24 territórios no mapa.',
        territoryCount: 24,
      };
    }
  }
}
