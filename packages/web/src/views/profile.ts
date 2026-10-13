import { ARCHETYPE_INFO, ARCHETYPES, PRESCRIPTIONS, type Archetype } from '@mindboard/core';
import { h } from '../dom';
import type { View } from '../main';
import { storedProfiles } from './review';

/**
 * "Your mind": the archetype blend across every reviewed game where you were a player.
 * One game is a snapshot; twenty games is a person.
 */
export const profileView: View = (el) => {
  const entries = Object.values(storedProfiles()).sort((a, b) => a.at - b.at);
  el.append(h('h1', 'Your mind'), h('p.muted', 'Built from games you played here and reviewed. Stays in this browser.'));
  if (!entries.length) {
    el.append(h('p', 'Play a game against a bot or online, then open its review. Your profile builds from there.'));
    return;
  }
  const avg = Object.fromEntries(ARCHETYPES.map((a) => [a, entries.reduce((s, e) => s + e.profile.archetypes[a], 0) / entries.length])) as Record<Archetype, number>;
  const ranked = [...ARCHETYPES].sort((a, b) => avg[b] - avg[a]);
  const ids = entries.map((e) => e.profile.identity).filter((x): x is number => x !== undefined);
  const identity = ids.length ? Math.round(ids.reduce((a, b) => a + b, 0) / ids.length) : undefined;
  const accuracy = entries.reduce((s, e) => s + e.accuracy, 0) / entries.length;
  const impulses = entries.reduce((s, e) => s + e.profile.impulseErrors, 0);
  const tilts = entries.reduce((s, e) => s + e.profile.tiltEvents, 0);
  const initiative = entries.reduce((s, e) => s + e.profile.initiativeShare, 0) / entries.length;

  el.append(
    h(
      'div.grid',
      h('div.card', h('h3', 'Games read'), h('h1', String(entries.length))),
      h('div.card', h('h3', 'Average accuracy'), h('h1', accuracy.toFixed(1))),
      h('div.card', h('h3', 'Identity index'), h('h1', identity === undefined ? '—' : String(identity)), h('p.small.muted', 'Quality under pressure ÷ quality when calm.')),
      h('div.card', h('h3', 'Initiative held'), h('h1', `${Math.round(100 * initiative)}%`)),
      h('div.card', h('h3', 'Impulse errors / tilts'), h('h1', `${impulses} / ${tilts}`)),
    ),
    h('h2', `Your mask: ${ARCHETYPE_INFO[ranked[0]].title} + ${ARCHETYPE_INFO[ranked[1]].title}`),
    h(
      'div.card',
      ARCHETYPES.map((a) => h('div.arch', h('span', ARCHETYPE_INFO[a].title), h('div.meter', h('div', { style: `width:${Math.round(100 * avg[a])}%` })), h('span.muted', `${Math.round(100 * avg[a])}%`))),
      h('p', ARCHETYPE_INFO[ranked[0]].core, ' ', ARCHETYPE_INFO[ranked[0]].board),
      h('p.muted', h('i', ARCHETYPE_INFO[ranked[0]].inverse)),
    ),
    h('h2', 'Ego work'),
    h('div.card', h('p', h('b', 'Name the script: '), PRESCRIPTIONS[ranked[0]].script), h('p', h('b', 'The drill: '), PRESCRIPTIONS[ranked[0]].drill), h('p.small.muted', 'A script that is named loses its power. Identity is rebuilt through reps nobody watches.')),
    h('h2', 'Identity over time'),
    h('div.card', entries.map((e) => h('div.arch', h('span.small', new Date(e.at).toLocaleDateString()), h('div.meter', h('div', { style: `width:${e.profile.identity ?? 0}%` })), h('span.muted', e.profile.identity ?? '—')))),
  );
};
