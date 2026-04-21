# Petgle

A Peggle-style browser game built with Phaser 4 and Matter.js physics. Players aim and shoot balls at pegs to progressively reveal a discount code. Designed to be embedded in a Squarespace CDK block for a pet portrait business.

## How to Play

1. **Aim** by moving your mouse or finger
2. **Click/tap** to launch a ball
3. The ball bounces off pegs — hit pegs light up
4. When the ball exits the bottom, lit pegs are destroyed
5. **Orange pegs** reveal discount code characters
6. Reveal the full code to win!

### Peg Types

- **Orange** — Required. Each one reveals a discount code character
- **Blue** — Filler pegs worth bonus points
- **Green** — Triggers multiball (spawns 2 extra balls)
- **Purple** — Bonus points, moves to a new position each shot

### Special Mechanics

- **Free Ball Bucket** — A bucket slides along the bottom. Land your ball in it to get a free ball
- **Combos** — Hit 3+ pegs in one shot for screen shake and bonus text. Hit 5+ for an "AMAZING!" effect

## Configuration

Pass URL query parameters to customize the game:

| Parameter      | Default     | Description                        |
|----------------|-------------|------------------------------------|
| `discountCode` | `GOODBOY10` | The code to reveal                 |
| `balls`        | `10`        | Number of balls the player gets    |
| `theme`        | `warm`      | Colour theme (stretch goal)        |

Example: `https://your-site.github.io/petgle/?discountCode=WOOF20&balls=12`

## postMessage Integration

The game communicates with the parent frame via `window.parent.postMessage`:

| Event         | Payload                                    |
|---------------|--------------------------------------------|
| `GAME_STARTED`| `{ type: 'GAME_STARTED' }`                |
| `PROGRESS`    | `{ type: 'PROGRESS', revealed: 5, total: 9 }` |
| `GAME_WON`    | `{ type: 'GAME_WON', score: 1500 }`       |
| `GAME_OVER`   | `{ type: 'GAME_OVER', score: 800 }`       |

## Deployment

Static files only — no build step required.

1. Push `index.html`, `game.js`, and `README.md` to a GitHub repo
2. Enable GitHub Pages (Settings → Pages → Deploy from branch)
3. Embed in Squarespace CDK block via iframe:

```html
<iframe src="https://your-org.github.io/petgle/?discountCode=GOODBOY10"
        width="900" height="600" frameborder="0"
        allow="autoplay" style="max-width:100%;"></iframe>
```

## Tech Stack

- **Phaser 4.0.0** (CDN) — game framework
- **Matter.js** (bundled with Phaser) — physics engine
- **Web Audio API** — procedural sound effects
- All visuals generated programmatically — zero external assets
