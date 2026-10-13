import type { Classification } from '@mindboard/core';
import { h } from './dom';

export const CLS: Record<Classification, { sym: string; label: string; color: string }> = {
  brilliant: { sym: '!!', label: 'Brilliant', color: 'var(--c-brilliant)' },
  great: { sym: '!', label: 'Great', color: 'var(--c-great)' },
  best: { sym: '★', label: 'Best', color: 'var(--c-best)' },
  excellent: { sym: '✓', label: 'Excellent', color: 'var(--c-excellent)' },
  good: { sym: '·', label: 'Good', color: 'var(--c-good)' },
  book: { sym: '📖', label: 'Book', color: 'var(--c-book)' },
  forced: { sym: '→', label: 'Forced', color: 'var(--c-forced)' },
  inaccuracy: { sym: '?!', label: 'Inaccuracy', color: 'var(--c-inaccuracy)' },
  mistake: { sym: '?', label: 'Mistake', color: 'var(--c-mistake)' },
  miss: { sym: '✗', label: 'Miss', color: 'var(--c-miss)' },
  blunder: { sym: '??', label: 'Blunder', color: 'var(--c-blunder)' },
};

export const badge = (c: Classification) => h('span.badge', { style: `background:${CLS[c].color}`, title: CLS[c].label }, c === 'book' ? 'B' : CLS[c].sym);

/** Move list in two columns. `extra(i)` can decorate each ply (e.g. classification badge). */
export function moveList(sans: string[], current: number, onPick: (ply: number) => void, extra?: (i: number) => Node | null): HTMLElement {
  const el = h('div.moves');
  for (let i = 0; i < sans.length; i += 2) {
    el.append(h('div.n', `${i / 2 + 1}.`));
    for (const j of [i, i + 1]) {
      if (j >= sans.length) el.append(h('div'));
      else el.append(h('div.m', { class: j + 1 === current ? 'cur' : '', onclick: () => onPick(j + 1) }, extra?.(j) ?? null, sans[j]));
    }
  }
  queueMicrotask(() => el.querySelector('.cur')?.scrollIntoView({ block: 'nearest' }));
  return el;
}
