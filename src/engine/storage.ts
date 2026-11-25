import type { GameState } from '../types.ts';
import { STATE_VERSION } from './gameEngine.ts';

const STORAGE_KEY = 'war_global_command_save_v1';

export interface SaveSummary {
  savedAt: string;
  round: number;
  playerCount: number;
  currentPlayerName: string;
  theme: string;
}

interface StoredPayload {
  savedAt: string;
  state: GameState;
}

export function saveGame(state: GameState): void {
  try {
    const payload: StoredPayload = {
      savedAt: new Date().toISOString(),
      state,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota/private mode errors gracefully
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPayload;
    if (!parsed?.state || parsed.state.version !== STATE_VERSION) return null;
    return parsed.state;
  } catch {
    return null;
  }
}

export function getSaveSummary(): SaveSummary | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPayload;
    if (!parsed?.state || parsed.state.version !== STATE_VERSION) return null;
    const s = parsed.state;
    const curr = s.players[s.currentPlayerIndex];
    return {
      savedAt: parsed.savedAt,
      round: s.round,
      playerCount: s.players.length,
      currentPlayerName: curr?.name ?? '-',
      theme: s.config.theme,
    };
  } catch {
    return null;
  }
}

export function clearSavedGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
