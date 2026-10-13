import { h } from '../dom';
import { listGames } from '../store';
import type { View } from '../main';

const card = (href: string, title: string, body: string) => h('div.card.link', { onclick: () => (location.hash = href) }, h('h3', title), h('p.muted.small', body));

export const homeView: View = (el) => {
  const games = listGames().slice(0, 8);
  el.append(
    h(
      'div.hero',
      h('h1', 'Chess that reads the mind behind the moves.'),
      h(
        'p',
        'Everything a chess platform gives you — play, lessons, openings, game review — free and open source. Plus one thing none of them do: a read on the player, not just the position. Why you played it, what you were reacting to, which mask you were wearing, and whether it held under pressure.',
      ),
      h('div.row', h('button.primary', { onclick: () => (location.hash = '#/play/bot') }, 'Play a bot'), h('button', { onclick: () => (location.hash = '#/play/online') }, 'Play online'), h('button', { onclick: () => (location.hash = '#/review') }, 'Review a game')),
    ),
    h(
      'div.grid',
      card('#/play/bot', 'Six masked bots', 'Showman, Diplomat, Bookworm, Professor, Underdog, Warlord — one per archetype. Learn to read each.'),
      card('#/play/online', 'Live multiplayer', 'Quick pairing, friend links, server clocks, Glicko-2 ratings. No account required.'),
      card('#/review', 'Review + Mind Read', 'Brilliant to blunder, accuracy, plus the frame bar, script breaks, tilt, impulse, and your mask blend.'),
      card('#/lessons', 'Lessons', 'Tactics, mates, openings, endgames — and the Mind track: frame, tilt, time pressure, reading opponents.'),
      card('#/openings', 'Opening explorer', '3,800+ named openings. Learn the script, then learn where it ends.'),
      card('#/coaches', 'Coaches', 'Seven teachers modelled on fiction’s sharpest minds. Each owns one lens of the psychology.'),
    ),
    h('h2', 'Recent games'),
    games.length
      ? h(
          'div.grid',
          games.map((g) =>
            h(
              'div.card.link',
              { onclick: () => (location.hash = `#/review/${g.id}`) },
              h('h3', `${g.meta.white ?? 'White'} vs ${g.meta.black ?? 'Black'}`),
              h('div.muted.small', `${g.meta.result ?? '*'} · ${g.plies.length} plies · ${g.source} · ${new Date(g.at).toLocaleDateString()}`),
            ),
          ),
        )
      : h('p.muted', 'No games yet. Play one, or paste a PGN from Chess.com or Lichess into Review — clock data comes along.'),
  );
};
