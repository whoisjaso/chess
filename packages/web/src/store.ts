import type { GameMeta, PlyRecord } from '@chessbutfree/core';

/** Games live in this browser only. No account, no server copy of your "considered" squares. */
export interface StoredGame {
  id: string;
  at: number;
  plies: PlyRecord[];
  meta: GameMeta;
  /** Which side was "you" (for the profile); undefined for imported games. */
  you?: 'w' | 'b';
  source: 'bot' | 'online' | 'local' | 'import';
  opponent?: string;
}

const KEY = 'chessbutfree.games.v1';

function safe<T>(f: () => T, fallback: T): T {
  try {
    return f();
  } catch {
    return fallback;
  }
}

export function listGames(): StoredGame[] {
  return safe(() => JSON.parse(localStorage.getItem(KEY) ?? '[]') as StoredGame[], []);
}

export function getGame(id: string): StoredGame | undefined {
  return listGames().find((g) => g.id === id);
}

export function saveGame(g: StoredGame): void {
  const all = listGames().filter((x) => x.id !== g.id);
  all.unshift(g);
  safe(() => localStorage.setItem(KEY, JSON.stringify(all.slice(0, 300))), undefined);
}

export function pref<T>(key: string, fallback: T): T {
  return safe(() => {
    const v = localStorage.getItem(`chessbutfree.${key}`);
    return v === null ? fallback : (JSON.parse(v) as T);
  }, fallback);
}

export function setPref(key: string, v: unknown): void {
  safe(() => localStorage.setItem(`chessbutfree.${key}`, JSON.stringify(v)), undefined);
}

export const newId = () => Math.random().toString(36).slice(2, 10);
