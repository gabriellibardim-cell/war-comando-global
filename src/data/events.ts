import type { ContinentId, RandomEvent } from '../types.ts';
import { CONTINENTS } from './mapData.ts';

const CONTINENT_IDS = Object.keys(CONTINENTS) as ContinentId[];

export function rollRandomEvent(): RandomEvent {
  const randomContinent =
    CONTINENT_IDS[Math.floor(Math.random() * CONTINENT_IDS.length)];
  const continentName = CONTINENTS[randomContinent].name;

  const pool: RandomEvent[] = [
    {
      id: 'storm_sea_air',
      title: 'Tempestade Oceânica',
      icon: '⛈️',
      description: 'Ciclones severos atravessam os oceanos e dificultam operações marítimas e aéreas.',
      mechanicalSummary: 'Ataques Navais e Aéreos têm -20% de força (ou -1 no maior dado) nesta rodada.',
    },
    {
      id: 'good_harvest',
      title: 'Boa Colheita',
      icon: '🌾',
      description: 'Safras abundantes aumentam a capacidade logística de todos os comandos.',
      mechanicalSummary: 'Todos os jogadores recebem +2 reforços extras no início de seus turnos nesta rodada.',
    },
    {
      id: 'popular_revolt',
      title: `Revolta em ${continentName}`,
      icon: '🔥',
      description: `Agitações internas em ${continentName} drenam guarnições sobrecarregadas.`,
      mechanicalSummary: `Territórios com 3 ou mais tropas em ${continentName} perdem 1 tropa imediatamente.`,
      affectedContinent: randomContinent,
    },
    {
      id: 'tech_breakthrough',
      title: 'Avanço Tecnológico',
      icon: '⚙️',
      description: 'Engenheiros militares aceleram fábricas de defesa e plataformas de lançamento.',
      mechanicalSummary: 'Recarga de Mísseis reduzida em 1 turno para todos e defesas custam 1 reforço a menos nesta rodada (mín. 1).',
    },
    {
      id: 'dense_fog',
      title: 'Nevoeiro Estratégico',
      icon: '🌫️',
      description: 'Baixa visibilidade favorece guarnições entrincheiradas em todo o globo.',
      mechanicalSummary: 'Defensores recebem +15% de bônus tático (ou +1 de defesa) em combates nesta rodada.',
    },
    {
      id: 'allied_supply',
      title: 'Comboio Humanitário e Logístico',
      icon: '📦',
      description: 'Rotas emergenciais reabastecem a nação com menor território no mapa.',
      mechanicalSummary: 'O jogador ativo com menos territórios recebe +3 tropas em seu território mais vulnerável.',
    },
    {
      id: 'cold_front',
      title: `Inverno Rigoroso em ${continentName}`,
      icon: '❄️',
      description: `Frentes frias severas em ${continentName} retardam avanços terrestres.`,
      mechanicalSummary: `Ataques Terrestres entrando em ${continentName} sofrem -20% de força nesta rodada.`,
      affectedContinent: randomContinent,
    },
    {
      id: 'armistice_tension',
      title: 'Tensão Diplomática',
      icon: '🕊️',
      description: 'Cúpula internacional incentiva acordos temporários e reforça tropas de fronteira.',
      mechanicalSummary: 'Jogadores com ao menos 1 Pacto ativo ganham +2 reforços extras nesta rodada.',
    },
  ];

  return pool[Math.floor(Math.random() * pool.length)];
}
