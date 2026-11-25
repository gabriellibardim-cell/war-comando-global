export interface TutorialStep {
  title: string;
  badge: string;
  body: string;
  tips: string[];
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Bem-vindo ao WAR: Comando Global',
    badge: '1 / 7 • Visão Geral',
    body: 'Seu objetivo é cumprir sua Carta de Objetivo Secreto (conquistar continentes, dominar territórios ou eliminar um rival) antes dos demais comandos.',
    tips: [
      'No mapa, arraste com o dedo (ou mouse) para navegar e use pinça ou os botões + / − para dar zoom.',
      'Conquistar todos os territórios de um continente garante reforços bônus em todo início de turno!',
      'Seu progresso é salvo automaticamente no navegador (localStorage).',
    ],
  },
  {
    title: 'Fase 1: Reforços & Defesas',
    badge: '2 / 7 • Reforço',
    body: 'No início do seu turno você recebe reforços iguais a metade dos seus territórios (mínimo 3) + bônus de continentes completos.',
    tips: [
      'Toque em qualquer território seu para distribuir tropas (escolha +1, +5 ou Tudo).',
      'Você também pode gastar reforços para construir defesas no território selecionado:',
      '🏰 Costa Fortificada (2): protege territórios costeiros contra ataques Navais.',
      '📡 Defesa Antiaérea (2): intercepta ataques Aéreos e abate atacantes.',
      '🛡️ Escudo Antimíssil (3): bloqueia 100% do próximo Míssil inimigo (consumido ao interceptar).',
    ],
  },
  {
    title: 'Fase 2: Os 4 Tipos de Ataque',
    badge: '3 / 7 • Combate',
    body: 'Toque em um território seu (origem) e escolha o modo de operação para destacar os alvos válidos no mapa:',
    tips: [
      '⚔️ Terrestre: fronteira direta (mín. 2 tropas na origem).',
      '⚓ Naval: de território costeiro para outro costeiro no mesmo oceano (mín. 3 tropas).',
      '✈️ Aéreo: alcance de até 2 territórios — salta por cima da linha de frente (mín. 3 tropas).',
      '🚀 Míssil: alcance GLOBAL! Custa 2 tropas da base e entra em recarga de 3 turnos; causa 2–4 baixas sem arriscar conquista direta (bloqueado por Escudo Antimíssil).',
    ],
  },
  {
    title: 'Combate Tático vs Dados Clássicos',
    badge: '4 / 7 • Resolução',
    body: 'Antes de confirmar qualquer ataque, você vê a prévia com chance de vitória, defesas ativas e baixas esperadas.',
    tips: [
      'Modo Tático Híbrido (padrão): calcula o poder real considerando superioridade numérica, defesas e eventos.',
      'Modo Dados Clássicos: rola até 3 dados para o atacante e 2 para o defensor (maior contra maior; empate vence a defesa).',
      'Ao zerar as tropas inimigas, você conquista o território e escolhe quantas tropas avançam para ocupá-lo!',
    ],
  },
  {
    title: 'Cartas de Troca & Objetivos',
    badge: '5 / 7 • Estratégia',
    body: 'Conquistar ao menos 1 território no turno garante 1 Carta de Território ao final da sua jogada.',
    tips: [
      'Troque 3 cartas com símbolos iguais (▲▲▲) ou 3 diferentes (▲■●) na fase de Reforço — Curingas (★) substituem qualquer símbolo!',
      'O valor das trocas sobe progressivamente: +4, +6, +8, +10, +12, +15, +20...',
      'Se você possuir o território de uma carta trocada, ganha +2 tropas extras diretamente nele!',
      'Ao acumular 5 cartas, a troca é obrigatória no início do turno.',
    ],
  },
  {
    title: 'Diplomacia & Eventos Aleatórios',
    badge: '6 / 7 • Novidades',
    body: 'Use alianças temporárias para proteger uma fronteira enquanto concentra forças em outra.',
    tips: [
      '🤝 Pacto de Não Agressão: dura 3 rodadas e impede ataques mútuos. IAs avaliam sua força e reputação antes de aceitar.',
      'Você pode quebrar um pacto a qualquer momento, mas ganha fama de traidor (IAs recusarão novos acordos).',
      '⛈️ Eventos Aleatórios (opcional): Tempestades, Boas Colheitas, Revoltas e Avanços Tecnológicos alteram táticas a cada rodada.',
    ],
  },
  {
    title: 'Fase 3: Fortificação (Remanejamento)',
    badge: '7 / 7 • Encerrando o Turno',
    body: 'Ao terminar seus ataques, passe para a fase de Fortificação para reposicionar tropas da retaguarda para a fronteira.',
    tips: [
      'Você pode fazer 1 movimento gratuito por turno entre quaisquer dois territórios seus ligados por uma rota controlada por você.',
      'Sempre mantenha pelo menos 1 tropa no território de origem.',
      'Tudo pronto! Você pode reabrir este tutorial quando quiser pelo botão ❓ no topo.',
    ],
  },
];

export function renderTutorialModal(
  stepIndex: number,
  onStepChange: (nextIndex: number) => void,
  onClose: () => void
): HTMLElement {
  const step = TUTORIAL_STEPS[stepIndex] ?? TUTORIAL_STEPS[0];
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';

  const card = document.createElement('div');
  card.className = 'modal-card tutorial-modal';

  const tipsHtml = step.tips.map((t) => `<li>${t}</li>`).join('');
  const dotsHtml = TUTORIAL_STEPS.map(
    (_, idx) =>
      `<button class="tutorial-dot ${idx === stepIndex ? 'active' : ''}" data-step="${idx}" aria-label="Passo ${idx + 1}"></button>`
  ).join('');

  card.innerHTML = `
    <div class="modal-header">
      <div>
        <span class="pill-badge">${step.badge}</span>
        <h2>${step.title}</h2>
      </div>
      <button class="icon-btn" data-action="close" aria-label="Fechar">✕</button>
    </div>
    <div class="modal-body">
      <p class="tutorial-lead">${step.body}</p>
      <ul class="tutorial-tips">${tipsHtml}</ul>
    </div>
    <div class="tutorial-dots">${dotsHtml}</div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-action="prev" ${stepIndex === 0 ? 'disabled' : ''}>← Anterior</button>
      ${
        stepIndex < TUTORIAL_STEPS.length - 1
          ? `<button class="btn btn-primary" data-action="next">Próximo →</button>`
          : `<button class="btn btn-success" data-action="close">Entendi, vamos jogar!</button>`
      }
    </div>
  `;

  card.querySelectorAll('[data-action="close"]').forEach((btn) =>
    btn.addEventListener('click', onClose)
  );
  card.querySelector('[data-action="prev"]')?.addEventListener('click', () => {
    if (stepIndex > 0) onStepChange(stepIndex - 1);
  });
  card.querySelector('[data-action="next"]')?.addEventListener('click', () => {
    if (stepIndex < TUTORIAL_STEPS.length - 1) onStepChange(stepIndex + 1);
  });
  card.querySelectorAll('.tutorial-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      const idx = Number((dot as HTMLElement).dataset.step);
      onStepChange(idx);
    });
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) onClose();
  });

  overlay.appendChild(card);
  return overlay;
}
