import { ARCHETYPE_INFO, ARCHETYPES, PRESCRIPTIONS, type Archetype } from '@chessbutfree/core';
import { avatar, img3d } from '../components';
import { h } from '../dom';
import type { View } from '../main';
import { net } from '../net';
import { listGames, pref } from '../store';
import { storedProfiles } from './review';

/** Your Mind: a stats page for the player, not the board. One game is a snapshot; twenty is a person. */
export const profileView: View = (el) => {
  const entries = Object.values(storedProfiles()).sort((a, b) => a.at - b.at);
  const games = listGames();
  const puzzle = Math.round(pref('puzzleRating', { rating: 800 }).rating);
  const page = h('div.page');
  el.append(page);
  page.append(
    h(
      'div.card',
      { style: 'display:flex;gap:18px;align-items:center;margin-bottom:18px' },
      h('img', { src: avatar(), alt: '', style: 'width:96px;height:96px;border-radius:6px' }),
      h('div', h('h1', { style: 'margin:0;font-size:28px;font-weight:900' }, net.name || 'Guest'), h('div.dim', { style: 'font-weight:700' }, `${games.length} games · ${entries.length} read · puzzle rating ${puzzle}`)),
      h('img', { src: img3d('mind'), alt: '', style: 'width:72px;margin-left:auto' }),
    ),
  );
  if (!entries.length) {
    page.append(h('div.card', h('h3', 'Your mind is still a blank page'), h('p.muted', 'Play a game against a bot or online, then open its Game Review. Every review adds to your profile.'), h('a.btn.green', { href: '#/play/bots' }, 'Play a Bot')));
    return;
  }
  const avg = Object.fromEntries(ARCHETYPES.map((a) => [a, entries.reduce((s, e) => s + e.profile.archetypes[a], 0) / entries.length])) as Record<Archetype, number>;
  const ranked = [...ARCHETYPES].sort((a, b) => avg[b] - avg[a]);
  const ids = entries.map((e) => e.profile.identity).filter((x): x is number => x !== undefined);
  const identity = ids.length ? Math.round(ids.reduce((a, b) => a + b, 0) / ids.length) : undefined;
  const accuracy = entries.reduce((s, e) => s + e.accuracy, 0) / entries.length;
  const initiative = entries.reduce((s, e) => s + e.profile.initiativeShare, 0) / entries.length;
  const impulses = entries.reduce((s, e) => s + e.profile.impulseErrors, 0);
  const tilts = entries.reduce((s, e) => s + e.profile.tiltEvents, 0);
  const tile = (label: string, value: string, sub: string) => h('div.card', h('div.dim', { style: 'font-weight:800;font-size:13px' }, label), h('div.big', value), h('div.dim', { style: 'font-size:12.5px' }, sub));
  page.append(
    h(
      'div.stat-tiles',
      tile('ACCURACY', accuracy.toFixed(1), 'average, reviewed games'),
      tile('IDENTITY', identity === undefined ? '—' : String(identity), 'pressure ÷ calm quality'),
      tile('INITIATIVE', `${Math.round(100 * initiative)}%`, 'of contested moments'),
      tile('IMPULSE', String(impulses), 'fast moves that cost'),
      tile('TILT', String(tilts), 'errors right after errors'),
    ),
    h(
      'div.two-col',
      { style: 'margin-top:18px' },
      h(
        'div.card',
        h('h3', `Your mask: ${ARCHETYPE_INFO[ranked[0]].title} + ${ARCHETYPE_INFO[ranked[1]].title}`),
        ARCHETYPES.map((a) => h('div.arch', h('span', ARCHETYPE_INFO[a].title), h('div.meter', h('div', { style: `width:${Math.round(100 * avg[a])}%` })), h('span.dim', `${Math.round(100 * avg[a])}%`))),
        h('p', { style: 'margin:12px 0 4px' }, ARCHETYPE_INFO[ranked[0]].core, ' ', ARCHETYPE_INFO[ranked[0]].board),
        h('p.muted', { style: 'margin:0' }, h('i', ARCHETYPE_INFO[ranked[0]].inverse)),
      ),
      h(
        'div.card',
        h('h3', 'Ego work'),
        h('p', { style: 'margin:6px 0' }, h('b', 'Name the script: '), PRESCRIPTIONS[ranked[0]].script),
        h('p', { style: 'margin:6px 0' }, h('b', 'The drill: '), PRESCRIPTIONS[ranked[0]].drill),
        h('p.dim', { style: 'font-size:13px' }, 'A script that is named loses its power. Identity is rebuilt through reps nobody watches.'),
        h('a.btn.green.sm', { href: '#/puzzles' }, 'Train your mistakes'),
      ),
    ),
    h(
      'div.card',
      { style: 'margin-top:18px' },
      h('h3', 'Identity over time'),
      entries.map((e) => h('div.arch', h('span.dim', new Date(e.at).toLocaleDateString()), h('div.meter', h('div', { style: `width:${e.profile.identity ?? 0}%` })), h('span', String(e.profile.identity ?? '—')))),
    ),
  );
};
