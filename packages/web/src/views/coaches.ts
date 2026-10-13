import { ARCHETYPE_INFO, BOTS, COACHES, LESSONS } from '@chessbutfree/core';
import { avatar, img3d } from '../components';
import { h } from '../dom';
import type { View } from '../main';
import { pref, setPref } from '../store';

export const coachesView: View = (el) => {
  const current = pref('coach', 'kiyo');
  el.append(
    h(
      'div.page',
      h('div.page-head', h('img', { src: img3d('coaches'), alt: '' }), h('h1', 'Coaches')),
      h('p.muted', { style: 'margin:-10px 0 22px;font-size:16px;font-weight:600' }, 'Seven teachers modelled on how fiction’s sharpest minds think. Each owns one lens of the psychology. Your coach voices every Game Review.'),
      h(
        'div',
        { style: 'display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(470px,1fr))' },
        COACHES.map((c) => {
          const bot = BOTS.find((b) => b.id === c.sparsAs)!;
          return h(
            'div.card.coach-card',
            { style: c.id === current ? 'outline:2px solid var(--green)' : '' },
            h('img', { src: avatar(c.id), alt: c.name }),
            h(
              'div',
              h('h3', `${c.name}`, h('span.dim', { style: 'font-weight:700;font-size:15px' }, ` · ${c.title}`)),
              h('div.insp', `Mind modelled on ${c.inspiredBy}`),
              h('div', { style: 'margin:8px 0' }, h('span.pill', c.embodies === 'identity' ? 'Identity' : ARCHETYPE_INFO[c.embodies].title)),
              h('p.muted', { style: 'margin:0 0 8px;font-size:14px' }, c.philosophy),
              h('div.dim', { style: 'font-size:13px;font-weight:700' }, 'Teaches: ', c.teaches.map((id, i) => [i ? ', ' : '', h('a', { href: `#/lessons/${id}`, style: 'color:var(--green-hi)' }, LESSONS.find((l) => l.id === id)!.title)])),
              h(
                'div',
                { style: 'display:flex;gap:8px;margin-top:12px' },
                h('button.btn.sm', { class: c.id === current ? 'green' : '', onclick: () => (setPref('coach', c.id), location.reload()) }, c.id === current ? '✓ Your Coach' : 'Select'),
                h('a.btn.sm', { href: `#/play/bots?bot=${c.id}` }, `Spar (${bot.name} style)`),
              ),
            ),
          );
        }),
      ),
      h('p.dim', { style: 'margin-top:20px;font-size:12px' }, 'Coach names, artwork and lines are original. The characters named as inspiration belong to their creators.'),
    ),
  );
};
