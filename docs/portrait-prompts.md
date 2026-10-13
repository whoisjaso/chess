# Portrait prompts (coaches + bots)

Generate these in ChatGPT (or any image model). Paste the **style block first, once**, then one character prompt per image so the whole set matches.
Save each image as a square PNG with the exact filename shown, then put them in `packages/web/public/img/avatars/` (or send them to Claude to install).

These are **original characters**. They borrow each coach's *mind*, not any existing character's look, so they're safe to ship in a public, open-source app.

## Style block (send first)

> I'm making a set of 13 square portrait avatars for a chess app. Keep one consistent style across all of them: modern anime key-visual illustration, 2D cel shading, clean bold line art, rich but not neon colors, head-and-shoulders bust, centered, looking at the viewer, simple soft gradient background in the color I give, no text, no logos, no frame. 1024×1024. These are original characters; don't base them on any existing anime character. Reply "ready" and I'll send them one at a time.

## Coaches

| File | Prompt |
|---|---|
| `kiyo.png` | **Kiyo, the Hidden Student.** A quiet teenage boy with neat dark-brown hair and calm, unreadable half-lidded eyes. He shows no emotion at all, as if he's measuring you. Navy school blazer, crimson tie. Steel-blue background. |
| `lumen.png` | **Lumen, the Planner.** A confident young man with light chestnut hair and sharp amber eyes, wearing a faint, knowing smile, like he's ten moves ahead. White dress shirt, dark slim tie, warm golden rim light. Deep amber background. |
| `karasu.png` | **Karasu, the Crow.** A solemn young man with long black hair tied low and gentle, sorrowful eyes. Dark high-collared travelling cloak, a black crow perched on his shoulder. Deep crimson background with a pale moon. |
| `tenka.png` | **Tenka, the Conqueror.** A commanding warrior-lord in his thirties with a long, wild mane of dark hair and fierce, steady dark eyes. Ornate crimson lacquered armor shoulder plates. Smoky sunset battlefield background. |
| `flint.png` | **Doc Flint, the Scientist.** An excitable teenage genius with messy silver hair and a huge grin, lab goggles pushed up on his forehead, white lab coat, holding a glowing flask. Green laboratory background. |
| `shuji.png` | **Shūji, the Reader.** A playful young man with wavy brown hair and a sly, amused smile, like he already knows your secret. Beige trench coat over a vest, loosened tie. Teal city-at-night background. |
| `namenlos.png` | **Herr Namenlos, the Nameless.** A serene, elegant young man with pale blond hair and light-blue eyes, a gentle smile that feels slightly unsettling. Black high-collared coat. Dark teal fog background. |

## Bots

| File | Prompt |
|---|---|
| `showman.png` | **The Showman.** A flamboyant stage-magician chess player with a black top hat, red tailcoat and a wide theatrical grin. Purple spotlight background. |
| `diplomat.png` | **The Diplomat.** A polite middle-aged gentleman with neat side-parted hair, navy suit and red tie, warm reassuring smile. Soft blue background. |
| `bookworm.png` | **The Bookworm.** A studious young woman with round glasses and an auburn bob, hugging a chess book, green cardigan. Cozy library background. |
| `professor.png` | **The Professor.** A wise old professor with a white beard, round gold glasses, tweed jacket and bow tie, one eyebrow raised. Warm brown study background. |
| `underdog.png` | **The Underdog.** A nervous teenage girl with messy ginger hair in a grey hoodie, a small bandage on her cheek, a hopeful but worried smile. Soft grey background. |
| `warlord.png` | **The Warlord.** A huge barbarian warlord with a horned steel helmet, braided beard and red war paint, mid battle-roar. Fiery red background. |

## Current set

The shipped portraits were generated with [Pollinations.ai](https://pollinations.ai) (free, no account) from the prompts above, then cropped to 384×384. Replace any of them by dropping a new PNG with the same filename into `packages/web/public/img/avatars/`.
