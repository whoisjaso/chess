import { ARCHETYPE_INFO, BOTS, COACHES, LESSONS } from '@mindboard/core';
import { h } from '../dom';
import type { View } from '../main';
import { pref, setPref } from '../store';

export const coachesView: View = (el) => {
  const current = pref('coach', 'kiyo');
  el.append(
    h('h1', 'Coaches'),
    h('p.muted', 'Seven teachers, each modelled on how a fictional genius thinks. Each owns one lens of the psychology. Pick one to voice your Game Reviews, read their lessons, or spar against their style.'),
    h(
      'div.grid',
      { style: 'grid-template-columns:repeat(auto-fill,minmax(320px,1fr))' },
      COACHES.map((c) => {
        const bot = BOTS.find((b) => b.id === c.sparsAs)!;
        return h(
          'div.card',
          { style: c.id === current ? 'border-color:var(--accent)' : '' },
          h('h3', `${c.name} — ${c.title}`),
          h('div.small.muted', `Mind modelled on: ${c.inspiredBy}`),
          h('span.pill', c.embodies === 'identity' ? 'Identity' : ARCHETYPE_INFO[c.embodies].title),
          h('p', c.philosophy),
          h('div.small', 'Teaches: ', c.teaches.map((id, i) => [i ? ', ' : '', h('a', { href: `#/lessons/${id}` }, LESSONS.find((l) => l.id === id)!.title)])),
          h(
            'div.row',
            { style: 'margin-top:10px' },
            h('button.primary', { onclick: () => (setPref('coach', c.id), location.reload()) }, c.id === current ? 'Your review coach ✓' : 'Use for reviews'),
            h('button', { onclick: () => (location.hash = `#/play/bot?bot=${bot.id}&level=4&color=w&tc=none`) }, `Spar (${bot.name})`),
          ),
        );
      }),
    ),
    h('p.small.muted', { style: 'margin-top:16px' }, 'Coach names and lines are original; the characters named above are referenced only as inspiration and belong to their creators.'),
  );
};
