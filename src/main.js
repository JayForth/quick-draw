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
const ragdoll = {
  active: false,
  isPlayer: false,
  startTime: 0,
  // Body parts with position offsets from base, velocity, and rotation
  parts: {
    head: { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0 },
    torso: { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0 },
    armGun: { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0 },
    armBack: { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0 },
    legL: { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0 },
    legR: { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0 },
  },
  gravity: 0.8,
  groundY: 0, // Set when ragdoll starts
  friction: 0.85,
  baseX: 0, // Base position for wound tracking
  baseY: 0,
  wound: null, // Wound location for blood spurting {partName, offsetX, offsetY, intensity}
};

function startRagdoll(isPlayer, baseX, groundY) {
  ragdoll.active = true;
  ragdoll.isPlayer = isPlayer;
  ragdoll.startTime = Date.now();
  ragdoll.groundY = groundY;

  const dir = isPlayer ? 1 : -1; // Direction they're facing
  const hitDir = isPlayer ? -1 : 1; // Direction of impact (opposite)

  // Initialize all parts at origin with impact velocities
  const impactForce = 8 + Math.random() * 4;
  const upForce = -6 - Math.random() * 3;

  ragdoll.parts.head = {
    x: 0, y: 0,
    vx: hitDir * (impactForce + Math.random() * 3),
    vy: upForce - 2,
    rot: 0,
    vrot: hitDir * (0.2 + Math.random() * 0.15),
  };
  ragdoll.parts.torso = {
    x: 0, y: 0,
    vx: hitDir * impactForce,
    vy: upForce,
    rot: 0,
    vrot: hitDir * (0.1 + Math.random() * 0.1),
  };
  ragdoll.parts.armGun = {
    x: 0, y: 0,
    vx: hitDir * (impactForce + 2),
    vy: upForce - 3,
    rot: 0,
    vrot: hitDir * (0.3 + Math.random() * 0.2),
  };
  ragdoll.parts.armBack = {
    x: 0, y: 0,
    vx: hitDir * (impactForce - 2),
    vy: upForce + 1,
    rot: 0,
    vrot: hitDir * (0.15 + Math.random() * 0.1),
  };
  ragdoll.parts.legL = {
    x: 0, y: 0,
    vx: hitDir * (impactForce - 1),
    vy: upForce + 2,
    rot: 0,
    vrot: hitDir * (0.1 + Math.random() * 0.15),
  };
  ragdoll.parts.legR = {
    x: 0, y: 0,
    vx: hitDir * (impactForce + 1),
    vy: upForce + 1,
    rot: 0,
    vrot: hitDir * (0.12 + Math.random() * 0.1),
  };
}

function updateRagdoll() {
  if (!ragdoll.active) return;

  const s = scale(1);
  const groundLevel = 0; // Parts y=0 is at cowboy feet level

  for (const partName in ragdoll.parts) {
    const part = ragdoll.parts[partName];

    // Apply gravity
    part.vy += ragdoll.gravity;

    // Apply velocity
    part.x += part.vx;
    part.y += part.vy;
    part.rot += part.vrot;

    // Ground collision
    if (part.y > groundLevel) {
      part.y = groundLevel;
      part.vy *= -0.3; // Bounce
      part.vx *= ragdoll.friction;
      part.vrot *= 0.7;

      // Stop tiny bounces
      if (Math.abs(part.vy) < 1) {
        part.vy = 0;
      }
    }

    // Air friction
    part.vx *= 0.99;
    part.vrot *= 0.98;
  }

  // Blood spurting from wound
  if (ragdoll.wound && ragdoll.wound.intensity > 0) {
    const wound = ragdoll.wound;
    const part = ragdoll.parts[wound.partName];

    // Calculate world position of wound
    const woundWorldX = ragdoll.baseX + part.x + wound.offsetX;
    const woundWorldY = ragdoll.baseY + part.y + wound.offsetY;

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
          vx: Math.cos(angle) * speed + part.vx * 0.3,
          vy: Math.sin(angle) * speed + part.vy * 0.3 - 1,
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
  for (const partName in ragdoll.parts) {
    const part = ragdoll.parts[partName];
    part.x = 0;
    part.y = 0;
    part.vx = 0;
    part.vy = 0;
    part.rot = 0;
    part.vrot = 0;
  }
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
    partName: 'torso',
    offsetX: woundX - baseX, // Offset from torso center
    offsetY: woundY - groundY + scale(50), // Offset from torso (adjusted for torso Y)
    intensity: 1.0, // Blood flow intensity (decreases over time)
    bulletVx: bulletVx,
    bulletVy: bulletVy,
  };

  // Impact force based on bullet direction
  const impactForce = 12;
  const impactX = bulletVx > 0 ? impactForce : -impactForce;
  const impactY = -8;

  // Each part gets slightly different velocities for realistic ragdoll
  ragdoll.parts.head = {
    x: 0, y: -scale(80),
    vx: impactX * 1.2 + (Math.random() - 0.5) * 4,
    vy: impactY - 4 + Math.random() * 2,
    rot: 0,
    vrot: (bulletVx > 0 ? 1 : -1) * (0.2 + Math.random() * 0.2),
  };
  ragdoll.parts.torso = {
    x: 0, y: -scale(50),
    vx: impactX + (Math.random() - 0.5) * 2,
    vy: impactY + Math.random() * 2,
    rot: 0,
    vrot: (bulletVx > 0 ? 1 : -1) * (0.1 + Math.random() * 0.1),
  };
  ragdoll.parts.armGun = {
    x: 0, y: -scale(60),
    vx: impactX * 1.3 + (Math.random() - 0.5) * 3,
    vy: impactY - 2 + Math.random() * 3,
    rot: 0,
    vrot: (bulletVx > 0 ? 1 : -1) * (0.25 + Math.random() * 0.2),
  };
  ragdoll.parts.armBack = {
    x: 0, y: -scale(60),
    vx: impactX * 0.8 + (Math.random() - 0.5) * 3,
    vy: impactY + 1 + Math.random() * 2,
    rot: 0,
    vrot: (bulletVx > 0 ? 1 : -1) * (0.15 + Math.random() * 0.15),
  };
  ragdoll.parts.legL = {
    x: -scale(10), y: -scale(20),
    vx: impactX * 0.6 + (Math.random() - 0.5) * 2,
    vy: impactY + 3 + Math.random() * 2,
    rot: 0,
    vrot: (bulletVx > 0 ? 1 : -1) * (0.1 + Math.random() * 0.1),
  };
  ragdoll.parts.legR = {
    x: scale(10), y: -scale(20),
    vx: impactX * 0.7 + (Math.random() - 0.5) * 2,
    vy: impactY + 2 + Math.random() * 2,
    rot: 0,
    vrot: (bulletVx > 0 ? 1 : -1) * (0.12 + Math.random() * 0.1),
  };
}

// Draw ragdolled cowboy
function drawRagdoll(baseX, baseY, facingRight) {
  ctx.save();

  const s = scale(1);
  const dir = facingRight ? 1 : -1;
  const lineWidth = scale(3);

  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000';

  const p = ragdoll.parts;

  // Helper to draw a rotated body part
  function drawPart(part, drawFn) {
    ctx.save();
    ctx.translate(baseX + part.x, baseY + part.y);
    ctx.rotate(part.rot);
    drawFn();
    ctx.restore();
  }

  // Draw legs (behind torso)
  // Left leg
  drawPart(p.legL, () => {
    ctx.fillStyle = cowboyColors.pants;
    ctx.beginPath();
    ctx.roundRect(-s * 6, -s * 45, s * 12, s * 30, s * 3);
    ctx.fill();
    ctx.stroke();
    // Boot
    ctx.fillStyle = cowboyColors.boots;
    ctx.beginPath();
    ctx.roundRect(-s * 8, -s * 15, s * 16, s * 15, s * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Right leg
  drawPart(p.legR, () => {
    ctx.fillStyle = cowboyColors.pants;
    ctx.beginPath();
    ctx.roundRect(-s * 6, -s * 45, s * 12, s * 30, s * 3);
    ctx.fill();
    ctx.stroke();
    // Boot
    ctx.fillStyle = cowboyColors.boots;
    ctx.beginPath();
    ctx.roundRect(-s * 8, -s * 15, s * 16, s * 15, s * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Back arm
  drawPart(p.armBack, () => {
    ctx.fillStyle = cowboyColors.shirt;
    ctx.beginPath();
    ctx.roundRect(-s * 5, -s * 30, s * 10, s * 25, s * 3);
    ctx.fill();
    ctx.stroke();
    // Hand
    ctx.fillStyle = cowboyColors.skin;
    ctx.beginPath();
    ctx.arc(0, 0, s * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Torso
  drawPart(p.torso, () => {
    ctx.fillStyle = cowboyColors.shirt;
    ctx.beginPath();
    ctx.moveTo(-s * 15, -s * 50);
    ctx.lineTo(s * 15, -s * 50);
    ctx.lineTo(s * 12, 0);
    ctx.lineTo(-s * 12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Vest
    ctx.fillStyle = cowboyColors.vest;
    ctx.beginPath();
    ctx.moveTo(s * 5, -s * 50);
    ctx.lineTo(s * 14, -s * 45);
    ctx.lineTo(s * 10, 0);
    ctx.lineTo(s * 5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // Gun arm
  drawPart(p.armGun, () => {
    ctx.fillStyle = cowboyColors.shirt;
    ctx.beginPath();
    ctx.roundRect(-s * 5, -s * 30, s * 10, s * 25, s * 3);
    ctx.fill();
    ctx.stroke();
    // Hand
    ctx.fillStyle = cowboyColors.skin;
    ctx.beginPath();
    ctx.arc(0, 0, s * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Gun
    ctx.fillStyle = cowboyColors.gun;
    ctx.beginPath();
    ctx.roundRect(-s * 3, -s * 5, s * 20, s * 6, s * 1);
    ctx.fill();
    ctx.stroke();
  });

  // Head
  drawPart(p.head, () => {
    // Neck
    ctx.fillStyle = cowboyColors.skin;
    ctx.fillRect(-s * 5, s * 5, s * 10, s * 10);
    ctx.strokeRect(-s * 5, s * 5, s * 10, s * 10);

    // Head
    ctx.fillStyle = cowboyColors.skin;
    ctx.beginPath();
    ctx.ellipse(0, -s * 10, s * 18, s * 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // X eyes (dead)
    ctx.strokeStyle = '#000';
    ctx.lineWidth = scale(2);
    // Left X
    ctx.beginPath();
    ctx.moveTo(-s * 8, -s * 15);
    ctx.lineTo(-s * 2, -s * 9);
    ctx.moveTo(-s * 2, -s * 15);
    ctx.lineTo(-s * 8, -s * 9);
    ctx.stroke();
    // Right X
    ctx.beginPath();
    ctx.moveTo(s * 2, -s * 15);
    ctx.lineTo(s * 8, -s * 9);
    ctx.moveTo(s * 8, -s * 15);
    ctx.lineTo(s * 2, -s * 9);
    ctx.stroke();

    ctx.strokeStyle = '#000';
    ctx.lineWidth = lineWidth;

    // Hat (tilted/falling off)
    ctx.fillStyle = cowboyColors.hat;
    ctx.beginPath();
    ctx.ellipse(s * 5, -s * 30, s * 28, s * 7, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Crown
    ctx.beginPath();
    ctx.moveTo(-s * 8, -s * 30);
    ctx.lineTo(-s * 4, -s * 52);
    ctx.lineTo(s * 18, -s * 50);
    ctx.lineTo(s * 20, -s * 28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

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
draw();
gameLoop();
