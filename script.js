/* =====================================================================
   MISSION: SECRET MESSAGE — GAME LOGIC
   Vanilla JS only. Organized into small, reusable functions.
   Sections: config, screen management, particles, star mini-game,
   PIN entry, envelope reveal, and initial boot sequence.
===================================================================== */

/* ---------------------------------------------------------------
   0. CONFIG
   Change the access code here whenever you like — nothing else
   in the game needs to be touched.
---------------------------------------------------------------- */
const CONFIG = {
  ACCESS_CODE: '110226',   // <-- edit this to change the PIN + reward code
  TOTAL_STARS: 15,
  STAR_SIZE: 44             // px, must roughly match .star width/height in CSS
};

/* ---------------------------------------------------------------
   0.1 SOUND LIBRARY
   Drop your own audio files into a "sounds" folder next to this
   script and name them as listed below (mp3 works everywhere; wav/ogg
   also fine). Missing files are simply skipped — nothing will break
   if you leave some blank for now.
---------------------------------------------------------------- */
const SOUNDS = {
  transition: 'sounds/transition.mp3',   // screen-to-screen whoosh
  collect:    'sounds/collect.mp3',      // picking up a star
  complete:   'sounds/complete.mp3',     // all 15 stars collected
  keyTap:     'sounds/key-tap.mp3',      // keypad button press
  success:    'sounds/success.mp3',      // correct PIN entered
  error:      'sounds/error.mp3',        // incorrect PIN entered
  envelope:   'sounds/envelope.mp3'      // envelope opening
};

// Preload every sound once so playback is instant when triggered
const audioCache = {};
Object.entries(SOUNDS).forEach(([name, src]) => {
  const audio = new Audio(src);
  audio.preload = 'auto';
  audioCache[name] = audio;
});

/**
 * Plays a sound by name from the SOUNDS list above.
 * Safe to call even if the file is missing or the browser blocks
 * autoplay — errors are caught quietly so the game never crashes.
 */
function playSound(name) {
  const original = audioCache[name];
  if (!original) return;
  // Clone the node so overlapping plays (e.g. fast clicks) don't cut each other off
  const instance = original.cloneNode();
  instance.volume = 0.6;
  instance.play().catch(() => {
    // Autoplay restrictions or a missing file — ignore, game continues normally
  });
}

/* ---------------------------------------------------------------
   1. SCREEN MANAGEMENT
   Every "screen" is a <section class="screen" id="screen-x">.
   switchScreen() crossfades the current one out and the next one in.
---------------------------------------------------------------- */
function switchScreen(nextId) {
  const current = document.querySelector('.screen.active');
  const next = document.getElementById(nextId);
  if (!next || current === next) return;

  playSound('transition');
  if (current) current.classList.remove('active');
  // Small delay lets the fade-out begin before the new screen fades in
  requestAnimationFrame(() => {
    next.classList.add('active');
  });
}

/* ---------------------------------------------------------------
   2. AMBIENT PARTICLE FIELD
   Generates soft floating dots that drift upward behind every screen.
---------------------------------------------------------------- */
function createParticles(count = 28) {
  const field = document.getElementById('particleField');
  const frag = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';

    const size = Math.random() * 4 + 2;           // 2px - 6px
    const left = Math.random() * 100;             // vw
    const duration = Math.random() * 14 + 10;      // 10s - 24s
    const delay = Math.random() * 14;              // stagger starts

    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${left}vw`;
    p.style.bottom = `-10px`;
    p.style.animationDuration = `${duration}s`;
    p.style.animationDelay = `${delay}s`;

    frag.appendChild(p);
  }
  field.appendChild(frag);
}

/* ---------------------------------------------------------------
   3. STAR MINI-GAME
   Places TOTAL_STARS stars at random, non-overlapping positions,
   each with its own gentle floating animation. Clicking a star
   collects it; collecting all of them triggers Mission Complete.
---------------------------------------------------------------- */
let starsCollected = 0;

function startStarGame() {
  starsCollected = 0;
  document.getElementById('starCount').textContent = '0';
  document.getElementById('missionCompleteFlash').classList.remove('show');

  const starField = document.getElementById('starField');
  starField.innerHTML = ''; // clear any stars from a previous playthrough

  const positions = generateNonOverlappingPositions(
    CONFIG.TOTAL_STARS,
    CONFIG.STAR_SIZE,
    starField
  );

  positions.forEach((pos, index) => {
    const star = document.createElement('button');
    star.className = 'star';
    star.innerHTML = '&#11088;'; // ⭐
    star.style.left = `${pos.x}px`;
    star.style.top = `${pos.y}px`;
    // Slight randomized timing so stars don't float in unison
    star.style.animationDelay = `${(index % 5) * 0.3}s`;
    star.addEventListener('click', () => collectStar(star), { once: true });
    starField.appendChild(star);
  });
}

/**
 * Generates `count` positions inside the given container that don't
 * overlap, using simple rejection sampling with a minimum distance.
 */
function generateNonOverlappingPositions(count, size, container) {
  const positions = [];
  const bounds = container.getBoundingClientRect();
  const padding = 70; // keep stars away from the HUD and screen edges
  const minDistance = size * 1.6;
  const maxAttempts = 400;

  const maxX = Math.max(bounds.width - size - padding, padding);
  const maxY = Math.max(bounds.height - size - padding, padding + 60);

  for (let i = 0; i < count; i++) {
    let attempt = 0;
    let placed = false;

    while (attempt < maxAttempts && !placed) {
      const candidate = {
        x: padding + Math.random() * (maxX - padding),
        y: padding + 60 + Math.random() * (maxY - padding - 60)
      };

      const overlaps = positions.some(p => {
        const dx = p.x - candidate.x;
        const dy = p.y - candidate.y;
        return Math.sqrt(dx * dx + dy * dy) < minDistance;
      });

      if (!overlaps) {
        positions.push(candidate);
        placed = true;
      }
      attempt++;
    }

    // Fallback: if we couldn't find a free spot, place it anyway
    if (!placed) {
      positions.push({
        x: padding + Math.random() * (maxX - padding),
        y: padding + 60 + Math.random() * (maxY - padding - 60)
      });
    }
  }

  return positions;
}

function collectStar(starElement) {
  playSound('collect');
  starElement.classList.add('collected');
  starsCollected++;
  document.getElementById('starCount').textContent = starsCollected;

  // Remove the element after its collect animation finishes
  setTimeout(() => starElement.remove(), 600);

  if (starsCollected >= CONFIG.TOTAL_STARS) {
    onMissionComplete();
  }
}

function onMissionComplete() {
  playSound('complete');
  const flash = document.getElementById('missionCompleteFlash');
  flash.classList.add('show');

  setTimeout(() => {
    document.getElementById('accessCodeDisplay').textContent = CONFIG.ACCESS_CODE;
    switchScreen('screen-reward');
  }, 1400);
}

/* ---------------------------------------------------------------
   4. PIN ENTRY SCREEN
   Six-digit smartphone-style lock screen. Wrong codes shake and
   clear; the correct code proceeds to the congratulations screen.
---------------------------------------------------------------- */
let enteredPin = '';

function initPinScreen() {
  enteredPin = '';
  updatePinDots();
  setPinMessage('', false);

  const keypad = document.getElementById('keypad');
  // Avoid stacking duplicate listeners if this screen is revisited
  keypad.replaceWith(keypad.cloneNode(true));
  document.getElementById('keypad').addEventListener('click', handleKeypadClick);
}

function handleKeypadClick(e) {
  const key = e.target.closest('.key');
  if (!key) return;
  const value = key.dataset.key;

  playSound('keyTap');

  if (value === 'delete') {
    enteredPin = enteredPin.slice(0, -1);
    setPinMessage('', false);
  } else if (value === 'enter') {
    checkPin();
  } else if (enteredPin.length < 6) {
    enteredPin += value;
    setPinMessage('', false);
  }

  updatePinDots();
}

function updatePinDots() {
  const dots = document.querySelectorAll('#pinDots .pin-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < enteredPin.length);
  });
}

function checkPin() {
  if (enteredPin.length < 6) return; // wait for all 6 digits

  if (enteredPin === CONFIG.ACCESS_CODE) {
    playSound('success');
    setPinMessage('ACCESO CONCEDIDO', true);
    setTimeout(() => switchScreen('screen-congrats'), 1100);
  } else {
    playSound('error');
    setPinMessage('PIN incorrecto. Inténtalo de nuevo.', false);
    const dotsWrap = document.getElementById('pinDots');
    dotsWrap.classList.add('shake');
    setTimeout(() => {
      dotsWrap.classList.remove('shake');
      enteredPin = '';
      updatePinDots();
    }, 450);
  }
}

function setPinMessage(text, success) {
  const msg = document.getElementById('pinMessage');
  msg.textContent = text || '\u00A0'; // non-breaking space keeps layout stable
  msg.classList.toggle('success', !!success);
}

/* ---------------------------------------------------------------
   5. ENVELOPE REVEAL (SCREEN 6 -> 7)
   Clicking the envelope plays an opening animation, then the
   letter screen is revealed once that animation completes.
---------------------------------------------------------------- */
function initEnvelope() {
  const envelope = document.getElementById('envelope');
  const hint = document.getElementById('envelopeHint');

  // Reset in case the player somehow revisits this screen
  envelope.classList.remove('open');
  hint.style.opacity = '1';

  envelope.addEventListener('click', () => {
    if (envelope.classList.contains('open')) return; // prevent double-clicks
    playSound('envelope');
    envelope.classList.add('open');
    hint.style.opacity = '0';

    // Wait for the opening animation (see .envelope-flap transition) to finish
    setTimeout(() => switchScreen('screen-letter'), 1000);
  }, { once: true });
}

/* ---------------------------------------------------------------
   6. BOOT SEQUENCE
   Wires up every button once the DOM is ready.
---------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  createParticles();

  // Screen 1 -> 2
  document.getElementById('btnStart').addEventListener('click', () => {
    switchScreen('screen-briefing');
  });

  // Screen 2 -> 3 (also boots the star mini-game fresh each time)
  document.getElementById('btnBegin').addEventListener('click', () => {
    switchScreen('screen-game');
    // Give the layout a tick to settle before measuring star-field bounds
    setTimeout(startStarGame, 50);
  });

  // Screen 4 -> 5
  document.getElementById('btnContinueToPin').addEventListener('click', () => {
    switchScreen('screen-pin');
    initPinScreen();
  });

  // Screen 6 envelope interaction is wired once, up front
  initEnvelope();
});