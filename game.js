// ---------------------------------------------------------------------------
//  Petgle — A Peggle-style browser game built with Phaser 4 + Matter.js
// ---------------------------------------------------------------------------

const COLORS = {
    bg:        0x1a1a2e,
    orange:    0xFF6B35,
    blue:      0x4ECDC4,
    green:     0x7BC950,
    purple:    0x9B59B6,
    ball:      0xFFFFFF,
    text:      0xF7F0E0,
    gold:      0xFFD700,
    bgLight:   0x22223a,
};

const PEG_RADIUS  = 12;
const BALL_RADIUS = 10;

// ---------------------------------------------------------------------------
//  Procedural Sound
// ---------------------------------------------------------------------------

class SoundBank {
    constructor () {
        this.muted = false;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (_) {
            this.ctx = null;
        }
    }

    resume () {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    _play (freq, type, duration, vol = 0.15) {
        if (this.muted || !this.ctx) return;
        const osc  = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    pegHit (type) {
        const freqs = { orange: 880, blue: 660, green: 1100, purple: 990 };
        this._play(freqs[type] || 660, 'sine', 0.08, 0.10);
    }

    launch ()  { this._play(220, 'triangle', 0.15, 0.08); }

    reveal (index) {
        this._play(440 + index * 80, 'sine', 0.25, 0.12);
    }

    winJingle () {
        if (this.muted || !this.ctx) return;
        const t = this.ctx.currentTime;

        const playNote = (freq, start, dur, type, vol) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(vol, t + start);
            gain.gain.setValueAtTime(vol, t + start + dur * 0.7);
            gain.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
            osc.connect(gain).connect(this.ctx.destination);
            osc.start(t + start);
            osc.stop(t + start + dur);
        };

        // Fanfare melody (C major triumphant)
        const melody = [
            [523, 0.00, 0.15],  // C5
            [523, 0.15, 0.15],  // C5
            [523, 0.30, 0.15],  // C5
            [659, 0.45, 0.30],  // E5
            [587, 0.80, 0.15],  // D5
            [659, 0.95, 0.15],  // E5
            [784, 1.10, 0.50],  // G5
            [659, 1.65, 0.15],  // E5
            [784, 1.80, 0.20],  // G5
            [1047, 2.00, 0.70], // C6 (big finish)
        ];

        melody.forEach(([f, s, d]) => playNote(f, s, d, 'sine', 0.13));

        // Harmony layer (thirds below, softer)
        const harmony = [
            [392, 0.45, 0.30],  // G4
            [494, 1.10, 0.50],  // B4
            [523, 1.80, 0.20],  // C5
            [784, 2.00, 0.70],  // G5
        ];

        harmony.forEach(([f, s, d]) => playNote(f, s, d, 'triangle', 0.07));

        // Bass hits
        const bass = [
            [262, 0.00, 0.30],  // C4
            [262, 0.45, 0.30],  // C4
            [196, 1.10, 0.50],  // G3
            [262, 2.00, 0.80],  // C4
        ];

        bass.forEach(([f, s, d]) => playNote(f, s, d, 'triangle', 0.06));
    }

    freeBall () { this._play(1200, 'square', 0.12, 0.08); }

    toggle () {
        this.muted = !this.muted;
        return this.muted;
    }
}

const soundBank = new SoundBank();

// ---------------------------------------------------------------------------
//  Peg Layout Engine
// ---------------------------------------------------------------------------

const DIFFICULTY = {
    easy:   { spacing: 52, balls: 15, label: 'Easy' },
    medium: { spacing: 42, balls: 10, label: 'Medium' },
    hard:   { spacing: 34, balls: 7,  label: 'Hard' },
};

const PegLayout = {

    generate (width, height, codeLength, spacing) {
        spacing = spacing || 42;
        const pegs = [];
        const minX = 140, maxX = width - 140;
        const minY = 140, maxY = height - 120;

        const cols = Math.floor((maxX - minX) / spacing);
        const rows = Math.floor((maxY - minY) / spacing);

        for (let r = 0; r < rows; r++) {
            const offset = (r % 2 === 0) ? 0 : spacing / 2;
            for (let c = 0; c < cols; c++) {
                const x = minX + c * spacing + offset;
                const y = minY + r * spacing;
                if (x > maxX) continue;
                pegs.push({ x, y, type: 'blue' });
            }
        }

        // Shuffle & assign orange pegs matching code length
        this._shuffle(pegs);
        const orangeCount = Math.min(codeLength, pegs.length);
        for (let i = 0; i < orangeCount; i++) pegs[i].type = 'orange';

        // Assign green (2) and purple (1) from remaining blue pegs
        let blueIndices = [];
        for (let i = 0; i < pegs.length; i++) {
            if (pegs[i].type === 'blue') blueIndices.push(i);
        }
        this._shuffle(blueIndices);
        if (blueIndices.length > 0) pegs[blueIndices.pop()].type = 'green';
        if (blueIndices.length > 0) pegs[blueIndices.pop()].type = 'green';
        if (blueIndices.length > 0) pegs[blueIndices.pop()].type = 'purple';

        return pegs;
    },

    _shuffle (arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
};

// ---------------------------------------------------------------------------
//  BootScene — generate all textures
// ---------------------------------------------------------------------------

class BootScene extends Phaser.Scene {
    constructor () { super({ key: 'Boot' }); }

    create () {
        this._makeFishPegTexture();
        this._makePegTexture('peg-blue',   COLORS.blue);
        this._makePegTexture('peg-green',  COLORS.green);
        this._makePegTexture('peg-purple', COLORS.purple);
        this._makeBallTexture();
        this._makeParticleTexture();
        this._makeGlowTexture();
        this._makeCatBucketTextures();
        this._makePawTexture();
        this._makeMouseIconTexture();

        this.scene.start('Title');
    }

    _g () { return this.make.graphics({ x: 0, y: 0, add: false }); }

    _makePegTexture (key, color) {
        const g = this._g();
        const r = PEG_RADIUS;
        const s = r * 2 + 4;
        const cx = s / 2, cy = s / 2;
        const light = Phaser.Display.Color.IntegerToColor(color).lighten(50).color;
        const dark  = Phaser.Display.Color.IntegerToColor(color).darken(20).color;
        // shadow layer
        g.fillStyle(dark, 0.25);
        g.fillCircle(cx + 1, cy + 1, r);
        // base
        g.fillStyle(color, 1);
        g.fillCircle(cx, cy, r);
        // highlight band (upper)
        g.fillStyle(light, 0.5);
        g.fillCircle(cx - 2, cy - 2, r * 0.7);
        // gloss dot
        g.fillStyle(0xFFFFFF, 0.7);
        g.fillCircle(cx - 3, cy - 4, r * 0.3);
        g.generateTexture(key, s, s);
        g.destroy();
    }

    _makeFishPegTexture () {
        const g = this._g();
        const w = 30, h = 28;
        const cx = 15, cy = 14;
        const baseColor = COLORS.orange;
        const light = Phaser.Display.Color.IntegerToColor(baseColor).lighten(40).color;
        const dark  = Phaser.Display.Color.IntegerToColor(baseColor).darken(20).color;

        // Tail fin
        g.fillStyle(dark, 0.9);
        g.fillTriangle(2, cy, 0, cy - 8, 0, cy + 8);

        // Body (overlapping circles for oval)
        g.fillStyle(baseColor, 1);
        g.fillCircle(cx, cy, 10);
        g.fillCircle(cx - 3, cy, 10);
        g.fillCircle(cx + 4, cy, 8);
        // Belly highlight
        g.fillStyle(light, 0.5);
        g.fillCircle(cx, cy + 1, 6);
        // Upper sheen
        g.fillStyle(0xFFFFFF, 0.3);
        g.fillCircle(cx - 1, cy - 4, 5);

        // Dorsal fin
        g.fillStyle(dark, 0.8);
        g.fillTriangle(cx - 2, cy - 9, cx + 4, cy - 11, cx + 3, cy - 6);

        // Eye
        g.fillStyle(0xFFFFFF, 1);
        g.fillCircle(cx + 8, cy - 2, 3);
        g.fillStyle(0x111111, 1);
        g.fillCircle(cx + 8.5, cy - 2, 1.5);
        g.fillStyle(0xFFFFFF, 0.9);
        g.fillCircle(cx + 9.5, cy - 3, 0.8);

        // Mouth
        g.lineStyle(1, dark, 0.6);
        g.beginPath();
        g.moveTo(cx + 12, cy);
        g.lineTo(cx + 10, cy + 1);
        g.strokePath();

        // Scales shimmer
        g.fillStyle(light, 0.25);
        g.fillCircle(cx - 4, cy - 1, 2);
        g.fillCircle(cx, cy - 2, 2);
        g.fillCircle(cx - 2, cy + 2, 2);

        // Gloss
        g.fillStyle(0xFFFFFF, 0.5);
        g.fillCircle(cx + 2, cy - 5, 2);

        g.generateTexture('peg-orange', w, h);
        g.destroy();
    }

    _makeBallTexture () {
        // Toy mouse: oval body, round ears, tail, eyes
        const w = 28, h = 20;
        const g = this._g();
        const cx = 14, cy = 10;

        // Tail (curves off the back)
        g.lineStyle(1.5, 0xDDA0A0, 0.7);
        g.beginPath();
        g.moveTo(3, cy);
        g.lineTo(0, cy - 4);
        g.strokePath();

        // Body (oval)
        g.fillStyle(0x999999, 1);
        g.fillCircle(cx, cy, 8);
        g.fillCircle(cx - 2, cy, 8);
        g.fillCircle(cx + 3, cy, 6);
        // lighter belly
        g.fillStyle(0xBBBBBB, 0.6);
        g.fillCircle(cx, cy + 1, 5);
        // highlight
        g.fillStyle(0xDDDDDD, 0.5);
        g.fillCircle(cx - 1, cy - 3, 4);

        // Ears
        g.fillStyle(0xCC8888, 0.9);
        g.fillCircle(cx + 8, cy - 5, 3);
        g.fillCircle(cx + 5, cy - 6, 3);
        // Inner ears
        g.fillStyle(0xEEAAAA, 0.6);
        g.fillCircle(cx + 8, cy - 5, 1.5);
        g.fillCircle(cx + 5, cy - 6, 1.5);

        // Eyes
        g.fillStyle(0x111111, 1);
        g.fillCircle(cx + 7, cy - 2, 1.2);

        // Nose
        g.fillStyle(0xFF8888, 1);
        g.fillCircle(cx + 10, cy, 1);

        // Whiskers
        g.lineStyle(0.8, 0xCCCCCC, 0.4);
        g.beginPath();
        g.moveTo(cx + 9, cy); g.lineTo(cx + 14, cy - 2);
        g.moveTo(cx + 9, cy + 1); g.lineTo(cx + 14, cy + 2);
        g.strokePath();

        g.generateTexture('ball', w, h);
        g.destroy();
    }

    _makeParticleTexture () {
        const g = this._g();
        g.fillStyle(0xFFFFFF, 0.8);
        g.fillCircle(6, 6, 6);
        g.fillStyle(0xFFFFFF, 0.4);
        g.fillCircle(6, 6, 4);
        g.fillStyle(0xFFFFFF, 1);
        g.fillCircle(6, 6, 2);
        g.generateTexture('particle', 12, 12);
        g.destroy();
    }

    _makeGlowTexture () {
        const s = 64;
        const g = this._g();
        for (let i = 16; i > 0; i--) {
            g.fillStyle(0xFFFFFF, 0.015 + (1 - i / 16) * 0.04);
            g.fillCircle(s / 2, s / 2, (i / 16) * s / 2);
        }
        g.generateTexture('glow', s, s);
        g.destroy();
    }

    _makeCatBucketTextures () {
        const black = 0x222222;
        const darkGrey = 0x444444;
        const white = 0xF0F0F0;
        const pink = 0xF28B82;
        const green = 0x4CAF50;
        const greenDark = 0x2E7D32;

        // Helper to draw a cat face on a graphics object
        const drawCatFace = (h, cx, eyeState) => {
            // Ears
            h.fillStyle(black, 1);
            h.fillTriangle(cx - 24, 14, cx - 14, 0, cx - 8, 14);
            h.fillTriangle(cx + 24, 14, cx + 14, 0, cx + 8, 14);
            h.fillStyle(pink, 0.4);
            h.fillTriangle(cx - 21, 14, cx - 14, 4, cx - 10, 14);
            h.fillTriangle(cx + 21, 14, cx + 14, 4, cx + 10, 14);

            // Head
            h.fillStyle(black, 1);
            h.fillCircle(cx, 28, 20);
            h.fillCircle(cx, 30, 18);
            // Tuxedo white chin
            h.fillStyle(white, 0.6);
            h.fillCircle(cx, 38, 8);
            // Subtle fur shading
            h.fillStyle(darkGrey, 0.2);
            h.fillCircle(cx, 24, 14);

            if (eyeState === 'normal') {
                // Normal eyes
                for (const side of [-1, 1]) {
                    const ex = cx + side * 9;
                    h.fillStyle(0xFFFFFF, 1);
                    h.fillCircle(ex, 26, 5);
                    h.fillStyle(green, 1);
                    h.fillCircle(ex, 27, 4);
                    h.fillStyle(greenDark, 1);
                    h.fillCircle(ex, 27, 3);
                    h.fillStyle(0x111111, 1);
                    h.fillCircle(ex, 26, 1.5);
                    h.fillCircle(ex, 28, 1.5);
                    h.fillStyle(0xFFFFFF, 0.9);
                    h.fillCircle(ex + 1.5, 25, 1);
                }
            } else {
                // Happy squinty eyes (^ ^)
                h.lineStyle(2.5, 0x111111, 1);
                for (const side of [-1, 1]) {
                    const ex = cx + side * 9;
                    h.beginPath();
                    h.moveTo(ex - 4, 28);
                    h.lineTo(ex, 24);
                    h.lineTo(ex + 4, 28);
                    h.strokePath();
                }
            }

            // Nose
            h.fillStyle(pink, 1);
            h.fillTriangle(cx - 2, 34, cx + 2, 34, cx, 36);

            // Mouth
            h.lineStyle(1, 0x666666, 0.6);
            h.beginPath();
            h.moveTo(cx, 36); h.lineTo(cx - 4, 39);
            h.moveTo(cx, 36); h.lineTo(cx + 4, 39);
            h.strokePath();

            // Whiskers
            h.lineStyle(1, 0x888888, 0.4);
            for (const side of [-1, 1]) {
                for (let i = -1; i <= 1; i++) {
                    h.beginPath();
                    h.moveTo(cx + side * 8, 35 + i * 2);
                    h.lineTo(cx + side * 26, 33 + i * 3);
                    h.strokePath();
                }
            }
        };

        // Normal cat head
        const h1 = this._g();
        drawCatFace(h1, 30, 'normal');
        h1.generateTexture('cat-bucket', 60, 48);
        h1.destroy();

        // Happy cat head (when catching a mouse)
        const h2 = this._g();
        drawCatFace(h2, 30, 'happy');
        h2.generateTexture('cat-bucket-happy', 60, 48);
        h2.destroy();
    }

    _makePawTexture () {
        // Horizontal tuxedo paw — arm extends right, paw at right end
        // 70x32 so it sits naturally on the left edge
        const p = this._g();
        const black = 0x222222;
        const darkGrey = 0x333333;
        const white = 0xF0F0F0;
        const pink = 0xF28B82;

        // Arm — horizontal, black fur
        p.fillStyle(black, 1);
        p.fillRoundedRect(0, 6, 52, 20, 8);
        p.fillStyle(darkGrey, 0.4);
        p.fillRoundedRect(2, 9, 46, 14, 5);
        // White tuxedo underside stripe
        p.fillStyle(white, 0.6);
        p.fillRoundedRect(20, 14, 28, 10, 4);

        // Paw — white circle at right end
        p.fillStyle(white, 0.9);
        p.fillCircle(56, 16, 14);

        // Central pad
        p.fillStyle(pink, 0.95);
        p.fillCircle(56, 16, 6);

        // Toe beans
        p.fillStyle(pink, 0.9);
        p.fillCircle(64, 9, 3.5);
        p.fillCircle(66, 16, 3.5);
        p.fillCircle(64, 23, 3.5);
        p.fillCircle(62, 12, 2.8);
        p.fillCircle(62, 20, 2.8);

        // Shine on main pad
        p.fillStyle(0xFFFFFF, 0.35);
        p.fillCircle(54, 14, 2.5);

        // Claw hints
        p.fillStyle(0xCCCCCC, 0.4);
        p.fillCircle(67, 8, 1.5);
        p.fillCircle(69, 16, 1.5);
        p.fillCircle(67, 24, 1.5);

        p.generateTexture('cat-paw', 70, 32);
        p.destroy();
    }

    _makeMouseIconTexture () {
        // Small mouse icon for HUD — 18x14
        const g = this._g();
        // Tail
        g.lineStyle(1, 0xDDA0A0, 0.6);
        g.beginPath();
        g.moveTo(2, 7); g.lineTo(0, 4);
        g.strokePath();
        // Body
        g.fillStyle(0x999999, 1);
        g.fillCircle(9, 7, 5);
        g.fillCircle(7, 7, 5);
        // Belly
        g.fillStyle(0xBBBBBB, 0.5);
        g.fillCircle(8, 8, 3);
        // Ears
        g.fillStyle(0xCC8888, 0.9);
        g.fillCircle(13, 3, 2.5);
        g.fillCircle(11, 2, 2.5);
        // Eye
        g.fillStyle(0x111111, 1);
        g.fillCircle(13, 5, 1);
        // Nose
        g.fillStyle(0xFF8888, 1);
        g.fillCircle(15, 7, 0.8);

        g.generateTexture('mouse-icon', 18, 14);
        g.destroy();
    }
}

// ---------------------------------------------------------------------------
//  TitleScene
// ---------------------------------------------------------------------------

class TitleScene extends Phaser.Scene {
    constructor () { super({ key: 'Title' }); }

    create () {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        // background paw prints
        this._spawnPawPrints();

        const title = this.add.text(cx, cy - 80, 'PETGLE', {
            fontFamily: 'Arial Black, Impact, sans-serif',
            fontSize: '72px',
            color: '#FFD700',
            stroke: '#FF6B35',
            strokeThickness: 6,
        }).setOrigin(0.5);

        this.tweens.add({
            targets: title,
            scaleX: 1.05,
            scaleY: 1.05,
            yoyo: true,
            repeat: -1,
            duration: 1200,
            ease: 'Sine.easeInOut',
        });

        this.add.text(cx, cy, 'Aim & shoot to reveal your reward!', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            color: '#F7F0E0',
        }).setOrigin(0.5);

        const buttonColors = { easy: '#4ECDC4', medium: '#FFD700', hard: '#FF6B35' };
        const keys = ['easy', 'medium', 'hard'];
        const btnWidth = 160;
        const totalWidth = keys.length * btnWidth + (keys.length - 1) * 20;
        const startX = cx - totalWidth / 2 + btnWidth / 2;

        keys.forEach((key, i) => {
            const diff = DIFFICULTY[key];
            const bx = startX + i * (btnWidth + 20);
            const by = cy + 70;

            const bg = this.add.graphics();
            bg.fillStyle(Phaser.Display.Color.HexStringToColor(buttonColors[key]).color, 0.2);
            bg.fillRoundedRect(bx - btnWidth / 2, by - 22, btnWidth, 44, 10);
            bg.lineStyle(2, Phaser.Display.Color.HexStringToColor(buttonColors[key]).color, 0.6);
            bg.strokeRoundedRect(bx - btnWidth / 2, by - 22, btnWidth, 44, 10);

            const label = this.add.text(bx, by, diff.label, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '24px',
                color: buttonColors[key],
            }).setOrigin(0.5);

            const hitArea = this.add.rectangle(bx, by, btnWidth, 44).setInteractive({ useHandCursor: true }).setAlpha(0.001);

            hitArea.on('pointerover', () => {
                bg.clear();
                bg.fillStyle(Phaser.Display.Color.HexStringToColor(buttonColors[key]).color, 0.35);
                bg.fillRoundedRect(bx - btnWidth / 2, by - 22, btnWidth, 44, 10);
                bg.lineStyle(2, Phaser.Display.Color.HexStringToColor(buttonColors[key]).color, 0.9);
                bg.strokeRoundedRect(bx - btnWidth / 2, by - 22, btnWidth, 44, 10);
                label.setScale(1.05);
            });

            hitArea.on('pointerout', () => {
                bg.clear();
                bg.fillStyle(Phaser.Display.Color.HexStringToColor(buttonColors[key]).color, 0.2);
                bg.fillRoundedRect(bx - btnWidth / 2, by - 22, btnWidth, 44, 10);
                bg.lineStyle(2, Phaser.Display.Color.HexStringToColor(buttonColors[key]).color, 0.6);
                bg.strokeRoundedRect(bx - btnWidth / 2, by - 22, btnWidth, 44, 10);
                label.setScale(1);
            });

            hitArea.on('pointerdown', () => {
                soundBank.resume();
                window.GAME_CONFIG.difficulty = key;
                window.parent.postMessage({ type: 'GAME_STARTED', difficulty: key }, '*');
                this.scene.start('Game');
            });
        });
    }

    _spawnPawPrints () {
        for (let i = 0; i < 12; i++) {
            const x = Phaser.Math.Between(50, this.scale.width - 50);
            const y = Phaser.Math.Between(50, this.scale.height - 50);
            const t = this.add.text(x, y, '🐾', { fontSize: '28px' }).setAlpha(0.06);
            this.tweens.add({
                targets: t,
                y: y - 120,
                alpha: 0,
                duration: Phaser.Math.Between(6000, 12000),
                repeat: -1,
                delay: Phaser.Math.Between(0, 4000),
                onRepeat: () => {
                    t.x = Phaser.Math.Between(50, this.scale.width - 50);
                    t.y = Phaser.Math.Between(this.scale.height * 0.5, this.scale.height);
                    t.setAlpha(0.06);
                },
            });
        }
    }
}

// ---------------------------------------------------------------------------
//  GameScene — the main gameplay
// ---------------------------------------------------------------------------

class GameScene extends Phaser.Scene {
    constructor () { super({ key: 'Game' }); }

    create () {
        const cfg = window.GAME_CONFIG;
        const diff = DIFFICULTY[cfg.difficulty || 'medium'];
        this.discountCode  = cfg.discountCode;
        this.ballsLeft     = diff.balls;
        this.difficulty    = diff;
        this.score         = 0;
        this.revealedCount = 0;
        this.activeBalls   = [];
        this.pegs          = [];
        this.pegSprites    = [];
        this.canShoot      = true;
        this.resolving     = false;
        this.turnPegsHit   = 0;

        const W = this.scale.width;
        const H = this.scale.height;

        // Left, right, and top walls — no bottom so balls fall off screen
        this.matter.world.setBounds(0, 0, W, H, 32, true, true, true, false);

        // Make wall bodies perfectly bouncy so reflections match the guide line
        const walls = this.matter.world.walls;
        if (walls) {
            for (const key of ['left', 'right', 'top']) {
                if (walls[key]) walls[key].restitution = 1;
            }
        }

        // Collision categories
        this.catPegs  = this.matter.world.nextCategory();
        this.catBalls = this.matter.world.nextCategory();
        this.catBucket = this.matter.world.nextCategory();

        this._createBackground();
        this._createPegs();
        this._createLauncher();
        this._createBucket();
        this._createHUD();
        this._createCodeDisplay();
        this._createMuteButton();
        this._setupCollisionHandler();

        // Floating paw prints in background
        this._spawnPawPrints();
    }

    // ----- Background -----

    _createBackground () {
        const W = this.scale.width;
        const H = this.scale.height;
        const g = this.add.graphics();
        g.fillStyle(COLORS.bg, 1);
        g.fillRect(0, 0, W, H);
        g.fillStyle(COLORS.bgLight, 0.15);
        g.fillCircle(W / 2, H / 2, 340);
        g.setDepth(-10);
    }

    // ----- Pegs -----

    _createPegs () {
        const layout = PegLayout.generate(this.scale.width, this.scale.height, this.discountCode.length, this.difficulty.spacing);

        layout.forEach((p, idx) => {
            const textureKey = 'peg-' + p.type;
            const peg = this.matter.add.image(p.x, p.y, textureKey, null, {
                circleRadius: PEG_RADIUS,
                isStatic: true,
                restitution: 1,
                friction: 0,
                label: 'peg',
            });
            peg.setCollisionCategory(this.catPegs);
            peg.setCollidesWith([this.catBalls]);

            peg.isPeg = true;
            peg.pegType = p.type;
            peg.pegIndex = idx;
            peg.destroyed = false;
            peg.setDepth(2);

            // subtle idle pulse
            this.tweens.add({
                targets: peg,
                scaleX: 1.06,
                scaleY: 1.06,
                yoyo: true,
                repeat: -1,
                duration: Phaser.Math.Between(1400, 2200),
                delay: Phaser.Math.Between(0, 1000),
                ease: 'Sine.easeInOut',
            });

            this.pegSprites.push(peg);
        });

        this.pegs = layout;
    }

    // ----- Launcher (stationary paw on left, fires from top-center) -----

    _createLauncher () {
        const W = this.scale.width;
        this.launchX = W / 2;
        this.launchY = 30;
        // Wall inner edges (setBounds uses thickness 32)
        this.wallLeft = 32;
        this.wallRight = W - 32;

        // Paw sits to the left of the launch point
        this.catPaw = this.add.image(this.launchX - 80, 28, 'cat-paw').setOrigin(0, 0.5).setDepth(10);

        // Small ball indicator at launch point
        this.launchDot = this.add.graphics().setDepth(9);
        this.launchDot.fillStyle(0xFFFFFF, 0.25);
        this.launchDot.fillCircle(this.launchX, this.launchY, 5);

        this.aimLine = this.add.graphics().setDepth(9);
        this.currentAngle = Math.PI / 2;
        this.laserOn = true;

        this.input.on('pointermove', (ptr) => {
            if (!this.canShoot) return;
            const angle = Phaser.Math.Angle.Between(this.launchX, this.launchY, ptr.worldX, ptr.worldY);
            this.currentAngle = Phaser.Math.Clamp(angle, 0.08, Math.PI - 0.08);
            this._drawAimLine(this.launchX, this.launchY, this.currentAngle);
        });

        this.input.on('pointerdown', (ptr) => {
            if (ptr.rightButtonDown()) {
                this.laserOn = !this.laserOn;
                if (!this.laserOn) this.aimLine.clear();
                else this._drawAimLine(this.launchX, this.launchY, this.currentAngle);
                return;
            }
            if (!this.canShoot || this.ballsLeft <= 0) return;
            soundBank.resume();
            const angle = Phaser.Math.Angle.Between(this.launchX, this.launchY, ptr.worldX, ptr.worldY);
            const clamped = Phaser.Math.Clamp(angle, 0.08, Math.PI - 0.08);
            this._swipeAndFire(this.launchX, this.launchY, clamped);
        });

        // Disable context menu so right-click works
        this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _swipeAndFire (x, y, angle) {
        // Paw lunges right then retracts
        const origX = this.catPaw.x;
        this.tweens.add({
            targets: this.catPaw,
            x: origX + 24,
            duration: 70,
            yoyo: true,
            ease: 'Quad.easeOut',
        });
        this._fireBall(x, y, angle);
    }

    _drawAimLine (ox, oy, angle) {
        this.aimLine.clear();
        if (!this.laserOn) return;

        const dx = Math.cos(angle);
        const dy = Math.sin(angle);

        // Extend only to the first peg row (y ≈ 140)
        const maxReach = 120;
        const endX = ox + dx * maxReach;
        const endY = oy + dy * maxReach;

        // Outer glow
        this.aimLine.lineStyle(6, 0xFF0000, 0.08);
        this.aimLine.beginPath();
        this.aimLine.moveTo(ox, oy);
        this.aimLine.lineTo(endX, endY);
        this.aimLine.strokePath();

        // Mid glow
        this.aimLine.lineStyle(3, 0xFF2222, 0.2);
        this.aimLine.beginPath();
        this.aimLine.moveTo(ox, oy);
        this.aimLine.lineTo(endX, endY);
        this.aimLine.strokePath();

        // Core beam
        this.aimLine.lineStyle(1.5, 0xFF4444, 0.7);
        this.aimLine.beginPath();
        this.aimLine.moveTo(ox, oy);
        this.aimLine.lineTo(endX, endY);
        this.aimLine.strokePath();

        // Dot at the tip
        this.aimLine.fillStyle(0xFF0000, 0.6);
        this.aimLine.fillCircle(endX, endY, 3);
        this.aimLine.fillStyle(0xFF6666, 0.9);
        this.aimLine.fillCircle(endX, endY, 1.5);
    }

    // ----- Ball -----

    _fireBall (x, y, angle) {
        this.canShoot = false;
        this.ballsLeft--;
        this.turnPegsHit = 0;
        this._removeMouseIcon();
        this.aimLine.clear();

        soundBank.launch();

        const speed = 22;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        const ball = this.matter.add.image(x, y, 'ball', null, {
            circleRadius: BALL_RADIUS,
            restitution: 1,
            friction: 0,
            frictionAir: 0,
            density: 0.002,
            label: 'ball',
        });
        ball.isBall = true;
        ball._spawnTime = this.time.now;
        ball.setCollisionCategory(this.catBalls);
        ball.setCollidesWith([1, this.catPegs, this.catBalls, this.catBucket]);
        ball.setVelocity(vx, vy);
        ball.setDepth(5);

        this.activeBalls.push(ball);
    }

    _setupCollisionHandler () {
        const getGameObject = (body) => {
            if (body.gameObject) return body.gameObject;
            if (body.parent && body.parent !== body && body.parent.gameObject) return body.parent.gameObject;
            return null;
        };

        this.matter.world.on('collisionstart', (event) => {
            event.pairs.forEach((pair) => {
                const goA = getGameObject(pair.bodyA);
                const goB = getGameObject(pair.bodyB);

                // Bucket detection (bucket is a raw body, not a game object)
                const isBucketA = pair.bodyA === this.bucketBody || pair.bodyA.parent === this.bucketBody;
                const isBucketB = pair.bodyB === this.bucketBody || pair.bodyB.parent === this.bucketBody;
                if ((isBucketA && goB && goB.isBall) || (isBucketB && goA && goA.isBall)) {
                    this.bucketCaught = true;
                    this._catBucketReact();
                }

                if (!goA || !goB) return;

                let pegGo = null;
                if (goA.isPeg && goB.isBall) pegGo = goA;
                else if (goB.isPeg && goA.isBall) pegGo = goB;

                if (pegGo && pegGo.active && !pegGo.destroyed) {
                    this._hitPeg(pegGo);
                }
            });
        });
    }

    _hitPeg (peg) {
        if (peg.destroyed) return;
        peg.destroyed = true;
        this.turnPegsHit++;

        soundBank.pegHit(peg.pegType);
        this.score += peg.pegType === 'orange' ? 100 : 10;
        this.scoreText.setText('Score: ' + this.score);

        // Green peg: multiball (spawn before destroying)
        if (peg.pegType === 'green') {
            this._triggerMultiball(peg.x, peg.y);
        }

        // Orange peg: reveal a character immediately
        if (peg.pegType === 'orange') {
            this._revealNextChar();
        }

        // Particle burst at peg position
        const tintColor = COLORS[peg.pegType] || COLORS.blue;
        const emitter = this.add.particles(peg.x, peg.y, 'particle', {
            speed: { min: 60, max: 180 },
            scale: { start: 1, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 400,
            quantity: 10,
            tint: tintColor,
            gravityY: 200,
            emitting: false,
        });
        emitter.setDepth(6);
        emitter.explode(10);

        // Animate out and destroy
        this.tweens.add({
            targets: peg,
            scaleX: 0,
            scaleY: 0,
            alpha: 0,
            duration: 200,
            ease: 'Back.easeIn',
            onComplete: () => peg.destroy(),
        });

        const idx = this.pegSprites.indexOf(peg);
        if (idx !== -1) this.pegSprites.splice(idx, 1);
    }

    _triggerMultiball (x, y) {
        for (let i = 0; i < 2; i++) {
            const angle = -Math.PI / 2 + (i === 0 ? -0.4 : 0.4);
            const ball = this.matter.add.image(x, y, 'ball', null, {
                circleRadius: BALL_RADIUS,
                restitution: 1,
                friction: 0,
                frictionAir: 0,
                density: 0.002,
                label: 'ball',
            });
            ball.isBall = true;
            ball._spawnTime = this.time.now;
            ball.setCollisionCategory(this.catBalls);
            ball.setCollidesWith([1, this.catPegs, this.catBalls, this.catBucket]);
            ball.setVelocity(Math.cos(angle) * 14, Math.sin(angle) * 14);
            ball.setDepth(5);
            this.activeBalls.push(ball);
        }
    }

    // ----- Bucket -----

    _createBucket () {
        const H = this.scale.height;
        const W = this.scale.width;
        this.bucketSprite = this.add.image(W / 2, H - 24, 'cat-bucket').setDepth(3);
        this.bucketBody = this.matter.add.rectangle(W / 2, H - 24, 50, 40, {
            isStatic: true,
            isSensor: true,
            label: 'bucket',
        });
        this.bucketBody.collisionFilter.category = this.catBucket;
        this.bucketBody.collisionFilter.mask = this.catBalls;

        this.bucketDir = 1;
        this.bucketSpeed = 1.5;
        this.bucketCaught = false;
    }

    _catBucketReact () {
        if (!this.bucketSprite || !this.bucketSprite.active) return;
        this.bucketSprite.setTexture('cat-bucket-happy');
        this.tweens.add({
            targets: this.bucketSprite,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 150,
            yoyo: true,
            ease: 'Quad.easeOut',
            onComplete: () => {
                if (this.bucketSprite && this.bucketSprite.active) {
                    this.time.delayedCall(600, () => {
                        if (this.bucketSprite && this.bucketSprite.active) {
                            this.bucketSprite.setTexture('cat-bucket');
                        }
                    });
                }
            },
        });
    }

    // ----- HUD -----

    _createHUD () {
        this.mouseIcons = [];
        const startX = 20;
        const iconY = 18;
        for (let i = 0; i < this.ballsLeft; i++) {
            const m = this.add.image(startX + i * 20, iconY, 'mouse-icon').setDepth(20).setOrigin(0, 0.5);
            this.mouseIcons.push(m);
        }

        this.scoreText = this.add.text(this.scale.width - 20, 15, 'Score: 0', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '20px',
            color: '#F7F0E0',
        }).setOrigin(1, 0).setDepth(20);
    }

    _removeMouseIcon () {
        const idx = this.mouseIcons.length - 1;
        if (idx < 0) return;
        const icon = this.mouseIcons.pop();
        this.tweens.add({
            targets: icon,
            alpha: 0,
            scaleX: 0,
            scaleY: 0,
            duration: 200,
            ease: 'Back.easeIn',
            onComplete: () => icon.destroy(),
        });
    }

    _addMouseIcon () {
        const startX = 20;
        const iconY = 18;
        const i = this.mouseIcons.length;
        const m = this.add.image(startX + i * 20, iconY, 'mouse-icon')
            .setDepth(20).setOrigin(0, 0.5).setScale(0);
        this.mouseIcons.push(m);
        this.tweens.add({
            targets: m,
            scaleX: 1,
            scaleY: 1,
            duration: 300,
            ease: 'Back.easeOut',
        });
    }

    _createMuteButton () {
        this.muteText = this.add.text(this.scale.width - 20, 45, '🔊', {
            fontSize: '22px',
        }).setOrigin(1, 0).setDepth(20).setInteractive({ useHandCursor: true });

        this.muteText.on('pointerdown', () => {
            const muted = soundBank.toggle();
            this.muteText.setText(muted ? '🔇' : '🔊');
        });
    }

    // ----- Discount Code Display -----

    _createCodeDisplay () {
        this.codeChars = [];
        const code = this.discountCode;
        const total = code.length;
        const startX = this.scale.width / 2 - (total * 30) / 2;

        for (let i = 0; i < total; i++) {
            const char = this.add.text(startX + i * 30 + 15, 60, '_', {
                fontFamily: '"Courier New", monospace',
                fontSize: '32px',
                color: '#F7F0E0',
            }).setOrigin(0.5).setAlpha(0.4).setDepth(20);
            char._revealed = false;
            char._actualChar = code[i];
            this.codeChars.push(char);
        }
    }

    _revealNextChar () {
        const idx = this.revealedCount;
        if (idx >= this.codeChars.length) return;

        const char = this.codeChars[idx];
        char._revealed = true;
        char.setText(char._actualChar);
        char.setAlpha(0);
        char.setColor('#FFD700');

        soundBank.reveal(idx);

        this.tweens.add({
            targets: char,
            alpha: 1,
            scaleX: { from: 2, to: 1 },
            scaleY: { from: 2, to: 1 },
            duration: 400,
            ease: 'Back.easeOut',
        });

        // particle burst behind character
        const emitter = this.add.particles(char.x, char.y, 'particle', {
            speed: { min: 40, max: 100 },
            scale: { start: 0.8, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 500,
            quantity: 8,
            tint: COLORS.gold,
            emitting: false,
        });
        emitter.setDepth(19);
        emitter.explode(8);

        this.revealedCount++;

        const progressMsg = {
            type: 'PROGRESS',
            revealed: this.revealedCount,
            total: this.discountCode.length,
        };
        if (window.GAME_CONFIG.hasCode) progressMsg.code = this.discountCode;
        window.parent.postMessage(progressMsg, '*');
    }

    // ----- Turn resolution -----

    _resolveTurn (freeBall) {
        let comboDelay = 0;

        if (this.turnPegsHit >= 5) {
            this.cameras.main.shake(200, 0.008);
            this._showComboText('AMAZING!', 0);
            comboDelay = 800;
        } else if (this.turnPegsHit >= 3) {
            this.cameras.main.shake(100, 0.004);
            this._showComboText('Nice!', 0);
            comboDelay = 800;
        }

        if (freeBall) {
            soundBank.freeBall();
            this.ballsLeft++;
            this._addMouseIcon();
            this._showComboText('Free Ball!', comboDelay);
        }

        this._movePurplePeg();
        this.resolving = false;
        this.canShoot = true;

        if (this.revealedCount >= this.discountCode.length) {
            this.canShoot = false;
            this.time.delayedCall(800, () => {
                this.scene.start('Win', { score: this.score, code: this.discountCode });
            });
            return;
        }

        if (this.ballsLeft <= 0) {
            this.time.delayedCall(300, () => {
                this.scene.start('GameOver', {
                    score: this.score,
                    code: this.discountCode,
                    revealedCount: this.revealedCount,
                });
            });
        }
    }

    _movePurplePeg () {
        const purple = this.pegSprites.find(p => p.pegType === 'purple' && p.active);
        if (!purple) return;
        const blues = this.pegSprites.filter(p => p.pegType === 'blue' && p.active);
        if (blues.length === 0) return;

        const target = Phaser.Utils.Array.GetRandom(blues);
        const oldX = purple.x, oldY = purple.y;
        const MatterBody = Phaser.Physics.Matter.Matter.Body;
        purple.setPosition(target.x, target.y);
        MatterBody.setPosition(purple.body, { x: target.x, y: target.y });
        target.setPosition(oldX, oldY);
        MatterBody.setPosition(target.body, { x: oldX, y: oldY });
    }

    _showComboText (msg, delay) {
        this.time.delayedCall(delay || 0, () => {
            const t = this.add.text(this.scale.width / 2, this.scale.height / 2, msg, {
                fontFamily: 'Arial Black, Impact, sans-serif',
                fontSize: '40px',
                color: '#FFD700',
                stroke: '#FF6B35',
                strokeThickness: 4,
            }).setOrigin(0.5).setDepth(30).setAlpha(0);

            this.tweens.add({
                targets: t,
                alpha: 1,
                scaleX: { from: 0.5, to: 1.2 },
                scaleY: { from: 0.5, to: 1.2 },
                duration: 300,
                yoyo: true,
                hold: 400,
                onComplete: () => t.destroy(),
            });
        });
    }

    // ----- Background paw prints -----

    _spawnPawPrints () {
        for (let i = 0; i < 8; i++) {
            const x = Phaser.Math.Between(50, this.scale.width - 50);
            const y = Phaser.Math.Between(50, this.scale.height - 50);
            const t = this.add.text(x, y, '🐾', { fontSize: '24px' }).setAlpha(0.04).setDepth(-5);
            this.tweens.add({
                targets: t,
                y: y - 150,
                alpha: 0,
                duration: Phaser.Math.Between(8000, 14000),
                repeat: -1,
                delay: Phaser.Math.Between(0, 5000),
                onRepeat: () => {
                    t.x = Phaser.Math.Between(50, this.scale.width - 50);
                    t.y = Phaser.Math.Between(this.scale.height * 0.5, this.scale.height);
                    t.setAlpha(0.04);
                },
            });
        }
    }

    // ----- Update loop -----

    update () {
        // Move bucket back and forth
        const W = this.scale.width;
        const bx = this.bucketBody.position.x + this.bucketSpeed * this.bucketDir;
        if (bx > W - 60 || bx < 60) this.bucketDir *= -1;
        const MatterBody = Phaser.Physics.Matter.Matter.Body;
        MatterBody.setPosition(this.bucketBody, { x: bx, y: this.bucketBody.position.y });
        this.bucketSprite.setPosition(bx, this.bucketBody.position.y);

        if (this.activeBalls.length === 0 && this.canShoot) return;

        const H = this.scale.height;
        let allGone = true;

        const now = this.time.now;
        for (let i = this.activeBalls.length - 1; i >= 0; i--) {
            const ball = this.activeBalls[i];
            if (!ball.active) {
                this.activeBalls.splice(i, 1);
                continue;
            }

            if (ball.y > H + 40) {
                ball.destroy();
                this.activeBalls.splice(i, 1);
                continue;
            }

            // Unstick: if ball is nearly stationary, nudge it down
            const v = ball.body.velocity;
            const speed = Math.sqrt(v.x * v.x + v.y * v.y);
            if (speed < 0.3 && ball.y > 60) {
                ball.setVelocity(v.x, v.y + 1);
            }

            // Timeout: if ball has been alive 15+ seconds, destroy it
            if (!ball._spawnTime) ball._spawnTime = now;
            if (now - ball._spawnTime > 15000) {
                ball.destroy();
                this.activeBalls.splice(i, 1);
                continue;
            }

            allGone = false;
        }

        if (allGone && !this.canShoot && !this.resolving) {
            this.resolving = true;
            const freeBall = this.bucketCaught;
            this.bucketCaught = false;
            this._resolveTurn(freeBall);
        }
    }
}

// ---------------------------------------------------------------------------
//  WinScene
// ---------------------------------------------------------------------------

class WinScene extends Phaser.Scene {
    constructor () { super({ key: 'Win' }); }

    create (data) {
        const W = this.scale.width;
        const H = this.scale.height;
        const score = data.score || 0;
        const code = data.code || window.GAME_CONFIG.discountCode;

        const hasCode = window.GAME_CONFIG.hasCode;
        const msg = { type: 'GAME_WON', score };
        if (hasCode) msg.code = code;
        window.parent.postMessage(msg, '*');
        soundBank.winJingle();

        // Background flash
        const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xFFFFFF).setAlpha(0.6).setDepth(0);
        this.tweens.add({ targets: flash, alpha: 0, duration: 600 });

        // Confetti
        const emitter = this.add.particles(W / 2, -20, 'particle', {
            x: { min: -W / 2, max: W / 2 },
            speed: { min: 100, max: 300 },
            angle: { min: 70, max: 110 },
            scale: { start: 1.5, end: 0.3 },
            alpha: { start: 1, end: 0.5 },
            lifespan: 3000,
            gravityY: 150,
            quantity: 3,
            frequency: 50,
            tint: [COLORS.orange, COLORS.blue, COLORS.green, COLORS.gold, COLORS.purple],
        });
        emitter.setDepth(1);

        // Win text
        this.add.text(W / 2, H / 2 - 100, 'YOU WIN!', {
            fontFamily: 'Arial Black, Impact, sans-serif',
            fontSize: '64px',
            color: '#FFD700',
            stroke: '#FF6B35',
            strokeThickness: 6,
        }).setOrigin(0.5).setDepth(10);

        if (hasCode) {
            const codeText = this.add.text(W / 2, H / 2 - 20, code, {
                fontFamily: '"Courier New", monospace',
                fontSize: '48px',
                color: '#FFD700',
                stroke: '#1a1a2e',
                strokeThickness: 4,
            }).setOrigin(0.5).setDepth(10);

            this.tweens.add({
                targets: codeText,
                scaleX: 1.08,
                scaleY: 1.08,
                yoyo: true,
                repeat: -1,
                duration: 600,
                ease: 'Sine.easeInOut',
            });

            this.add.text(W / 2, H / 2 + 40, `Use code ${code} for a discount!`, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '22px',
                color: '#F7F0E0',
            }).setOrigin(0.5).setDepth(10);
        } else {
            this.add.text(W / 2, H / 2 - 10, 'Great job! 🐱', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '28px',
                color: '#F7F0E0',
            }).setOrigin(0.5).setDepth(10);
        }

        this.add.text(W / 2, H / 2 + 90, `Score: ${score}`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '20px',
            color: '#F7F0E0',
        }).setOrigin(0.5).setDepth(10);

        // Play again button
        const btn = this.add.text(W / 2, H / 2 + 150, '▶  Play Again', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '26px',
            color: '#4ECDC4',
            backgroundColor: '#1a1a2e',
            padding: { x: 20, y: 10 },
        }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => btn.setColor('#FFD700'));
        btn.on('pointerout', () => btn.setColor('#4ECDC4'));
        btn.on('pointerdown', () => this.scene.start('Game'));
    }
}

// ---------------------------------------------------------------------------
//  GameOverScene
// ---------------------------------------------------------------------------

class GameOverScene extends Phaser.Scene {
    constructor () { super({ key: 'GameOver' }); }

    create (data) {
        const W = this.scale.width;
        const H = this.scale.height;
        const score = data.score || 0;
        const code = data.code || window.GAME_CONFIG.discountCode;
        const revealed = data.revealedCount || 0;

        const hasCode = window.GAME_CONFIG.hasCode;
        window.parent.postMessage({ type: 'GAME_OVER', score }, '*');

        this.add.text(W / 2, H / 2 - 80, 'So Close!', {
            fontFamily: 'Arial Black, Impact, sans-serif',
            fontSize: '56px',
            color: '#FF6B35',
            stroke: '#1a1a2e',
            strokeThickness: 4,
        }).setOrigin(0.5);

        if (hasCode) {
            let partial = '';
            for (let i = 0; i < code.length; i++) {
                partial += i < revealed ? code[i] : '_';
                if (i < code.length - 1) partial += ' ';
            }
            this.add.text(W / 2, H / 2, partial, {
                fontFamily: '"Courier New", monospace',
                fontSize: '36px',
                color: '#F7F0E0',
            }).setOrigin(0.5);
        } else {
            this.add.text(W / 2, H / 2, `${revealed} / ${code.length} letters found`, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '24px',
                color: '#F7F0E0',
            }).setOrigin(0.5);
        }

        this.add.text(W / 2, H / 2 + 50, `Score: ${score}`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '20px',
            color: '#F7F0E0',
        }).setOrigin(0.5);

        const btn = this.add.text(W / 2, H / 2 + 120, '▶  Try Again?', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '26px',
            color: '#4ECDC4',
            backgroundColor: '#1a1a2e',
            padding: { x: 20, y: 10 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => btn.setColor('#FFD700'));
        btn.on('pointerout', () => btn.setColor('#4ECDC4'));
        btn.on('pointerdown', () => this.scene.start('Game'));
    }
}

// ---------------------------------------------------------------------------
//  Game Config & Launch
// ---------------------------------------------------------------------------

const config = {
    type: Phaser.AUTO,
    width: 900,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 0.6 },
            enableSleeping: false,
            debug: false,
        },
    },
    scene: [BootScene, TitleScene, GameScene, WinScene, GameOverScene],
};

const game = new Phaser.Game(config);
