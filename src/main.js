// Quick Draw - Typing Showdown Game

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hiddenInput = document.getElementById('hidden-input');

// Aspect ratio (width:height)
const ASPECT_RATIO = 2.5;

// Ground level (where cowboys stand) as percentage of canvas height
const GROUND_LEVEL = 0.73;

// Cowboy X positions (percentage of canvas width)
const PLAYER_X = 0.32;
const ENEMY_X = 0.68;

// Resize canvas to fill width
function resizeCanvas() {
  const width = window.innerWidth;
  let height = width / ASPECT_RATIO;

  // Cap height to viewport height if needed
  const maxHeight = window.innerHeight;
  if (height > maxHeight) {
    height = maxHeight;
  }

  // Set actual canvas resolution
  canvas.width = width;
  canvas.height = height;
}

// Initial resize
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Background image
const backgroundImage = new Image();
backgroundImage.src = '/background.jpg';
let backgroundLoaded = false;
backgroundImage.onload = () => {
  backgroundLoaded = true;
};

// ============================================
// ATMOSPHERIC EFFECTS
// ============================================

// Dust particles drifting in the wind
const dustParticles = [];
const DUST_COUNT = 40;

function initDust() {
  for (let i = 0; i < DUST_COUNT; i++) {
    dustParticles.push(createDustParticle(true));
  }
}

function createDustParticle(randomX = false) {
  return {
    x: randomX ? Math.random() * canvas.width : canvas.width + Math.random() * 100,
    y: Math.random() * canvas.height * 0.85,
    size: 1 + Math.random() * 3,
    speedX: -0.3 - Math.random() * 0.8,
    speedY: Math.sin(Math.random() * Math.PI * 2) * 0.2,
    opacity: 0.2 + Math.random() * 0.4,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: 0.02 + Math.random() * 0.03,
  };
}

function updateDust() {
  for (let i = 0; i < dustParticles.length; i++) {
    const p = dustParticles[i];
    p.wobble += p.wobbleSpeed;
    p.x += p.speedX;
    p.y += p.speedY + Math.sin(p.wobble) * 0.3;

    // Reset when off screen
    if (p.x < -10) {
      dustParticles[i] = createDustParticle(false);
    }
  }
}

function drawDust() {
  for (const p of dustParticles) {
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = '#d4a76a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Tumbleweeds
const tumbleweeds = [];
let lastTumbleweedTime = 0;
const TUMBLEWEED_INTERVAL = 8000 + Math.random() * 12000; // 8-20 seconds

function createTumbleweed() {
  const fromLeft = Math.random() > 0.5;
  const size = 15 + Math.random() * 25;
  return {
    x: fromLeft ? -size * 2 : canvas.width + size * 2,
    y: canvas.height * (0.65 + Math.random() * 0.12),
    size: size,
    speedX: fromLeft ? (1.5 + Math.random() * 2) : -(1.5 + Math.random() * 2),
    rotation: 0,
    rotationSpeed: (fromLeft ? 1 : -1) * (0.05 + Math.random() * 0.05),
    bouncePhase: Math.random() * Math.PI * 2,
    opacity: 0.7 + Math.random() * 0.3,
  };
}

function updateTumbleweeds() {
  const now = Date.now();

  // Spawn new tumbleweed occasionally
  if (now - lastTumbleweedTime > TUMBLEWEED_INTERVAL && tumbleweeds.length < 2) {
    tumbleweeds.push(createTumbleweed());
    lastTumbleweedTime = now;
  }

  // Update existing tumbleweeds
  for (let i = tumbleweeds.length - 1; i >= 0; i--) {
    const t = tumbleweeds[i];
    t.x += t.speedX;
    t.rotation += t.rotationSpeed;
    t.bouncePhase += 0.15;
    t.y += Math.sin(t.bouncePhase) * 0.5; // Gentle bounce

    // Remove when off screen
    if ((t.speedX > 0 && t.x > canvas.width + t.size * 2) ||
        (t.speedX < 0 && t.x < -t.size * 2)) {
      tumbleweeds.splice(i, 1);
    }
  }
}

function drawTumbleweeds() {
  for (const t of tumbleweeds) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rotation);
    ctx.globalAlpha = t.opacity;

    // Draw tumbleweed as a messy circle of lines
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const innerR = t.size * 0.3;
      const outerR = t.size * (0.8 + Math.sin(angle * 3 + t.rotation) * 0.2);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
      ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
      ctx.stroke();
    }

    // Inner scribble
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + t.rotation * 0.5;
      const r = t.size * (0.2 + Math.sin(angle * 5) * 0.15);
      if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// Sun glint effect
let glintPhase = 0;
const glintSpeed = 0.02;

function drawSunGlint() {
  glintPhase += glintSpeed;

  // Sun position (roughly center-top of the background image)
  const sunX = canvas.width * 0.5;
  const sunY = canvas.height * 0.22;

  // Pulsing glow
  const pulseSize = 1 + Math.sin(glintPhase) * 0.15;
  const glowRadius = canvas.height * 0.15 * pulseSize;

  // Outer glow
  const gradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, glowRadius);
  gradient.addColorStop(0, 'rgba(255, 250, 220, 0.3)');
  gradient.addColorStop(0.5, 'rgba(255, 240, 200, 0.1)');
  gradient.addColorStop(1, 'rgba(255, 230, 180, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(sunX - glowRadius, sunY - glowRadius, glowRadius * 2, glowRadius * 2);

  // Lens flare streaks (subtle)
  ctx.globalAlpha = 0.15 + Math.sin(glintPhase * 1.5) * 0.1;
  ctx.strokeStyle = 'rgba(255, 250, 230, 0.5)';
  ctx.lineWidth = 2;

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + glintPhase * 0.1;
    const len = canvas.height * (0.08 + Math.sin(glintPhase + i) * 0.02);
    ctx.beginPath();
    ctx.moveTo(sunX, sunY);
    ctx.lineTo(sunX + Math.cos(angle) * len, sunY + Math.sin(angle) * len);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

// Floating dust motes (larger, slower, more visible)
const dustMotes = [];
const MOTE_COUNT = 8;

function initDustMotes() {
  for (let i = 0; i < MOTE_COUNT; i++) {
    dustMotes.push({
      x: Math.random() * canvas.width,
      y: canvas.height * (0.3 + Math.random() * 0.4),
      size: 2 + Math.random() * 4,
      speedX: -0.1 - Math.random() * 0.2,
      driftY: Math.random() * Math.PI * 2,
      opacity: 0,
      targetOpacity: 0.3 + Math.random() * 0.3,
      fadeSpeed: 0.005 + Math.random() * 0.01,
      fading: false,
    });
  }
}

function updateDustMotes() {
  for (const m of dustMotes) {
    m.driftY += 0.02;
    m.x += m.speedX;
    m.y += Math.sin(m.driftY) * 0.3;

    // Fade in/out
    if (!m.fading) {
      m.opacity = Math.min(m.targetOpacity, m.opacity + m.fadeSpeed);
      if (m.opacity >= m.targetOpacity && Math.random() < 0.002) {
        m.fading = true;
      }
    } else {
      m.opacity = Math.max(0, m.opacity - m.fadeSpeed);
      if (m.opacity <= 0) {
        // Reset
        m.x = canvas.width + Math.random() * 100;
        m.y = canvas.height * (0.3 + Math.random() * 0.4);
        m.fading = false;
        m.targetOpacity = 0.3 + Math.random() * 0.3;
      }
    }

    // Wrap around
    if (m.x < -20) {
      m.x = canvas.width + Math.random() * 100;
    }
  }
}

function drawDustMotes() {
  for (const m of dustMotes) {
    if (m.opacity <= 0) continue;
    ctx.globalAlpha = m.opacity;

    // Glowing dust mote
    const gradient = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.size * 2);
    gradient.addColorStop(0, 'rgba(255, 245, 220, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 240, 200, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 235, 180, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(m.x - m.size * 2, m.y - m.size * 2, m.size * 4, m.size * 4);
  }
  ctx.globalAlpha = 1;
}

// Initialize atmospheric effects
function initAtmosphere() {
  initDust();
  initDustMotes();
  lastTumbleweedTime = Date.now();
}

// Update all atmospheric effects
function updateAtmosphere() {
  updateDust();
  updateDustMotes();
  updateTumbleweeds();
}

// Draw all atmospheric effects (call after background, before characters)
function drawAtmosphere() {
  drawSunGlint();
  drawDust();
  drawDustMotes();
  drawTumbleweeds();
}

// ============================================
// END ATMOSPHERIC EFFECTS
// ============================================

// Day/night cycle palettes (10 stages) - kept for countdown positioning
// Day: Sun descends from top over 5 rounds
// Night: Moon descends from top over 5 rounds
const skyPalettes = [
  // DAY CYCLE - Sun descends (rounds 1-5)
  { top: '#5BA3D9', mid: '#87CEEB', bottom: '#E8DCC4', sun: '#FFFDE7', sunGlow: '#FFF8E1', sunY: 0.15, isNight: false },    // 0: High noon - sun at top
  { top: '#6B9BC3', mid: '#9DC4D9', bottom: '#E8D4B8', sun: '#FFF8E1', sunGlow: '#FFECB3', sunY: 0.22, isNight: false },    // 1: Early afternoon
  { top: '#7A9DBF', mid: '#C4A77D', bottom: '#E8C4A0', sun: '#FFE082', sunGlow: '#FFCC80', sunY: 0.30, isNight: false },    // 2: Afternoon
  { top: '#8B6B61', mid: '#D4956B', bottom: '#E8A870', sun: '#FFB74D', sunGlow: '#FFA726', sunY: 0.40, isNight: false },    // 3: Golden hour
  { top: '#4A2C4A', mid: '#C75B5B', bottom: '#F4A259', sun: '#FF8A65', sunGlow: '#FF7043', sunY: 0.52, isNight: false },    // 4: Sunset - sun at horizon

  // NIGHT CYCLE - Moon descends (rounds 6-10)
  { top: '#1A1A2E', mid: '#2D2D44', bottom: '#4A3A5E', sun: '#E8E8E8', sunGlow: '#B0B0B0', sunY: 0.12, isNight: true },     // 5: Early night - moon at top
  { top: '#151525', mid: '#252538', bottom: '#3A3A52', sun: '#E0E0E0', sunGlow: '#A0A0A0', sunY: 0.20, isNight: true },     // 6: Night
  { top: '#101020', mid: '#1E1E30', bottom: '#2E2E45', sun: '#D8D8D8', sunGlow: '#909090', sunY: 0.28, isNight: true },     // 7: Deep night
  { top: '#0D0D1A', mid: '#1A1A2E', bottom: '#2A2A40', sun: '#D0D0D0', sunGlow: '#888888', sunY: 0.36, isNight: true },     // 8: Late night
  { top: '#151525', mid: '#2A2A40', bottom: '#3D3D55', sun: '#C8C8C8', sunGlow: '#808080', sunY: 0.45, isNight: true },     // 9: Pre-dawn - moon low
];

// Happy Wheels style cowboy colors
const cowboyColors = {
  skin: '#E8B89D',
  skinOutline: '#000',
  hat: '#8B4513',
  hatBand: '#DAA520',
  shirt: '#B22222',
  vest: '#4A3728',
  pants: '#3D5C5C',
  boots: '#2F1F14',
  gun: '#4A4A4A',
  gunHighlight: '#6A6A6A',
};

// Colors for UI
const colors = {
  textPrimary: '#FFFFFF',
  textCorrect: '#00E676',
  textError: '#FF1744',
  textStreak: '#FFD700',
};

// Game state
const state = {
  phase: 'idle',
  currentWord: '',
  playerTyped: '',
  playerProgress: 0,
  playerArmDisplay: 0, // Animated arm position for display
  playerErrors: 0,
  aiProgress: 0,
  aiArmDisplay: 0, // Animated arm position for display
  aiTyped: '',
  winStreak: 0,
  countdownValue: 3,
  winner: null,
  playerFinishTime: null,
  aiFinishTime: null,
  roundStartTime: null,
  showDraw: false,
  showingResult: false,
  errorShakeUntil: 0,
  muzzleFlashUntil: 0,
  currentBg: 0, // Current background index
  wrongChar: null, // Currently displayed wrong character
  countdownInterval: null, // Store interval ID to prevent duplicates
  roundEndTime: null, // When the round ended (for delay before next round)
  timeouts: [], // Track all timeouts so we can clear them
  bullet: null, // Active bullet {x, y, vx, vy, target}
  blood: [], // Blood particles [{x, y, vx, vy, size, life}]
  gibs: [], // Flesh chunks [{x, y, vx, vy, rot, vrot, size, shape, color, life}]
};

// Spring physics for Happy Wheels style wobbly arms
const physics = {
  player: {
    position: 0,
    velocity: 0,
    target: 0,
  },
  ai: {
    position: 0,
    velocity: 0,
    target: 0,
  },
  // Spring constants - tweak for feel
  stiffness: 0.3,   // How fast it snaps to target
  damping: 0.6,     // How much it wobbles (lower = more wobble)
  maxVelocity: 0.15,
};

// Update spring physics each frame
function updatePhysics() {
  // Player arm spring
  const pSpring = physics.player;
  const pForce = (pSpring.target - pSpring.position) * physics.stiffness;
  pSpring.velocity += pForce;
  pSpring.velocity *= physics.damping;
  pSpring.velocity = Math.max(-physics.maxVelocity, Math.min(physics.maxVelocity, pSpring.velocity));
  pSpring.position += pSpring.velocity;
  state.playerArmDisplay = pSpring.position;

  // AI arm spring
  const aSpring = physics.ai;
  const aForce = (aSpring.target - aSpring.position) * physics.stiffness;
  aSpring.velocity += aForce;
  aSpring.velocity *= physics.damping;
  aSpring.velocity = Math.max(-physics.maxVelocity, Math.min(physics.maxVelocity, aSpring.velocity));
  aSpring.position += aSpring.velocity;
  state.aiArmDisplay = aSpring.position;
}

// Set player arm target (physics will animate to it)
function setPlayerArmTarget(target) {
  physics.player.target = target;
}

// Set AI arm target
function setAiArmTarget(target) {
  physics.ai.target = target;
}

// Ragdoll physics for death animation
// Hierarchical system: torso is root, limbs are offsets that rotate around attachment points
const ragdoll = {
  active: false,
  isPlayer: false,
  startTime: 0,
  baseX: 0,      // World X position of cowboy's feet
  baseY: 0,      // World Y position of cowboy's feet (ground level)

  // Torso is the ROOT - only this has world position/velocity
  torso: {
    x: 0, y: 0,           // Position relative to baseX, baseY
    vx: 0, vy: 0,         // Velocity
    rot: 0, vrot: 0,      // Rotation and angular velocity
  },

  // Limbs are attached to torso - they rotate around their attachment point
  // Each limb has: attachment point (relative to torso center), length, rotation
  head: { rot: 0, vrot: 0 },       // Attached at top of torso
  armGun: { rot: 0, vrot: 0 },     // Attached at shoulder
  armBack: { rot: 0, vrot: 0 },    // Attached at shoulder
  legL: { rot: 0, vrot: 0 },       // Attached at hip
  legR: { rot: 0, vrot: 0 },       // Attached at hip

  gravity: 0.6,
  groundY: 0,
  friction: 0.7,
  rotFriction: 0.95,
  wound: null,
}

function startRagdoll(isPlayer, baseX, groundY) {
  ragdoll.active = true;
  ragdoll.isPlayer = isPlayer;
  ragdoll.startTime = Date.now();
  ragdoll.groundY = groundY;
  ragdoll.baseX = baseX;
  ragdoll.baseY = groundY;

  const hitDir = isPlayer ? -1 : 1;
  const impactForce = 6 + Math.random() * 3;
  const upForce = -4 - Math.random() * 2;

  // Torso is the root - gets the main impact
  ragdoll.torso = {
    x: 0,
    y: -scale(50),  // Torso center starts at chest height
    vx: hitDir * impactForce,
    vy: upForce,
    rot: 0,
    vrot: hitDir * (0.08 + Math.random() * 0.06),
  };

  // Limbs get initial angular velocity to flop around
  ragdoll.head = { rot: 0, vrot: hitDir * (0.1 + Math.random() * 0.08) };
  ragdoll.armGun = { rot: hitDir * 0.2, vrot: hitDir * (0.15 + Math.random() * 0.1) };
  ragdoll.armBack = { rot: -hitDir * 0.2, vrot: hitDir * (0.1 + Math.random() * 0.08) };
  ragdoll.legL = { rot: 0, vrot: hitDir * (0.06 + Math.random() * 0.04) };
  ragdoll.legR = { rot: 0, vrot: hitDir * (0.08 + Math.random() * 0.05) };
}

function updateRagdoll() {
  if (!ragdoll.active) return;

  const s = scale(1);
  const t = ragdoll.torso;

  // Apply gravity to torso
  t.vy += ragdoll.gravity;

  // Apply velocity to torso
  t.x += t.vx;
  t.y += t.vy;
  t.rot += t.vrot;

  // Ground collision for torso (check against feet level, adjusted for torso height)
  const torsoBottom = t.y + s * 30; // Bottom of torso
  if (torsoBottom > 0) {
    t.y = -s * 30;
    t.vy *= -0.3; // Bounce
    t.vx *= ragdoll.friction;
    t.vrot *= 0.5;

    // Stop tiny bounces
    if (Math.abs(t.vy) < 1) {
      t.vy = 0;
    }
  }

  // Air friction
  t.vx *= 0.99;
  t.vrot *= ragdoll.rotFriction;

  // Update limb rotations - they swing based on torso movement and settle over time
  const limbs = ['head', 'armGun', 'armBack', 'legL', 'legR'];
  for (const limbName of limbs) {
    const limb = ragdoll[limbName];

    // Limbs swing in response to torso angular velocity
    limb.vrot += t.vrot * 0.3;

    // Add some gravity effect - limbs want to hang down
    const gravityPull = Math.sin(t.rot + limb.rot) * 0.02;
    limb.vrot += gravityPull;

    // Apply angular velocity
    limb.rot += limb.vrot;

    // Damping - limbs settle over time
    limb.vrot *= 0.94;

    // Clamp rotation to reasonable range
    limb.rot = Math.max(-Math.PI * 0.6, Math.min(Math.PI * 0.6, limb.rot));
  }

  // Blood spurting from wound
  if (ragdoll.wound && ragdoll.wound.intensity > 0) {
    const wound = ragdoll.wound;

    // Calculate world position of wound (attached to torso)
    const woundWorldX = ragdoll.baseX + t.x + wound.offsetX * Math.cos(t.rot);
    const woundWorldY = ragdoll.baseY + t.y + wound.offsetY;

    // Spawn blood spurts (fewer as intensity decreases)
    const spurtChance = wound.intensity * 0.6;
    if (Math.random() < spurtChance) {
      const numDrops = Math.floor(1 + Math.random() * 3 * wound.intensity);
      for (let i = 0; i < numDrops; i++) {
        // Blood spurts in bullet direction with some randomness
        const spread = (Math.random() - 0.5) * 1.5;
        const speed = 2 + Math.random() * 5 * wound.intensity;
        const angle = Math.atan2(wound.bulletVy, wound.bulletVx) + spread;

        state.blood.push({
          x: woundWorldX + (Math.random() - 0.5) * 10,
          y: woundWorldY + (Math.random() - 0.5) * 10,
          vx: Math.cos(angle) * speed + t.vx * 0.3,
          vy: Math.sin(angle) * speed + t.vy * 0.3 - 1,
          size: 2 + Math.random() * 4,
          life: 0.8 + Math.random() * 0.2,
        });
      }
    }

    // Decrease wound intensity over time
    wound.intensity -= 0.008;
    if (wound.intensity < 0) wound.intensity = 0;
  }
}

function resetRagdoll() {
  ragdoll.active = false;
  ragdoll.wound = null;

  // Reset torso
  ragdoll.torso = { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0 };

  // Reset limbs
  ragdoll.head = { rot: 0, vrot: 0 };
  ragdoll.armGun = { rot: 0, vrot: 0 };
  ragdoll.armBack = { rot: 0, vrot: 0 };
  ragdoll.legL = { rot: 0, vrot: 0 };
  ragdoll.legR = { rot: 0, vrot: 0 };
}

// Fire bullet from winner to loser
function fireBullet(fromX, fromY, toX, toY, isPlayerShooting) {
  const speed = 35;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  state.bullet = {
    x: fromX,
    y: fromY,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    targetX: toX,
    targetY: toY,
    isPlayerShooting: isPlayerShooting,
  };
}

// Update bullet physics
function updateBullet() {
  if (!state.bullet) return;

  const b = state.bullet;
  b.x += b.vx;
  b.y += b.vy;

  // Check if bullet reached target
  const dx = b.targetX - b.x;
  const dy = b.targetY - b.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 30) {
    // Impact!
    spawnBlood(b.x, b.y, b.vx, b.vy);
    spawnGibs(b.x, b.y, b.vx, b.vy); // Spawn flesh chunks

    // Start ragdoll with bullet direction
    const loserIsPlayer = !b.isPlayerShooting;
    const baseX = loserIsPlayer ? canvas.width * PLAYER_X : canvas.width * ENEMY_X;
    const baseY = canvas.height * GROUND_LEVEL;
    startRagdollWithImpact(loserIsPlayer, baseX, baseY, b.vx, b.vy, b.x, b.y);

    state.bullet = null;
  }
}

// Spawn blood particles at impact point
function spawnBlood(x, y, bulletVx, bulletVy) {
  const numParticles = 25 + Math.floor(Math.random() * 15);

  for (let i = 0; i < numParticles; i++) {
    // Spray mostly in bullet direction with spread
    const spread = (Math.random() - 0.5) * 2;
    const speed = 3 + Math.random() * 8;
    const angle = Math.atan2(bulletVy, bulletVx) + spread;

    state.blood.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 3,
      vy: Math.sin(angle) * speed + (Math.random() - 0.5) * 3 - 2,
      size: 3 + Math.random() * 6,
      life: 1.0,
    });
  }
}

// Update blood particles
function updateBlood() {
  const gravity = 0.4;
  const groundY = canvas.height * GROUND_LEVEL;

  for (let i = state.blood.length - 1; i >= 0; i--) {
    const p = state.blood[i];

    p.vy += gravity;
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.008;

    // Ground collision
    if (p.y > groundY) {
      p.y = groundY;
      p.vy *= -0.3;
      p.vx *= 0.8;
      p.life -= 0.05;
    }

    // Remove dead particles
    if (p.life <= 0) {
      state.blood.splice(i, 1);
    }
  }
}

// Draw bullet
function drawBullet() {
  if (!state.bullet) return;

  const b = state.bullet;
  ctx.fillStyle = '#444';
  ctx.beginPath();
  ctx.arc(b.x, b.y, scale(4), 0, Math.PI * 2);
  ctx.fill();

  // Bullet trail
  ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
  ctx.lineWidth = scale(2);
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - b.vx * 2, b.y - b.vy * 2);
  ctx.stroke();
}

// Draw blood particles
function drawBlood() {
  for (const p of state.blood) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = '#8B0000';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Spawn gibs (flesh chunks) at impact point
function spawnGibs(x, y, bulletVx, bulletVy) {
  const numGibs = 8 + Math.floor(Math.random() * 6);
  const gibColors = ['#8B0000', '#A52A2A', '#B22222', '#CD5C5C', '#E8B89D', '#D4A574'];

  for (let i = 0; i < numGibs; i++) {
    // Spray in bullet direction with spread
    const spread = (Math.random() - 0.5) * 2.5;
    const speed = 5 + Math.random() * 12;
    const angle = Math.atan2(bulletVy, bulletVx) + spread;

    // Random shape type: 0 = chunk, 1 = string/tendon, 2 = small bit
    const shapeType = Math.random() < 0.3 ? 1 : (Math.random() < 0.5 ? 2 : 0);

    state.gibs.push({
      x: x + (Math.random() - 0.5) * 30,
      y: y + (Math.random() - 0.5) * 30,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 4,
      vy: Math.sin(angle) * speed + (Math.random() - 0.5) * 4 - 3,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.4,
      size: shapeType === 1 ? 2 + Math.random() * 3 : (shapeType === 2 ? 3 + Math.random() * 4 : 6 + Math.random() * 10),
      shape: shapeType,
      color: gibColors[Math.floor(Math.random() * gibColors.length)],
      life: 1.0,
    });
  }
}

// Update gib physics
function updateGibs() {
  const gravity = 0.5;
  const groundY = canvas.height * GROUND_LEVEL;

  for (let i = state.gibs.length - 1; i >= 0; i--) {
    const g = state.gibs[i];

    g.vy += gravity;
    g.x += g.vx;
    g.y += g.vy;
    g.rot += g.vrot;
    g.life -= 0.003; // Gibs last longer than blood

    // Ground collision
    if (g.y > groundY) {
      g.y = groundY;
      g.vy *= -0.2; // Less bouncy than blood
      g.vx *= 0.7;
      g.vrot *= 0.5;

      // Stop tiny movements
      if (Math.abs(g.vy) < 0.5) {
        g.vy = 0;
        g.vrot = 0;
      }
    }

    // Remove dead gibs
    if (g.life <= 0) {
      state.gibs.splice(i, 1);
    }
  }
}

// Draw gibs
function drawGibs() {
  for (const g of state.gibs) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.rot);
    ctx.globalAlpha = Math.min(1, g.life * 2); // Fade out at end
    ctx.fillStyle = g.color;
    ctx.strokeStyle = '#4A0000';
    ctx.lineWidth = 1;

    if (g.shape === 0) {
      // Irregular chunk
      ctx.beginPath();
      ctx.moveTo(-g.size * 0.5, -g.size * 0.3);
      ctx.lineTo(g.size * 0.3, -g.size * 0.5);
      ctx.lineTo(g.size * 0.5, g.size * 0.2);
      ctx.lineTo(g.size * 0.1, g.size * 0.5);
      ctx.lineTo(-g.size * 0.4, g.size * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (g.shape === 1) {
      // String/tendon
      ctx.beginPath();
      ctx.moveTo(-g.size * 2, 0);
      ctx.quadraticCurveTo(0, g.size, g.size * 2, 0);
      ctx.lineWidth = g.size * 0.8;
      ctx.strokeStyle = g.color;
      ctx.stroke();
    } else {
      // Small round bit
      ctx.beginPath();
      ctx.arc(0, 0, g.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// Enhanced ragdoll with bullet impact direction
function startRagdollWithImpact(isPlayer, baseX, groundY, bulletVx, bulletVy, woundX, woundY) {
  ragdoll.active = true;
  ragdoll.isPlayer = isPlayer;
  ragdoll.startTime = Date.now();
  ragdoll.groundY = groundY;
  ragdoll.baseX = baseX;
  ragdoll.baseY = groundY;

  // Set up wound for blood spurting - attach to torso
  ragdoll.wound = {
    offsetX: woundX - baseX, // Offset from torso center
    offsetY: woundY - groundY + scale(50), // Offset from torso
    intensity: 1.0, // Blood flow intensity (decreases over time)
    bulletVx: bulletVx,
    bulletVy: bulletVy,
  };

  // Impact direction
  const hitDir = bulletVx > 0 ? 1 : -1;
  const impactForce = 8 + Math.random() * 4;
  const upForce = -5 - Math.random() * 3;

  // Torso is the root - gets the main impact
  ragdoll.torso = {
    x: 0,
    y: -scale(50),  // Torso center starts at chest height
    vx: hitDir * impactForce,
    vy: upForce,
    rot: 0,
    vrot: hitDir * (0.1 + Math.random() * 0.08),
  };

  // Limbs get initial angular velocity to flop around
  ragdoll.head = { rot: 0, vrot: hitDir * (0.12 + Math.random() * 0.1) };
  ragdoll.armGun = { rot: hitDir * 0.3, vrot: hitDir * (0.2 + Math.random() * 0.15) };
  ragdoll.armBack = { rot: -hitDir * 0.2, vrot: hitDir * (0.12 + Math.random() * 0.1) };
  ragdoll.legL = { rot: 0, vrot: hitDir * (0.08 + Math.random() * 0.06) };
  ragdoll.legR = { rot: 0, vrot: hitDir * (0.1 + Math.random() * 0.08) };
}

// Draw ragdolled cowboy - hierarchical: torso is root, limbs attach to it
function drawRagdoll(baseX, baseY, facingRight) {
  ctx.save();

  const s = scale(1);
  const dir = facingRight ? 1 : -1;
  const lineWidth = scale(3);

  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000';

  const t = ragdoll.torso;

  // World position of torso center
  const torsoX = baseX + t.x;
  const torsoY = baseY + t.y;
  const torsoRot = t.rot;

  // Helper to get attachment point position (relative to torso center, affected by torso rotation)
  function getAttachmentPoint(offsetX, offsetY) {
    const cos = Math.cos(torsoRot);
    const sin = Math.sin(torsoRot);
    return {
      x: torsoX + offsetX * cos - offsetY * sin,
      y: torsoY + offsetX * sin + offsetY * cos,
    };
  }

  // Draw legs (behind torso) - attached at hip
  const hipL = getAttachmentPoint(-s * 8, s * 25);
  const hipR = getAttachmentPoint(s * 8, s * 25);

  // Left leg
  ctx.save();
  ctx.translate(hipL.x, hipL.y);
  ctx.rotate(torsoRot + ragdoll.legL.rot);
  ctx.fillStyle = cowboyColors.pants;
  ctx.beginPath();
  ctx.roundRect(-s * 6, 0, s * 12, s * 30, s * 3);
  ctx.fill();
  ctx.stroke();
  // Boot
  ctx.fillStyle = cowboyColors.boots;
  ctx.beginPath();
  ctx.roundRect(-s * 8, s * 30, s * 16, s * 15, s * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Right leg
  ctx.save();
  ctx.translate(hipR.x, hipR.y);
  ctx.rotate(torsoRot + ragdoll.legR.rot);
  ctx.fillStyle = cowboyColors.pants;
  ctx.beginPath();
  ctx.roundRect(-s * 6, 0, s * 12, s * 30, s * 3);
  ctx.fill();
  ctx.stroke();
  // Boot
  ctx.fillStyle = cowboyColors.boots;
  ctx.beginPath();
  ctx.roundRect(-s * 8, s * 30, s * 16, s * 15, s * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Back arm - attached at back shoulder
  const shoulderBack = getAttachmentPoint(-dir * s * 12, -s * 20);
  ctx.save();
  ctx.translate(shoulderBack.x, shoulderBack.y);
  ctx.rotate(torsoRot + ragdoll.armBack.rot);
  ctx.fillStyle = cowboyColors.shirt;
  ctx.beginPath();
  ctx.roundRect(-s * 5, 0, s * 10, s * 25, s * 3);
  ctx.fill();
  ctx.stroke();
  // Hand
  ctx.fillStyle = cowboyColors.skin;
  ctx.beginPath();
  ctx.arc(0, s * 28, s * 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Torso
  ctx.save();
  ctx.translate(torsoX, torsoY);
  ctx.rotate(torsoRot);
  ctx.fillStyle = cowboyColors.shirt;
  ctx.beginPath();
  ctx.moveTo(-s * 15, -s * 25);
  ctx.lineTo(s * 15, -s * 25);
  ctx.lineTo(s * 12, s * 25);
  ctx.lineTo(-s * 12, s * 25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Vest
  ctx.fillStyle = cowboyColors.vest;
  ctx.beginPath();
  ctx.moveTo(dir * s * 5, -s * 25);
  ctx.lineTo(dir * s * 14, -s * 20);
  ctx.lineTo(dir * s * 10, s * 25);
  ctx.lineTo(dir * s * 5, s * 25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Gun arm - attached at front shoulder
  const shoulderGun = getAttachmentPoint(dir * s * 12, -s * 20);
  ctx.save();
  ctx.translate(shoulderGun.x, shoulderGun.y);
  ctx.rotate(torsoRot + ragdoll.armGun.rot);
  ctx.fillStyle = cowboyColors.shirt;
  ctx.beginPath();
  ctx.roundRect(-s * 5, 0, s * 10, s * 25, s * 3);
  ctx.fill();
  ctx.stroke();
  // Hand
  ctx.fillStyle = cowboyColors.skin;
  ctx.beginPath();
  ctx.arc(0, s * 28, s * 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Gun
  ctx.fillStyle = cowboyColors.gun;
  ctx.beginPath();
  ctx.roundRect(-s * 3, s * 25, s * 20, s * 6, s * 1);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Head - attached at top of torso
  const neckAttach = getAttachmentPoint(0, -s * 25);
  ctx.save();
  ctx.translate(neckAttach.x, neckAttach.y);
  ctx.rotate(torsoRot + ragdoll.head.rot);

  // Neck
  ctx.fillStyle = cowboyColors.skin;
  ctx.fillRect(-s * 5, -s * 10, s * 10, s * 12);
  ctx.strokeRect(-s * 5, -s * 10, s * 10, s * 12);

  // Head
  ctx.fillStyle = cowboyColors.skin;
  ctx.beginPath();
  ctx.ellipse(0, -s * 25, s * 18, s * 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // X eyes (dead)
  ctx.strokeStyle = '#000';
  ctx.lineWidth = scale(2);
  // Left X
  ctx.beginPath();
  ctx.moveTo(-s * 8, -s * 30);
  ctx.lineTo(-s * 2, -s * 24);
  ctx.moveTo(-s * 2, -s * 30);
  ctx.lineTo(-s * 8, -s * 24);
  ctx.stroke();
  // Right X
  ctx.beginPath();
  ctx.moveTo(s * 2, -s * 30);
  ctx.lineTo(s * 8, -s * 24);
  ctx.moveTo(s * 8, -s * 30);
  ctx.lineTo(s * 2, -s * 24);
  ctx.stroke();

  ctx.strokeStyle = '#000';
  ctx.lineWidth = lineWidth;

  // Hat (tilted/falling off)
  ctx.fillStyle = cowboyColors.hat;
  ctx.beginPath();
  ctx.ellipse(s * 3, -s * 42, s * 28, s * 7, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Crown
  ctx.beginPath();
  ctx.moveTo(-s * 10, -s * 42);
  ctx.lineTo(-s * 6, -s * 65);
  ctx.lineTo(s * 16, -s * 63);
  ctx.lineTo(s * 18, -s * 40);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  ctx.restore();
}

// AI settings
const ai = {
  baseWPM: 25,
  wpmPerStreak: 3,
  maxWPM: 80,
  lastTypeTime: 0,
};

// Sentence lists - short to medium length
const sentences = {
  short: [
    'draw now',
    'hands up',
    'stand back',
    'hold it there',
    'drop the gun',
    'nice and slow',
    "don't move",
    'step aside',
    'you lose',
    'too slow',
    "it's over",
    "let's go",
  ],
  medium: [
    "this town ain't big enough",
    'reach for the sky partner',
    'you picked the wrong day',
    'make your move cowboy',
    'the sun sets on you',
    'say your prayers outlaw',
    'end of the line friend',
    'justice comes for all',
    "your luck's run out",
    "time to meet your maker",
    "you shouldn't have come here",
    "i've been expecting you",
  ],
  long: [
    "there ain't room for both of us in this town",
    "you should've stayed out of my territory",
    'the wanted poster said dead or alive',
    "i've been waiting a long time for this",
    "they don't call me quickdraw for nothing",
    "you rode into the wrong saloon partner",
    "the sheriff warned you to leave by sundown",
    "every outlaw meets their end eventually",
    "this dusty road ends right here right now",
    "you thought you could outrun the law forever",
    "i reckon you've made your last mistake",
    "there's only one way this ends partner",
  ],
};

function generateWord(streak) {
  if (streak < 3) {
    return sentences.short[Math.floor(Math.random() * sentences.short.length)];
  } else if (streak < 7) {
    return sentences.medium[Math.floor(Math.random() * sentences.medium.length)];
  } else {
    return sentences.long[Math.floor(Math.random() * sentences.long.length)];
  }
}

function getAITypeInterval() {
  const wpm = Math.min(ai.baseWPM + (state.winStreak * ai.wpmPerStreak), ai.maxWPM);
  const cpm = wpm * 5;
  const variance = 0.8 + Math.random() * 0.4;
  return (60000 / cpm) * variance;
}

// Draw background image (scaled to cover canvas)
function drawBackground() {
  const w = canvas.width;
  const h = canvas.height;

  if (backgroundLoaded) {
    // Draw the background image scaled to cover the canvas
    // The image will be stretched to fit the canvas dimensions
    ctx.drawImage(backgroundImage, 0, 0, w, h);
  } else {
    // Fallback solid color while image loads
    ctx.fillStyle = '#c9a66b';
    ctx.fillRect(0, 0, w, h);
  }
}

// Scale factor based on canvas height (base design is 400px tall)
function scale(val) {
  return val * (canvas.height / 400);
}

// Draw Happy Wheels style cowboy with segmented parts
function drawCowboy(x, y, facingRight, armProgress, isPlayer) {
  ctx.save();

  const dir = facingRight ? 1 : -1;
  const s = scale(1); // Base scale factor
  const lineWidth = scale(3);

  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000';

  // Helper to draw outlined shape
  function drawShape(fillColor, drawFn) {
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    drawFn();
    ctx.fill();
    ctx.stroke();
  }

  // Positions relative to x, y (y is at feet)
  const footY = y;
  const legHeight = s * 45;
  const torsoHeight = s * 50;
  const headY = footY - legHeight - torsoHeight;
  const torsoY = footY - legHeight;
  const hipY = torsoY;
  const shoulderY = headY + s * 15;

  // === LEGS ===
  // Left leg (back leg)
  drawShape(cowboyColors.pants, () => {
    ctx.moveTo(x - dir * s * 8, hipY);
    ctx.lineTo(x - dir * s * 12, footY - s * 15);
    ctx.lineTo(x - dir * s * 8, footY - s * 15);
    ctx.lineTo(x - dir * s * 5, hipY);
    ctx.closePath();
  });

  // Left boot
  drawShape(cowboyColors.boots, () => {
    ctx.moveTo(x - dir * s * 12, footY - s * 15);
    ctx.lineTo(x - dir * s * 15, footY);
    ctx.lineTo(x - dir * s * 5, footY);
    ctx.lineTo(x - dir * s * 8, footY - s * 15);
    ctx.closePath();
  });

  // Right leg (front leg)
  drawShape(cowboyColors.pants, () => {
    ctx.moveTo(x + dir * s * 5, hipY);
    ctx.lineTo(x + dir * s * 2, footY - s * 15);
    ctx.lineTo(x + dir * s * 10, footY - s * 15);
    ctx.lineTo(x + dir * s * 8, hipY);
    ctx.closePath();
  });

  // Right boot
  drawShape(cowboyColors.boots, () => {
    ctx.moveTo(x + dir * s * 2, footY - s * 15);
    ctx.lineTo(x + dir * s * 0, footY);
    ctx.lineTo(x + dir * s * 12, footY);
    ctx.lineTo(x + dir * s * 10, footY - s * 15);
    ctx.closePath();
  });

  // === TORSO ===
  drawShape(cowboyColors.shirt, () => {
    ctx.moveTo(x - dir * s * 15, shoulderY);
    ctx.lineTo(x + dir * s * 18, shoulderY);
    ctx.lineTo(x + dir * s * 12, hipY);
    ctx.lineTo(x - dir * s * 10, hipY);
    ctx.closePath();
  });

  // Vest
  drawShape(cowboyColors.vest, () => {
    ctx.moveTo(x + dir * s * 5, shoulderY);
    ctx.lineTo(x + dir * s * 16, shoulderY + s * 5);
    ctx.lineTo(x + dir * s * 10, hipY);
    ctx.lineTo(x + dir * s * 5, hipY);
    ctx.closePath();
  });

  // === BACK ARM (non-gun arm) ===
  const backArmX = x - dir * s * 12;
  drawShape(cowboyColors.shirt, () => {
    ctx.moveTo(backArmX, shoulderY + s * 5);
    ctx.lineTo(backArmX - dir * s * 5, shoulderY + s * 25);
    ctx.lineTo(backArmX - dir * s * 2, shoulderY + s * 28);
    ctx.lineTo(backArmX + dir * s * 3, shoulderY + s * 8);
    ctx.closePath();
  });
  // Back hand
  drawShape(cowboyColors.skin, () => {
    ctx.arc(backArmX - dir * s * 3, shoulderY + s * 30, s * 6, 0, Math.PI * 2);
  });

  // === HEAD ===
  // Neck
  drawShape(cowboyColors.skin, () => {
    ctx.fillRect(x + dir * s * 2 - s * 5, headY + s * 5, s * 10, s * 12);
    ctx.strokeRect(x + dir * s * 2 - s * 5, headY + s * 5, s * 10, s * 12);
  });

  // Head shape
  drawShape(cowboyColors.skin, () => {
    ctx.ellipse(x + dir * s * 2, headY - s * 10, s * 18, s * 20, 0, 0, Math.PI * 2);
  });

  // Eye
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x + dir * s * 10, headY - s * 12, s * 3, s * 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyebrow (determined look)
  ctx.beginPath();
  ctx.moveTo(x + dir * s * 5, headY - s * 20);
  ctx.lineTo(x + dir * s * 14, headY - s * 17);
  ctx.stroke();

  // Nose
  ctx.beginPath();
  ctx.moveTo(x + dir * s * 15, headY - s * 10);
  ctx.lineTo(x + dir * s * 18, headY - s * 5);
  ctx.lineTo(x + dir * s * 14, headY - s * 3);
  ctx.stroke();

  // Mouth (slight smirk)
  ctx.beginPath();
  ctx.moveTo(x + dir * s * 8, headY + s * 2);
  ctx.quadraticCurveTo(x + dir * s * 14, headY + s * 5, x + dir * s * 16, headY + s * 2);
  ctx.stroke();

  // === COWBOY HAT ===
  // Hat brim
  drawShape(cowboyColors.hat, () => {
    ctx.ellipse(x + dir * s * 2, headY - s * 25, s * 30, s * 8, 0, 0, Math.PI * 2);
  });

  // Hat crown
  drawShape(cowboyColors.hat, () => {
    ctx.moveTo(x - dir * s * 12, headY - s * 25);
    ctx.lineTo(x - dir * s * 8, headY - s * 50);
    ctx.lineTo(x + dir * s * 15, headY - s * 50);
    ctx.lineTo(x + dir * s * 18, headY - s * 25);
    ctx.closePath();
  });

  // Hat band
  ctx.fillStyle = cowboyColors.hatBand;
  ctx.fillRect(x - dir * s * 10, headY - s * 30, s * 26, s * 5);
  ctx.strokeRect(x - dir * s * 10, headY - s * 30, s * 26, s * 5);

  // === GUN ARM (animates based on progress) ===
  // Arm rotates from down by side (90deg down) to horizontal shooting position (0deg)
  const armPivotX = x + dir * s * 15;
  const armPivotY = shoulderY + s * 8;

  // Angle: 90 degrees (straight down) to 0 degrees (horizontal, pointing at opponent)
  const startAngle = facingRight ? 90 : 90;
  const endAngle = facingRight ? 0 : 180;
  const armAngle = startAngle + (endAngle - startAngle) * armProgress;
  const armRad = armAngle * Math.PI / 180;

  const upperArmLen = s * 25;
  const lowerArmLen = s * 25;

  // Upper arm end point
  const elbowX = armPivotX + Math.cos(armRad) * upperArmLen;
  const elbowY = armPivotY + Math.sin(armRad) * upperArmLen;

  // Lower arm - slight bend
  const forearmAngle = armRad + (facingRight ? 0.3 : -0.3);
  const handX = elbowX + Math.cos(forearmAngle) * lowerArmLen;
  const handY = elbowY + Math.sin(forearmAngle) * lowerArmLen;

  // Draw upper arm
  ctx.fillStyle = cowboyColors.shirt;
  ctx.beginPath();
  ctx.moveTo(armPivotX - Math.sin(armRad) * s * 6, armPivotY + Math.cos(armRad) * s * 6);
  ctx.lineTo(armPivotX + Math.sin(armRad) * s * 6, armPivotY - Math.cos(armRad) * s * 6);
  ctx.lineTo(elbowX + Math.sin(armRad) * s * 5, elbowY - Math.cos(armRad) * s * 5);
  ctx.lineTo(elbowX - Math.sin(armRad) * s * 5, elbowY + Math.cos(armRad) * s * 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw forearm
  ctx.fillStyle = cowboyColors.shirt;
  ctx.beginPath();
  ctx.moveTo(elbowX - Math.sin(forearmAngle) * s * 5, elbowY + Math.cos(forearmAngle) * s * 5);
  ctx.lineTo(elbowX + Math.sin(forearmAngle) * s * 5, elbowY - Math.cos(forearmAngle) * s * 5);
  ctx.lineTo(handX + Math.sin(forearmAngle) * s * 4, handY - Math.cos(forearmAngle) * s * 4);
  ctx.lineTo(handX - Math.sin(forearmAngle) * s * 4, handY + Math.cos(forearmAngle) * s * 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Hand
  drawShape(cowboyColors.skin, () => {
    ctx.arc(handX, handY, s * 7, 0, Math.PI * 2);
  });

  // Gun
  const gunAngle = forearmAngle;
  const gunLen = s * 25;
  const gunEndX = handX + Math.cos(gunAngle) * gunLen;
  const gunEndY = handY + Math.sin(gunAngle) * gunLen;

  // Gun barrel
  ctx.fillStyle = cowboyColors.gun;
  ctx.beginPath();
  ctx.moveTo(handX - Math.sin(gunAngle) * s * 4, handY + Math.cos(gunAngle) * s * 4);
  ctx.lineTo(handX + Math.sin(gunAngle) * s * 4, handY - Math.cos(gunAngle) * s * 4);
  ctx.lineTo(gunEndX + Math.sin(gunAngle) * s * 2, gunEndY - Math.cos(gunAngle) * s * 2);
  ctx.lineTo(gunEndX - Math.sin(gunAngle) * s * 2, gunEndY + Math.cos(gunAngle) * s * 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Gun handle
  const handleAngle = gunAngle + (facingRight ? Math.PI / 2 : -Math.PI / 2);
  const handleX = handX + Math.cos(handleAngle) * s * 10;
  const handleY = handY + Math.sin(handleAngle) * s * 10;

  ctx.fillStyle = cowboyColors.vest;
  ctx.beginPath();
  ctx.moveTo(handX - Math.sin(handleAngle) * s * 4, handY + Math.cos(handleAngle) * s * 4);
  ctx.lineTo(handX + Math.sin(handleAngle) * s * 4, handY - Math.cos(handleAngle) * s * 4);
  ctx.lineTo(handleX + Math.sin(handleAngle) * s * 3, handleY - Math.cos(handleAngle) * s * 3);
  ctx.lineTo(handleX - Math.sin(handleAngle) * s * 3, handleY + Math.cos(handleAngle) * s * 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Gun cylinder
  ctx.fillStyle = cowboyColors.gunHighlight;
  ctx.beginPath();
  ctx.arc(handX + Math.cos(gunAngle) * s * 5, handY + Math.sin(gunAngle) * s * 5, s * 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// Draw outlined text
function drawOutlinedText(text, x, y, fontSize, fillColor) {
  const scaledSize = scale(fontSize);
  ctx.font = `bold ${scaledSize}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const offset = scale(3);

  // Drop shadow
  ctx.fillStyle = '#000';
  ctx.fillText(text, x + offset, y + offset);

  // Outline
  ctx.strokeStyle = '#000';
  ctx.lineWidth = scale(4);
  ctx.strokeText(text, x, y);

  // Fill
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
}

// Draw word with character coloring
function drawWord(word, typed, x, y, fontSize) {
  const scaledSize = scale(fontSize);
  ctx.font = `bold ${scaledSize}px "Courier New", monospace`;
  const charWidth = ctx.measureText('W').width;
  const totalWidth = word.length * charWidth;
  let startX = x - totalWidth / 2;

  let shakeX = 0, shakeY = 0;
  const shaking = Date.now() < state.errorShakeUntil;
  if (shaking) {
    shakeX = (Math.random() - 0.5) * scale(16);
    shakeY = (Math.random() - 0.5) * scale(16);
  }

  const offset = scale(3);

  for (let i = 0; i < word.length; i++) {
    let fillColor = colors.textPrimary;
    let displayChar = word[i];

    if (i < typed.length) {
      // Already typed - show green
      fillColor = colors.textCorrect;
    } else if (i === typed.length && state.wrongChar && shaking) {
      // Current position with error - show the expected char in red
      fillColor = colors.textError;
    }

    const charX = startX + i * charWidth + charWidth / 2 + shakeX;
    const charY = y + shakeY;

    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.fillText(displayChar, charX + offset, charY + offset);

    ctx.strokeStyle = '#000';
    ctx.lineWidth = scale(3);
    ctx.strokeText(displayChar, charX, charY);

    ctx.fillStyle = fillColor;
    ctx.fillText(displayChar, charX, charY);
  }
}

// Draw muzzle flash
function drawMuzzleFlash(x, y) {
  if (Date.now() < state.muzzleFlashUntil) {
    ctx.fillStyle = '#FFFF00';
    ctx.beginPath();
    ctx.arc(x, y, scale(18), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, scale(8), 0, Math.PI * 2);
    ctx.fill();
  }
}

// Draw streak counter
function drawStreak() {
  ctx.font = `bold ${scale(28)}px "Courier New", monospace`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';

  // Shadow
  ctx.fillStyle = '#000';
  ctx.fillText(`${state.winStreak}`, canvas.width - scale(17), scale(23));

  ctx.fillStyle = colors.textStreak;
  ctx.fillText(`${state.winStreak}`, canvas.width - scale(20), scale(20));

  // Star
  ctx.fillStyle = colors.textStreak;
  ctx.font = `${scale(24)}px serif`;
  ctx.fillText('\u2605', canvas.width - scale(50), scale(20));
}

// Main draw
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawAtmosphere();

  // Cowboys positioned relative to canvas (25% and 75% width, 80% height)
  const playerX = canvas.width * PLAYER_X;
  const enemyX = canvas.width * ENEMY_X;
  const cowboyY = canvas.height * GROUND_LEVEL;

  // Draw cowboys - use ragdoll for the loser
  if (ragdoll.active && ragdoll.isPlayer) {
    drawRagdoll(playerX, cowboyY, true);
  } else {
    drawCowboy(playerX, cowboyY, true, state.playerArmDisplay, true);
  }

  if (ragdoll.active && !ragdoll.isPlayer) {
    drawRagdoll(enemyX, cowboyY, false);
  } else {
    drawCowboy(enemyX, cowboyY, false, state.aiArmDisplay, false);
  }

  // Muzzle flash (positioned at gun height)
  if (state.phase === 'finished' && state.winner) {
    const flashX = state.winner === 'player' ? playerX + scale(70) : enemyX - scale(70);
    drawMuzzleFlash(flashX, cowboyY - scale(80));
  }

  // Draw bullet, blood and gibs
  drawBullet();
  drawBlood();
  drawGibs();

  drawStreak();

  const centerX = canvas.width / 2;
  const bottomY = canvas.height * 0.90;

  // UI text
  if (state.phase === 'idle') {
    drawOutlinedText('Press Space to Start', centerX, scale(100), 44, colors.textPrimary);
    ctx.font = `${scale(18)}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText('Type the sentence when you see DRAW!', centerX + scale(2), bottomY + scale(2));
    ctx.fillStyle = '#FFF';
    ctx.fillText('Type the sentence when you see DRAW!', centerX, bottomY);

  } else if (state.phase === 'countdown') {
    // Center countdown on the sun/moon
    const palette = skyPalettes[state.currentBg % skyPalettes.length];
    const sunY = canvas.height * palette.sunY;
    drawOutlinedText(state.countdownValue.toString(), centerX, sunY, 80, '#FFF');

  } else if (state.phase === 'playing') {
    if (state.currentWord) {
      drawWord(state.currentWord, state.playerTyped, centerX, scale(120), 56);
    }

  } else if (state.phase === 'finished') {
    if (state.winner === 'player') {
      drawOutlinedText('YOU WIN!', centerX, scale(80), 64, colors.textCorrect);
    } else {
      drawOutlinedText('YOU LOSE!', centerX, scale(80), 64, colors.textError);
    }

    if (state.currentWord) {
      drawWord(state.currentWord, state.playerTyped, centerX, scale(150), 48);
    }

    if (!state.showingResult) {
      ctx.font = `${scale(18)}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText('Press Space or Enter to continue', centerX + scale(2), bottomY + scale(2));
      ctx.fillStyle = '#FFF';
      ctx.fillText('Press Space or Enter to continue', centerX, bottomY);
    }
  }
}

// Clear all pending timers
function clearAllTimers() {
  if (state.countdownInterval) {
    clearInterval(state.countdownInterval);
    state.countdownInterval = null;
  }
  state.timeouts.forEach(t => clearTimeout(t));
  state.timeouts = [];
}

// Add a tracked timeout
function addTimeout(fn, delay) {
  const id = setTimeout(() => {
    // Remove from tracking array when it fires
    state.timeouts = state.timeouts.filter(t => t !== id);
    fn();
  }, delay);
  state.timeouts.push(id);
  return id;
}

function startCountdown() {
  // Clear ALL existing timers first
  clearAllTimers();

  // Reset all state
  state.phase = 'countdown';
  state.countdownValue = 3;
  state.currentWord = '';
  state.playerTyped = '';
  state.playerProgress = 0;
  state.playerArmDisplay = 0;
  state.playerErrors = 0;
  state.aiProgress = 0;
  state.aiArmDisplay = 0;
  state.aiTyped = '';
  state.winner = null;
  state.playerFinishTime = null;
  state.aiFinishTime = null;
  state.showDraw = false;
  state.showingResult = false;
  state.errorShakeUntil = 0;
  state.muzzleFlashUntil = 0;
  state.wrongChar = null;
  state.bullet = null;
  state.blood = [];
  state.gibs = [];

  // Reset physics
  physics.player.position = 0;
  physics.player.velocity = 0;
  physics.player.target = 0;
  physics.ai.position = 0;
  physics.ai.velocity = 0;
  physics.ai.target = 0;

  // Reset ragdoll
  resetRagdoll();

  // Cycle to next background
  state.currentBg = (state.currentBg + 1) % skyPalettes.length;

  hiddenInput.value = '';
  hiddenInput.focus();

  // Start countdown interval
  state.countdownInterval = setInterval(() => {
    // Safety check - only proceed if we're still in countdown phase
    if (state.phase !== 'countdown') {
      clearInterval(state.countdownInterval);
      state.countdownInterval = null;
      return;
    }

    state.countdownValue--;
    if (state.countdownValue < 1) {
      clearInterval(state.countdownInterval);
      state.countdownInterval = null;
      startRound();
    }
  }, 1000);
}

function startRound() {
  // Safety check
  if (state.phase !== 'countdown') return;

  state.phase = 'playing';
  state.currentWord = generateWord(state.winStreak);
  state.roundStartTime = Date.now();
  ai.lastTypeTime = Date.now();
}

function handleInput(e) {
  if (state.phase !== 'playing') return;
  if (state.playerFinishTime !== null) return; // Already finished

  const inputVal = hiddenInput.value.toLowerCase();
  const correctSoFar = state.playerTyped;

  // If nothing new typed, ignore
  if (inputVal.length <= correctSoFar.length) {
    hiddenInput.value = correctSoFar;
    return;
  }

  // Check the newly typed character(s)
  const nextExpected = state.currentWord[correctSoFar.length];
  let advanced = false;

  for (let i = correctSoFar.length; i < inputVal.length; i++) {
    if (inputVal[i] === nextExpected) {
      // Correct character - advance
      state.playerTyped = correctSoFar + nextExpected;
      state.wrongChar = null;
      advanced = true;
      break;
    } else {
      // Wrong character - show error
      state.wrongChar = inputVal[i];
      state.errorShakeUntil = Date.now() + 300;
      state.playerErrors++;
    }
  }

  // Sync input to correct portion
  hiddenInput.value = state.playerTyped;

  // Update progress
  const newProgress = state.playerTyped.length / state.currentWord.length;
  state.playerProgress = newProgress;
  setPlayerArmTarget(newProgress);

  // Check for completion
  if (state.playerTyped.length === state.currentWord.length) {
    state.playerFinishTime = Date.now();
    state.playerProgress = 1;
    setPlayerArmTarget(1);
    checkWinner();
  }
}

function updateAI() {
  if (state.phase !== 'playing') return;
  if (state.aiProgress >= 1) return;

  const now = Date.now();
  const interval = getAITypeInterval();

  if (now - ai.lastTypeTime >= interval) {
    ai.lastTypeTime = now;
    state.aiTyped += state.currentWord[state.aiTyped.length];
    state.aiProgress = state.aiTyped.length / state.currentWord.length;
    setAiArmTarget(state.aiProgress);

    if (state.aiTyped === state.currentWord) {
      state.aiFinishTime = Date.now();
      state.aiProgress = 1;
      setAiArmTarget(1);
      checkWinner();
    }
  }
}

function checkWinner() {
  if (state.winner) return;

  const playerDone = state.playerFinishTime !== null;
  const aiDone = state.aiFinishTime !== null;

  if (!playerDone && !aiDone) return;

  if (playerDone && !aiDone) {
    endRound('player');
    return;
  }
  if (aiDone && !playerDone) {
    endRound('ai');
    return;
  }

  const timeDiff = Math.abs(state.playerFinishTime - state.aiFinishTime);

  if (timeDiff > 200) {
    endRound(state.playerFinishTime < state.aiFinishTime ? 'player' : 'ai');
  } else {
    endRound(state.playerErrors === 0 ? 'player' : 'ai');
  }
}

function endRound(winner) {
  // Safety check - only end if we're playing
  if (state.phase !== 'playing') return;

  state.phase = 'finished';
  state.winner = winner;
  state.showingResult = true;
  state.muzzleFlashUntil = Date.now() + 150;
  state.roundEndTime = Date.now();

  // Fire bullet from winner to loser
  const playerX = canvas.width * PLAYER_X;
  const enemyX = canvas.width * ENEMY_X;
  const cowboyY = canvas.height * GROUND_LEVEL;
  const gunHeight = cowboyY - scale(60); // Approximate gun height

  if (winner === 'player') {
    state.winStreak++;
    // Player shoots AI
    fireBullet(playerX + scale(50), gunHeight, enemyX, gunHeight, true);
  } else {
    state.winStreak = 0;
    // AI shoots player
    fireBullet(enemyX - scale(50), gunHeight, playerX, gunHeight, false);
  }

  addTimeout(() => {
    if (state.phase === 'finished') {
      state.showingResult = false;
    }
  }, 1500);

  addTimeout(() => {
    if (state.phase === 'finished') {
      state.phase = 'idle';
    }
  }, 2500);
}

function gameLoop() {
  updateAI();
  updatePhysics();
  updateBullet();
  updateBlood();
  updateGibs();
  updateRagdoll();
  updateAtmosphere();
  draw();
  requestAnimationFrame(gameLoop);
}

canvas.addEventListener('click', () => {
  if (state.phase === 'idle') {
    startCountdown();
  }
});

document.addEventListener('click', () => {
  if (state.phase === 'idle') {
    startCountdown();
  }
  hiddenInput.focus();
});

hiddenInput.addEventListener('input', handleInput);

hiddenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
  }
});

document.addEventListener('keydown', (e) => {
  if (state.phase === 'playing') {
    hiddenInput.focus();
  }

  // Space or Enter to continue after round (works in idle or finished state)
  // 1 second delay after round ends before allowing continue
  const canContinue = state.phase === 'idle' ||
    (state.phase === 'finished' && Date.now() - state.roundEndTime >= 1000);

  if (canContinue && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    startCountdown();
  }
});

console.log('Quick Draw loaded!');
initAtmosphere();
draw();
gameLoop();
