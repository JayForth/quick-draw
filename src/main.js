// Quick Draw - Typing Showdown Game
const VERSION = '3.2.0'; // Randomized hit zones for varied deaths

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

// Foreground image (saloon/buildings - has transparent sky area)
const foregroundImage = new Image();
foregroundImage.src = '/foreground.png';
let foregroundLoaded = false;
foregroundImage.onload = () => {
  foregroundLoaded = true;
};

// ============================================
// SPRITE-BASED COWBOY SYSTEM
// ============================================

// Load all cowboy sprite parts
const cowboySprites = {};
const spriteNames = [
  'head', 'torso',
  'arm_upper_front', 'arm_lower_front',
  'arm_upper_back', 'arm_lower_back',
  'leg_upper_left', 'leg_lower_left',
  'leg_upper_right', 'leg_lower_right'
];
let spritesLoaded = 0;

spriteNames.forEach(name => {
  const img = new Image();
  img.src = `/sprites/player/${name}.png`;
  img.onload = () => {
    spritesLoaded++;
    console.log(`Loaded sprite: ${name} (${spritesLoaded}/${spriteNames.length})`);
  };
  cowboySprites[name] = img;
});

// Skeleton configuration - pivot points and attachment points
// Pivots are relative to each sprite's top-left corner
// ACTUAL SPRITE DIMENSIONS:
// head: 170x120, torso: 99x145, arm_upper_front: 73x78, arm_lower_front: 83x188
// arm_upper_back: 36x72, arm_lower_back: 101x111
// leg_upper_left: 67x122, leg_lower_left: 85x142
// leg_upper_right: 47x145, leg_lower_right: 86x95
const skeleton = {
  baseScale: 0.22,

  torso: {  // 99 x 145
    pivot: { x: 50, y: 72 },          // Center of torso
    neck: { x: 50, y: 0 },            // Top center where head attaches
    shoulderFront: { x: 5, y: 25 },   // Left edge for front arm
    shoulderBack: { x: 94, y: 25 },   // Right edge for back arm
    hipRight: { x: 30, y: 142 },      // Front leg
    hipLeft: { x: 68, y: 142 },       // Back leg
  },

  head: {  // 170 x 120
    pivot: { x: 85, y: 115 },  // Bottom center (neck attachment)
  },

  arm_upper_front: {  // 73 x 78
    pivot: { x: 55, y: 15 },   // Shoulder (top right area)
    elbow: { x: 25, y: 68 },   // Bottom where forearm attaches
  },

  arm_lower_front: {  // 83 x 188
    pivot: { x: 45, y: 15 },   // Elbow (top center)
  },

  arm_upper_back: {  // 36 x 72
    pivot: { x: 18, y: 10 },   // Shoulder (top)
    elbow: { x: 18, y: 65 },   // Bottom where forearm attaches
  },

  arm_lower_back: {  // 101 x 111
    pivot: { x: 50, y: 10 },   // Elbow (top)
  },

  leg_upper_right: {  // 47 x 145
    pivot: { x: 24, y: 8 },    // Hip (top)
    knee: { x: 24, y: 138 },   // Bottom where shin attaches
  },

  leg_lower_right: {  // 86 x 95
    pivot: { x: 43, y: 8 },    // Knee (top)
  },

  leg_upper_left: {  // 67 x 122
    pivot: { x: 34, y: 8 },    // Hip (top)
    knee: { x: 34, y: 115 },   // Bottom where shin attaches
  },

  leg_lower_left: {  // 85 x 142
    pivot: { x: 42, y: 8 },    // Knee (top)
  },
};

// Draw a sprite at a position with rotation around its pivot
function drawSprite(spriteName, x, y, rotation, scale, flipX = false) {
  const sprite = cowboySprites[spriteName];
  if (!sprite || !sprite.complete) return;

  const config = skeleton[spriteName];
  if (!config) return;

  ctx.save();
  ctx.translate(x, y);

  if (flipX) {
    ctx.scale(-1, 1);
  }

  ctx.rotate(rotation);

  // Draw sprite centered on its pivot point
  const px = config.pivot.x * scale;
  const py = config.pivot.y * scale;
  const w = sprite.width * scale;
  const h = sprite.height * scale;

  ctx.drawImage(sprite, -px, -py, w, h);

  ctx.restore();
}

// Draw the sprite-based cowboy with skeletal animation
function drawSpriteCowboy(x, y, facingRight, armProgress, isPlayer) {
  const s = skeleton.baseScale * (canvas.height / 400);  // Scale based on canvas
  const flip = !facingRight;

  // Check sprites are loaded
  const torsoImg = cowboySprites.torso;
  if (!torsoImg || !torsoImg.complete) return;

  // Get sprite dimensions for positioning calculations
  const legUpperH = (cowboySprites.leg_upper_right?.height || 140) * s;
  const legLowerH = (cowboySprites.leg_lower_right?.height || 140) * s;
  const torsoH = (torsoImg.height || 180) * s;

  // Calculate total height and position torso so feet are at y
  const totalLegHeight = legUpperH * 0.85 + legLowerH * 0.85; // Overlap at joints
  const torsoY = y - totalLegHeight - torsoH * 0.45;
  const torsoX = x;

  // Arm animation: from resting (pointing down) to shooting (horizontal)
  const armRestAngle = Math.PI * 0.4;  // ~72 degrees down
  const armShootAngle = -Math.PI * 0.05;  // Slightly up when shooting
  const frontArmAngle = armRestAngle + (armShootAngle - armRestAngle) * armProgress;

  // Back arm stays mostly stationary
  const backArmAngle = Math.PI * 0.3;

  // Forearm follows upper arm with bend
  const frontForearmAngle = frontArmAngle * 0.7;
  const backForearmAngle = backArmAngle * 0.8;

  // Direction multiplier for rotation
  const dir = facingRight ? 1 : -1;

  // Helper to get attachment point relative to torso center
  function getTorsoAttach(point) {
    const dx = (point.x - skeleton.torso.pivot.x) * s;
    return {
      x: torsoX + (facingRight ? dx : -dx),
      y: torsoY + (point.y - skeleton.torso.pivot.y) * s
    };
  }

  // === DRAW ORDER (back to front) ===

  // 1. Back leg (left leg when facing right)
  const backHip = getTorsoAttach(skeleton.torso.hipLeft);
  drawSprite('leg_upper_left', backHip.x, backHip.y, 0, s, flip);

  const backKneeOffset = (skeleton.leg_upper_left.knee.y - skeleton.leg_upper_left.pivot.y) * s;
  const backKnee = {
    x: backHip.x,
    y: backHip.y + backKneeOffset
  };
  drawSprite('leg_lower_left', backKnee.x, backKnee.y, 0, s, flip);

  // 2. Back arm
  const backShoulder = getTorsoAttach(skeleton.torso.shoulderBack);
  const backArmLen = (skeleton.arm_upper_back.elbow.y - skeleton.arm_upper_back.pivot.y) * s;

  drawSprite('arm_upper_back', backShoulder.x, backShoulder.y, dir * backArmAngle, s, flip);

  const backElbow = {
    x: backShoulder.x + Math.sin(dir * backArmAngle) * backArmLen,
    y: backShoulder.y + Math.cos(dir * backArmAngle) * backArmLen
  };
  drawSprite('arm_lower_back', backElbow.x, backElbow.y, dir * backForearmAngle, s, flip);

  // 3. Torso
  drawSprite('torso', torsoX, torsoY, 0, s, flip);

  // 4. Head
  const neckPos = getTorsoAttach(skeleton.torso.neck);
  drawSprite('head', neckPos.x, neckPos.y, 0, s, flip);

  // 5. Front leg (right leg when facing right)
  const frontHip = getTorsoAttach(skeleton.torso.hipRight);
  drawSprite('leg_upper_right', frontHip.x, frontHip.y, 0, s, flip);

  const frontKneeOffset = (skeleton.leg_upper_right.knee.y - skeleton.leg_upper_right.pivot.y) * s;
  const frontKnee = {
    x: frontHip.x,
    y: frontHip.y + frontKneeOffset
  };
  drawSprite('leg_lower_right', frontKnee.x, frontKnee.y, 0, s, flip);

  // 6. Front arm (gun arm) - animates based on typing progress
  const frontShoulder = getTorsoAttach(skeleton.torso.shoulderFront);
  const frontArmLen = (skeleton.arm_upper_front.elbow.y - skeleton.arm_upper_front.pivot.y) * s;

  drawSprite('arm_upper_front', frontShoulder.x, frontShoulder.y, dir * frontArmAngle, s, flip);

  const frontElbow = {
    x: frontShoulder.x + Math.sin(dir * frontArmAngle) * frontArmLen,
    y: frontShoulder.y + Math.cos(dir * frontArmAngle) * frontArmLen
  };
  drawSprite('arm_lower_front', frontElbow.x, frontElbow.y, dir * frontForearmAngle, s, flip);

  // DEBUG: Draw joint positions (toggle with 0 key, click to select, arrows to move)
  if (window.DEBUG_JOINTS) {
    // Build list of editable joints with screen positions
    window.DEBUG_JOINTS_LIST = [
      { x: neckPos.x, y: neckPos.y, part: 'torso', point: 'neck', color: '#0ff', label: 'neck' },
      { x: frontShoulder.x, y: frontShoulder.y, part: 'torso', point: 'shoulderFront', color: '#f00', label: 'shoulderF' },
      { x: backShoulder.x, y: backShoulder.y, part: 'torso', point: 'shoulderBack', color: '#f0f', label: 'shoulderB' },
      { x: frontElbow.x, y: frontElbow.y, part: 'arm_upper_front', point: 'elbow', color: '#f80', label: 'elbowF' },
      { x: backElbow.x, y: backElbow.y, part: 'arm_upper_back', point: 'elbow', color: '#f88', label: 'elbowB' },
      { x: frontHip.x, y: frontHip.y, part: 'torso', point: 'hipRight', color: '#0f0', label: 'hipR' },
      { x: backHip.x, y: backHip.y, part: 'torso', point: 'hipLeft', color: '#0a0', label: 'hipL' },
      { x: frontKnee.x, y: frontKnee.y, part: 'leg_upper_right', point: 'knee', color: '#ff0', label: 'kneeR' },
      { x: backKnee.x, y: backKnee.y, part: 'leg_upper_left', point: 'knee', color: '#aa0', label: 'kneeL' },
      { x: torsoX, y: torsoY, part: 'torso', point: 'pivot', color: '#fff', label: 'torso' },
    ];

    ctx.lineWidth = 2;
    ctx.font = '10px monospace';

    for (const joint of window.DEBUG_JOINTS_LIST) {
      const isSelected = window.DEBUG_SELECTED &&
        window.DEBUG_SELECTED.part === joint.part &&
        window.DEBUG_SELECTED.point === joint.point;

      // Draw selection ring
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(joint.x, joint.y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw joint dot
      ctx.fillStyle = joint.color;
      ctx.beginPath();
      ctx.arc(joint.x, joint.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Draw label
      ctx.fillStyle = '#fff';
      ctx.fillText(joint.label, joint.x + 8, joint.y - 8);
    }
  }
}

// Stars for night sky (generated once)
const stars = [];
const STAR_COUNT = 80;
for (let i = 0; i < STAR_COUNT; i++) {
  stars.push({
    x: Math.random(),  // Percentage of canvas width
    y: Math.random() * 0.5,  // Upper 50% of canvas
    size: 0.5 + Math.random() * 1.5,
    twinkleOffset: Math.random() * Math.PI * 2,
    twinkleSpeed: 0.02 + Math.random() * 0.03,
  });
}

// ============================================
// PARALLAX CLOUDS
// ============================================

// Back layer clouds (distant, slower, smaller)
const cloudsBack = [];
const CLOUDS_BACK_COUNT = 4;

// Front layer clouds (closer, faster, larger)
const cloudsFront = [];
const CLOUDS_FRONT_COUNT = 3;

function createCloud(isBack) {
  const baseSize = isBack ? 30 + Math.random() * 20 : 50 + Math.random() * 30;
  return {
    x: Math.random() * 1.5 - 0.25,  // -0.25 to 1.25 (percentage, allows off-screen start)
    y: isBack ? 0.08 + Math.random() * 0.15 : 0.12 + Math.random() * 0.2,  // Upper sky
    size: baseSize,
    speed: isBack ? 0.00003 + Math.random() * 0.00002 : 0.00006 + Math.random() * 0.00003,
    puffs: generateCloudPuffs(),  // Random puff arrangement
    opacity: isBack ? 0.4 + Math.random() * 0.2 : 0.6 + Math.random() * 0.2,
  };
}

// Generate random puff positions for variety
function generateCloudPuffs() {
  const puffs = [
    { ox: 0, oy: 0, scale: 0.8 + Math.random() * 0.4 },  // Center
    { ox: -0.7, oy: 0.1, scale: 0.5 + Math.random() * 0.3 },  // Left
    { ox: 0.7, oy: 0.05, scale: 0.6 + Math.random() * 0.3 },  // Right
  ];
  // Add 1-2 extra random puffs
  const extraCount = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < extraCount; i++) {
    puffs.push({
      ox: (Math.random() - 0.5) * 1.2,
      oy: (Math.random() - 0.5) * 0.4,
      scale: 0.4 + Math.random() * 0.4,
    });
  }
  return puffs;
}

function initClouds() {
  for (let i = 0; i < CLOUDS_BACK_COUNT; i++) {
    cloudsBack.push(createCloud(true));
  }
  for (let i = 0; i < CLOUDS_FRONT_COUNT; i++) {
    cloudsFront.push(createCloud(false));
  }
}

function updateClouds() {
  const speedMult = getTransitionSpeedMultiplier() * getWeatherWindMultiplier();
  // Update back layer
  for (const cloud of cloudsBack) {
    cloud.x += cloud.speed * speedMult;
    if (cloud.x > 1.3) {
      cloud.x = -0.3;
      cloud.y = 0.08 + Math.random() * 0.15;
      cloud.puffs = generateCloudPuffs();
    }
  }
  // Update front layer
  for (const cloud of cloudsFront) {
    cloud.x += cloud.speed * speedMult;
    if (cloud.x > 1.3) {
      cloud.x = -0.3;
      cloud.y = 0.12 + Math.random() * 0.2;
      cloud.puffs = generateCloudPuffs();
    }
  }
}

function drawClouds(palette) {
  // Determine cloud color based on time of day
  let cloudColor, cloudOpacityMult;
  if (palette.isNight) {
    cloudColor = { r: 60, g: 60, b: 80 };  // Dark blue-gray
    cloudOpacityMult = 0.3;  // Much fainter at night
  } else if (palette.sunY > 0.45) {
    // Sunset - warm colors
    cloudColor = { r: 255, g: 180, b: 140 };
    cloudOpacityMult = 0.9;
  } else if (palette.sunY > 0.35) {
    // Golden hour
    cloudColor = { r: 255, g: 220, b: 180 };
    cloudOpacityMult = 0.85;
  } else {
    // Day - white
    cloudColor = { r: 255, g: 255, b: 255 };
    cloudOpacityMult = 0.75;
  }

  // Draw back layer first (behind)
  for (const cloud of cloudsBack) {
    drawSingleCloud(cloud, cloudColor, cloudOpacityMult * 0.6);
  }
  // Draw front layer (in front)
  for (const cloud of cloudsFront) {
    drawSingleCloud(cloud, cloudColor, cloudOpacityMult);
  }
}

function drawSingleCloud(cloud, color, opacityMult) {
  const x = cloud.x * canvas.width;
  const y = cloud.y * canvas.height;
  const size = cloud.size * (canvas.height / 400);  // Scale with canvas

  ctx.globalAlpha = cloud.opacity * opacityMult;

  for (const puff of cloud.puffs) {
    const px = x + puff.ox * size;
    const py = y + puff.oy * size;
    const psize = size * puff.scale;

    // Gradient for soft puffy look
    const gradient = ctx.createRadialGradient(px, py, 0, px, py, psize);
    gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 1)`);
    gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, 0.6)`);
    gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(px, py, psize, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

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
  const speedMult = getTransitionSpeedMultiplier() * getWeatherWindMultiplier();
  for (let i = 0; i < dustParticles.length; i++) {
    const p = dustParticles[i];
    p.wobble += p.wobbleSpeed * speedMult;
    p.x += p.speedX * speedMult;
    p.y += (p.speedY + Math.sin(p.wobble) * 0.3) * speedMult;

    // Reset when off screen
    if (p.x < -10) {
      dustParticles[i] = createDustParticle(false);
    }
  }
}

function drawDust() {
  const palette = getInterpolatedPalette();
  // Warmer dust during day, cooler at night
  const dustColor = palette.isNight ? '#8090A0' : '#d4a76a';

  for (const p of dustParticles) {
    ctx.globalAlpha = p.opacity * (palette.isNight ? 0.6 : 1);  // Dimmer at night
    ctx.fillStyle = dustColor;
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
  const speedMult = getTransitionSpeedMultiplier() * getWeatherWindMultiplier();

  // Spawn new tumbleweed occasionally (more often in windy weather)
  const spawnInterval = state.weather.type === 'wind' ? TUMBLEWEED_INTERVAL * 0.3 : TUMBLEWEED_INTERVAL;
  const maxTumbleweeds = state.weather.type === 'wind' ? 5 : 2;

  if (now - lastTumbleweedTime > spawnInterval && tumbleweeds.length < maxTumbleweeds) {
    tumbleweeds.push(createTumbleweed());
    lastTumbleweedTime = now;
  }

  // Update existing tumbleweeds
  for (let i = tumbleweeds.length - 1; i >= 0; i--) {
    const t = tumbleweeds[i];
    t.x += t.speedX * speedMult;
    t.rotation += t.rotationSpeed * speedMult;
    t.bouncePhase += 0.15 * speedMult;
    t.y += Math.sin(t.bouncePhase) * 0.5 * speedMult; // Gentle bounce

    // Remove when off screen
    if ((t.speedX > 0 && t.x > canvas.width + t.size * 2) ||
        (t.speedX < 0 && t.x < -t.size * 2)) {
      tumbleweeds.splice(i, 1);
    }
  }
}

function drawTumbleweeds() {
  const palette = getInterpolatedPalette();
  // Darker tumbleweed color at night
  const tumbleweedColor = palette.isNight ? '#5A4535' : '#8B7355';

  for (const t of tumbleweeds) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rotation);
    ctx.globalAlpha = t.opacity * (palette.isNight ? 0.7 : 1);

    // Draw tumbleweed as a messy circle of lines
    ctx.strokeStyle = tumbleweedColor;
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

// Sun/moon glint effect
let glintPhase = 0;
const glintSpeed = 0.02;

function drawSunGlint() {
  const speedMult = getTransitionSpeedMultiplier();
  glintPhase += glintSpeed * speedMult;

  const palette = getInterpolatedPalette();
  const sunX = canvas.width * 0.5;
  const sunY = canvas.height * palette.sunY;

  // Pulsing glow - reduced at night
  const pulseSize = 1 + Math.sin(glintPhase) * 0.15;
  const baseGlowSize = palette.isNight ? 0.08 : 0.15;
  const glowRadius = canvas.height * baseGlowSize * pulseSize;

  // Convert hex colors to rgba for gradient
  const glowColor = palette.sunGlow;
  const glowOpacity = palette.isNight ? 0.15 : 0.3;

  // Outer glow
  const gradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, glowRadius);
  gradient.addColorStop(0, glowColor + Math.round(glowOpacity * 255).toString(16).padStart(2, '0'));
  gradient.addColorStop(0.5, glowColor + Math.round(glowOpacity * 0.33 * 255).toString(16).padStart(2, '0'));
  gradient.addColorStop(1, glowColor + '00');
  ctx.fillStyle = gradient;
  ctx.fillRect(sunX - glowRadius, sunY - glowRadius, glowRadius * 2, glowRadius * 2);

  // Lens flare streaks - only during day, stronger at sunset
  if (!palette.isNight) {
    const flareIntensity = (palette.sunY > 0.35) ? 0.2 : 0.12;  // Stronger at sunset
    ctx.globalAlpha = flareIntensity + Math.sin(glintPhase * 1.5) * 0.08;
    ctx.strokeStyle = palette.sun + '80';
    ctx.lineWidth = 2;

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + glintPhase * 0.1;
      const len = canvas.height * (0.06 + Math.sin(glintPhase + i) * 0.015);
      ctx.beginPath();
      ctx.moveTo(sunX, sunY);
      ctx.lineTo(sunX + Math.cos(angle) * len, sunY + Math.sin(angle) * len);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
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
  const speedMult = getTransitionSpeedMultiplier() * getWeatherWindMultiplier();
  for (const m of dustMotes) {
    m.driftY += 0.02 * speedMult;
    m.x += m.speedX * speedMult;
    m.y += Math.sin(m.driftY) * 0.3 * speedMult;

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
  const palette = getInterpolatedPalette();

  for (const m of dustMotes) {
    if (m.opacity <= 0) continue;
    ctx.globalAlpha = m.opacity * (palette.isNight ? 0.5 : 1);  // Dimmer at night

    // Glowing dust mote - color matches sun/moon
    const gradient = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.size * 2);
    if (palette.isNight) {
      // Cool moonlit motes
      gradient.addColorStop(0, 'rgba(200, 210, 230, 0.6)');
      gradient.addColorStop(0.5, 'rgba(180, 190, 210, 0.2)');
      gradient.addColorStop(1, 'rgba(160, 170, 190, 0)');
    } else {
      // Warm sunlit motes
      gradient.addColorStop(0, 'rgba(255, 245, 220, 0.8)');
      gradient.addColorStop(0.5, 'rgba(255, 240, 200, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 235, 180, 0)');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(m.x - m.size * 2, m.y - m.size * 2, m.size * 4, m.size * 4);
  }
  ctx.globalAlpha = 1;
}

// Initialize atmospheric effects
function initAtmosphere() {
  initDust();
  initDustMotes();
  initClouds();
  lastTumbleweedTime = Date.now();
}

// Update all atmospheric effects
function updateAtmosphere() {
  updateDust();
  updateDustMotes();
  updateTumbleweeds();
  updateClouds();
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

// Day/night cycle palettes (10 stages) with tinting for foreground
// Day: Sun descends from top over 5 rounds
// Night: Moon descends from top over 5 rounds
const skyPalettes = [
  // DAY CYCLE - Sun descends (rounds 1-5)
  { top: '#5BA3D9', mid: '#87CEEB', bottom: '#E8DCC4', sun: '#FFFDE7', sunGlow: '#FFF8E1', sunY: 0.15, isNight: false, tint: '#FFE4B5', tintOpacity: 0.08 },    // 0: High noon
  { top: '#6B9BC3', mid: '#9DC4D9', bottom: '#E8D4B8', sun: '#FFF8E1', sunGlow: '#FFECB3', sunY: 0.22, isNight: false, tint: '#FFFACD', tintOpacity: 0.05 },    // 1: Early afternoon
  { top: '#7A9DBF', mid: '#C4A77D', bottom: '#E8C4A0', sun: '#FFE082', sunGlow: '#FFCC80', sunY: 0.30, isNight: false, tint: null, tintOpacity: 0 },            // 2: Afternoon (no tint)
  { top: '#8B6B61', mid: '#D4956B', bottom: '#E8A870', sun: '#FFB74D', sunGlow: '#FFA726', sunY: 0.40, isNight: false, tint: '#FFD700', tintOpacity: 0.06 },    // 3: Golden hour
  { top: '#4A2C4A', mid: '#C75B5B', bottom: '#F4A259', sun: '#FF8A65', sunGlow: '#FF7043', sunY: 0.52, isNight: false, tint: '#FF6347', tintOpacity: 0.12 },    // 4: Sunset

  // NIGHT CYCLE - Moon descends (rounds 6-10)
  { top: '#1A1A2E', mid: '#2D2D44', bottom: '#4A3A5E', sun: '#E8E8E8', sunGlow: '#B0B0B0', sunY: 0.12, isNight: true, tint: '#4169E1', tintOpacity: 0.15 },     // 5: Early night
  { top: '#151525', mid: '#252538', bottom: '#3A3A52', sun: '#E0E0E0', sunGlow: '#A0A0A0', sunY: 0.20, isNight: true, tint: '#191970', tintOpacity: 0.18 },     // 6: Night
  { top: '#101020', mid: '#1E1E30', bottom: '#2E2E45', sun: '#D8D8D8', sunGlow: '#909090', sunY: 0.28, isNight: true, tint: '#2E1A47', tintOpacity: 0.20 },     // 7: Deep night
  { top: '#0D0D1A', mid: '#1A1A2E', bottom: '#2A2A40', sun: '#D0D0D0', sunGlow: '#888888', sunY: 0.36, isNight: true, tint: '#1A1A3E', tintOpacity: 0.18 },     // 8: Late night
  { top: '#151525', mid: '#2A2A40', bottom: '#3D3D55', sun: '#C8C8C8', sunGlow: '#808080', sunY: 0.45, isNight: true, tint: '#2A1A4A', tintOpacity: 0.15 },     // 9: Pre-dawn
];

// ============================================
// SKY TRANSITION HELPERS
// ============================================

// Convert hex (#RRGGBB) to {r, g, b}
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 0, g: 0, b: 0 };
}

// Convert {r, g, b} to hex string
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// Lerp between two hex colors
function lerpColor(hex1, hex2, t) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  return rgbToHex(
    c1.r + (c2.r - c1.r) * t,
    c1.g + (c2.g - c1.g) * t,
    c1.b + (c2.b - c1.b) * t
  );
}

// Lerp between two numbers
function lerpNumber(a, b, t) {
  return a + (b - a) * t;
}

// Get speed multiplier for "fast forward" effect during transitions
function getTransitionSpeedMultiplier() {
  if (!state.skyTransition.active) return 1;
  return 8; // 8x speed during transition
}

// Get the current interpolated palette (handles transitions)
function getInterpolatedPalette() {
  const trans = state.skyTransition;

  // If no transition active, return current palette directly
  if (!trans.active) {
    const palette = skyPalettes[state.currentBg % skyPalettes.length];
    return {
      ...palette,
      starOpacity: palette.isNight ? 1 : 0,
      transitioning: false,
    };
  }

  // Calculate t (0-1) from elapsed time
  const elapsed = Date.now() - trans.startTime;
  const t = Math.min(1, elapsed / trans.duration);

  const from = skyPalettes[trans.fromIndex % skyPalettes.length];
  const to = skyPalettes[trans.toIndex % skyPalettes.length];

  // Calculate star opacity for smooth fade in/out
  const fromStarOpacity = from.isNight ? 1 : 0;
  const toStarOpacity = to.isNight ? 1 : 0;

  // Check if we're crossing day/night boundary
  const crossingDayNight = from.isNight !== to.isNight;

  // Celestial body positions during day/night transition:
  // - Outgoing body sinks below horizon (goes from current pos to ~0.7)
  // - Incoming body descends from top (goes from ~-0.1 to target pos)
  let outgoingSunY, incomingSunY, outgoingOpacity, incomingOpacity;

  if (crossingDayNight) {
    // Outgoing body sinks (first half of transition it's visible, then fades)
    outgoingSunY = lerpNumber(from.sunY, 0.7, t);
    outgoingOpacity = Math.max(0, 1 - t * 1.5); // Fades out by t=0.67

    // Incoming body descends from above (starts appearing after t=0.3)
    const incomingT = Math.max(0, (t - 0.3) / 0.7); // 0 until t=0.3, then 0-1
    incomingSunY = lerpNumber(-0.1, to.sunY, incomingT);
    incomingOpacity = Math.min(1, (t - 0.2) * 2); // Fades in starting at t=0.2
  } else {
    // Same celestial body, just moving position
    outgoingSunY = lerpNumber(from.sunY, to.sunY, t);
    outgoingOpacity = 1;
    incomingSunY = 0;
    incomingOpacity = 0;
  }

  // Interpolate all palette properties
  return {
    top: lerpColor(from.top, to.top, t),
    mid: lerpColor(from.mid, to.mid, t),
    bottom: lerpColor(from.bottom, to.bottom, t),
    sun: lerpColor(from.sun, to.sun, t),
    sunGlow: lerpColor(from.sunGlow, to.sunGlow, t),
    sunY: outgoingSunY, // Main body position (outgoing during day/night cross)
    isNight: t < 0.5 ? from.isNight : to.isNight, // Switch at midpoint
    starOpacity: lerpNumber(fromStarOpacity, toStarOpacity, t), // Smooth star fade
    tint: from.tint && to.tint ? lerpColor(from.tint, to.tint, t) :
          (t < 0.5 ? from.tint : to.tint), // Handle null tints
    tintOpacity: lerpNumber(from.tintOpacity, to.tintOpacity, t),
    // Transition-specific properties for celestial body rendering
    transitioning: true,
    crossingDayNight,
    outgoingBody: {
      color: from.sun,
      glow: from.sunGlow,
      y: outgoingSunY,
      opacity: outgoingOpacity,
      isNight: from.isNight,
    },
    incomingBody: {
      color: to.sun,
      glow: to.sunGlow,
      y: incomingSunY,
      opacity: incomingOpacity,
      isNight: to.isNight,
    },
  };
}

// Update sky transition state
function updateSkyTransition() {
  if (!state.skyTransition.active) return;

  const elapsed = Date.now() - state.skyTransition.startTime;
  if (elapsed >= state.skyTransition.duration) {
    // Transition complete
    state.currentBg = state.skyTransition.toIndex;
    state.skyTransition.active = false;
  }
}

// ============================================
// END SKY TRANSITION HELPERS
// ============================================

// ============================================
// WEATHER SYSTEM
// ============================================

const WEATHER_CHANCE = 0.15; // 15% chance of weather each round

const weatherTypes = {
  dust_storm: {
    name: 'Dust Storm',
    tint: '#8B6914',
    tintOpacity: 0.15,
    particleCount: 120,
    windMultiplier: 3,
    visibility: 0.7,
  },
  rain: {
    name: 'Rain',
    tint: '#4A6B8A',
    tintOpacity: 0.12,
    particleCount: 200,
    windMultiplier: 1.2,
    visibility: 0.85,
  },
  wind: {
    name: 'Strong Wind',
    tint: null,
    tintOpacity: 0,
    particleCount: 60,
    windMultiplier: 4,
    visibility: 1,
  },
};

// Initialize weather for a new round
function initWeather() {
  // Clear previous weather
  state.weather.particles = [];

  // Random chance for weather
  if (Math.random() > WEATHER_CHANCE) {
    state.weather.type = null;
    state.weather.intensity = 0;
    return;
  }

  // Pick random weather type
  const types = Object.keys(weatherTypes);
  state.weather.type = types[Math.floor(Math.random() * types.length)];
  state.weather.intensity = 0.6 + Math.random() * 0.4; // 0.6-1.0

  // Create weather particles
  const config = weatherTypes[state.weather.type];
  const count = Math.floor(config.particleCount * state.weather.intensity);

  for (let i = 0; i < count; i++) {
    state.weather.particles.push(createWeatherParticle(state.weather.type, true));
  }
}

// Create a single weather particle
function createWeatherParticle(type, randomX = false) {
  const startX = randomX ? Math.random() * canvas.width : canvas.width + Math.random() * 100;

  if (type === 'rain') {
    return {
      x: randomX ? Math.random() * canvas.width : Math.random() * canvas.width * 1.5,
      y: randomX ? Math.random() * canvas.height : -Math.random() * 100,
      length: 10 + Math.random() * 15,
      speedX: -1 - Math.random() * 2,
      speedY: 12 + Math.random() * 8,
      opacity: 0.3 + Math.random() * 0.4,
    };
  } else if (type === 'dust_storm') {
    return {
      x: startX,
      y: Math.random() * canvas.height,
      size: 2 + Math.random() * 6,
      speedX: -4 - Math.random() * 6,
      speedY: (Math.random() - 0.5) * 2,
      opacity: 0.2 + Math.random() * 0.4,
      wobble: Math.random() * Math.PI * 2,
    };
  } else { // wind - debris/leaves
    return {
      x: startX,
      y: Math.random() * canvas.height * 0.8,
      size: 3 + Math.random() * 5,
      speedX: -6 - Math.random() * 8,
      speedY: (Math.random() - 0.5) * 3,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.3,
      opacity: 0.4 + Math.random() * 0.4,
    };
  }
}

// Update weather particles
function updateWeather() {
  if (!state.weather.type) return;

  const config = weatherTypes[state.weather.type];
  const speedMult = getTransitionSpeedMultiplier();

  for (let i = state.weather.particles.length - 1; i >= 0; i--) {
    const p = state.weather.particles[i];

    if (state.weather.type === 'rain') {
      p.x += p.speedX * speedMult;
      p.y += p.speedY * speedMult;

      // Reset when off screen
      if (p.y > canvas.height || p.x < -50) {
        state.weather.particles[i] = createWeatherParticle('rain', false);
        state.weather.particles[i].y = -Math.random() * 50;
        state.weather.particles[i].x = Math.random() * canvas.width * 1.5;
      }
    } else if (state.weather.type === 'dust_storm') {
      p.wobble += 0.05 * speedMult;
      p.x += p.speedX * speedMult;
      p.y += (p.speedY + Math.sin(p.wobble) * 1.5) * speedMult;

      // Reset when off screen
      if (p.x < -20) {
        state.weather.particles[i] = createWeatherParticle('dust_storm', false);
      }
    } else { // wind
      p.x += p.speedX * speedMult;
      p.y += p.speedY * speedMult;
      p.rotation += p.rotSpeed * speedMult;

      // Slight wave motion
      p.y += Math.sin(p.x * 0.02) * 0.5 * speedMult;

      // Reset when off screen
      if (p.x < -20) {
        state.weather.particles[i] = createWeatherParticle('wind', false);
      }
    }
  }
}

// Draw weather effects
function drawWeather() {
  if (!state.weather.type) return;

  const config = weatherTypes[state.weather.type];
  const palette = getInterpolatedPalette();

  if (state.weather.type === 'rain') {
    ctx.strokeStyle = palette.isNight ? '#6688AA' : '#8899BB';
    ctx.lineWidth = 1.5;

    for (const p of state.weather.particles) {
      ctx.globalAlpha = p.opacity;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.speedX * 0.5, p.y + p.length);
      ctx.stroke();
    }
  } else if (state.weather.type === 'dust_storm') {
    for (const p of state.weather.particles) {
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = palette.isNight ? '#8B7355' : '#C4A574';

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  } else { // wind - debris
    for (const p of state.weather.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;

      // Draw leaf/debris shape
      ctx.fillStyle = palette.isNight ? '#4A4035' : '#7A6B55';
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  ctx.globalAlpha = 1;
}

// Draw weather overlay (tint/fog)
function drawWeatherOverlay() {
  if (!state.weather.type) return;

  const config = weatherTypes[state.weather.type];

  if (config.tint && config.tintOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = config.tintOpacity * state.weather.intensity;
    ctx.fillStyle = config.tint;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // Dust storm gets extra haze at bottom
  if (state.weather.type === 'dust_storm') {
    const gradient = ctx.createLinearGradient(0, canvas.height * 0.5, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(139, 105, 20, 0)');
    gradient.addColorStop(1, `rgba(139, 105, 20, ${0.2 * state.weather.intensity})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// Get weather wind multiplier for other particles
function getWeatherWindMultiplier() {
  if (!state.weather.type) return 1;
  return weatherTypes[state.weather.type].windMultiplier * state.weather.intensity;
}

// ============================================
// END WEATHER SYSTEM
// ============================================

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
  skyTransition: {
    active: false,
    fromIndex: 0,
    toIndex: 0,
    startTime: 0,
    duration: 1500, // 1.5 second transition
  },
  weather: {
    type: null, // null, 'dust_storm', 'rain', 'wind'
    intensity: 0, // 0-1
    particles: [], // Weather-specific particles
  },
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

// ============================================
// VERLET RAGDOLL PHYSICS
// ============================================
// Each body part is a point with position. Velocity is implicit (pos - oldPos).
// Points are connected by distance constraints (sticks).
// Constraints directly move positions to maintain distances.

const ragdoll = {
  active: false,
  isPlayer: false,
  baseX: 0,
  baseY: 0,
  groundY: 0,
  wound: null,

  // All the points in the ragdoll skeleton
  points: {},

  // Distance constraints between points
  sticks: [],

  // Physics settings
  gravity: 0.4,
  friction: 0.98,      // Air friction
  groundFriction: 0.7, // Ground friction
  bounce: 0.3,         // Ground bounce
  iterations: 5,       // Constraint solver iterations per frame
};

// Create a Verlet point
function createPoint(x, y, pinned = false) {
  return {
    x: x,
    y: y,
    oldX: x,
    oldY: y,
    pinned: pinned, // Pinned points don't move
  };
}

// Create a distance constraint (stick) between two points
function createStick(pointA, pointB, length = null) {
  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  return {
    pointA: pointA,
    pointB: pointB,
    length: length !== null ? length : Math.sqrt(dx * dx + dy * dy),
  };
}

// Initialize ragdoll skeleton at a position
function initRagdollSkeleton(baseX, baseY) {
  const s = scale(1);
  const p = ragdoll.points;

  // Create points for the skeleton (positions relative to standing pose)
  // Head and spine
  p.head = createPoint(baseX, baseY - s * 95);
  p.neck = createPoint(baseX, baseY - s * 75);
  p.chest = createPoint(baseX, baseY - s * 55);
  p.hip = createPoint(baseX, baseY - s * 25);

  // Arms (front = gun arm when facing right)
  p.shoulderF = createPoint(baseX + s * 12, baseY - s * 60);
  p.elbowF = createPoint(baseX + s * 25, baseY - s * 45);
  p.handF = createPoint(baseX + s * 40, baseY - s * 35);

  p.shoulderB = createPoint(baseX - s * 12, baseY - s * 60);
  p.elbowB = createPoint(baseX - s * 20, baseY - s * 45);
  p.handB = createPoint(baseX - s * 25, baseY - s * 35);

  // Legs
  p.hipL = createPoint(baseX - s * 8, baseY - s * 22);
  p.kneeL = createPoint(baseX - s * 10, baseY - s * 12);
  p.footL = createPoint(baseX - s * 12, baseY);

  p.hipR = createPoint(baseX + s * 8, baseY - s * 22);
  p.kneeR = createPoint(baseX + s * 10, baseY - s * 12);
  p.footR = createPoint(baseX + s * 12, baseY);

  // Create sticks (constraints)
  ragdoll.sticks = [
    // Spine
    createStick(p.head, p.neck),
    createStick(p.neck, p.chest),
    createStick(p.chest, p.hip),

    // Shoulders to chest
    createStick(p.chest, p.shoulderF),
    createStick(p.chest, p.shoulderB),

    // Front arm
    createStick(p.shoulderF, p.elbowF),
    createStick(p.elbowF, p.handF),

    // Back arm
    createStick(p.shoulderB, p.elbowB),
    createStick(p.elbowB, p.handB),

    // Hips
    createStick(p.hip, p.hipL),
    createStick(p.hip, p.hipR),
    createStick(p.hipL, p.hipR), // Keep hips together

    // Left leg
    createStick(p.hipL, p.kneeL),
    createStick(p.kneeL, p.footL),

    // Right leg
    createStick(p.hipR, p.kneeR),
    createStick(p.kneeR, p.footR),

    // Structural stability - cross braces
    createStick(p.head, p.chest),      // Head to chest
    createStick(p.neck, p.shoulderF),  // Neck to shoulders
    createStick(p.neck, p.shoulderB),
    createStick(p.chest, p.hipL),      // Chest to hips (torso rigidity)
    createStick(p.chest, p.hipR),
    createStick(p.shoulderF, p.hip),   // Shoulder cross braces
    createStick(p.shoulderB, p.hip),
  ];
}

function startRagdoll(isPlayer, baseX, groundY) {
  ragdoll.active = true;
  ragdoll.isPlayer = isPlayer;
  ragdoll.groundY = groundY;
  ragdoll.baseX = baseX;
  ragdoll.baseY = groundY;

  // Initialize the skeleton
  initRagdollSkeleton(baseX, groundY);

  // Apply impact force
  const hitDir = isPlayer ? -1 : 1;
  const impactForce = 12 + Math.random() * 8;
  const upForce = -8 - Math.random() * 6;

  // Apply velocity to all points (set oldX/oldY to simulate initial velocity)
  for (const name in ragdoll.points) {
    const p = ragdoll.points[name];
    // Velocity is implicit: velocity = pos - oldPos
    // So to add velocity, we move oldPos backwards
    p.oldX = p.x - hitDir * impactForce * (0.8 + Math.random() * 0.4);
    p.oldY = p.y - upForce * (0.8 + Math.random() * 0.4);
  }

  // Extra kick to extremities (head, hands, feet fling more)
  const p = ragdoll.points;
  const fling = impactForce * 0.5;
  p.head.oldX -= hitDir * fling;
  p.head.oldY -= 3;
  p.handF.oldX -= hitDir * fling * 1.5;
  p.handF.oldY -= 5;
  p.handB.oldX -= hitDir * fling;
  p.footL.oldX -= hitDir * fling * 0.3;
  p.footR.oldX -= hitDir * fling * 0.3;
}

function updateRagdoll() {
  if (!ragdoll.active) return;

  const groundY = ragdoll.groundY;

  // === VERLET INTEGRATION ===
  // For each point: apply gravity, then move based on velocity (implicit from position delta)
  for (const name in ragdoll.points) {
    const p = ragdoll.points[name];
    if (p.pinned) continue;

    // Calculate velocity (implicit)
    const vx = (p.x - p.oldX) * ragdoll.friction;
    const vy = (p.y - p.oldY) * ragdoll.friction;

    // Store current position
    p.oldX = p.x;
    p.oldY = p.y;

    // Apply velocity and gravity
    p.x += vx;
    p.y += vy + ragdoll.gravity;

    // Ground collision
    if (p.y > groundY) {
      p.y = groundY;
      p.oldY = p.y + vy * ragdoll.bounce; // Bounce
      p.oldX = p.x - vx * ragdoll.groundFriction; // Ground friction
    }
  }

  // === CONSTRAINT SOLVING ===
  // Multiple iterations for stability
  for (let iter = 0; iter < ragdoll.iterations; iter++) {
    for (const stick of ragdoll.sticks) {
      const a = stick.pointA;
      const b = stick.pointB;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist === 0) continue;

      // How much to correct
      const diff = stick.length - dist;
      const percent = diff / dist / 2; // Split between both points

      const offsetX = dx * percent;
      const offsetY = dy * percent;

      // Move points to satisfy constraint
      if (!a.pinned) {
        a.x -= offsetX;
        a.y -= offsetY;
      }
      if (!b.pinned) {
        b.x += offsetX;
        b.y += offsetY;
      }
    }

    // Re-apply ground constraint after each iteration
    for (const name in ragdoll.points) {
      const p = ragdoll.points[name];
      if (p.y > groundY) {
        p.y = groundY;
      }
    }
  }

  // === BLOOD SPURTING ===
  if (ragdoll.wound && ragdoll.wound.intensity > 0) {
    const wound = ragdoll.wound;
    const chest = ragdoll.points.chest;

    // Spawn blood spurts
    const spurtChance = wound.intensity * 0.6;
    if (Math.random() < spurtChance) {
      const numDrops = Math.floor(1 + Math.random() * 3 * wound.intensity);
      for (let i = 0; i < numDrops; i++) {
        const spread = (Math.random() - 0.5) * 1.5;
        const speed = 2 + Math.random() * 5 * wound.intensity;
        const angle = Math.atan2(wound.bulletVy, wound.bulletVx) + spread;
        const vx = chest.x - chest.oldX;
        const vy = chest.y - chest.oldY;

        state.blood.push({
          x: chest.x + (Math.random() - 0.5) * 10,
          y: chest.y + (Math.random() - 0.5) * 10,
          vx: Math.cos(angle) * speed + vx * 0.3,
          vy: Math.sin(angle) * speed + vy * 0.3 - 1,
          size: 2 + Math.random() * 4,
          life: 0.8 + Math.random() * 0.2,
        });
      }
    }

    wound.intensity -= 0.008;
    if (wound.intensity < 0) wound.intensity = 0;
  }
}

function resetRagdoll() {
  ragdoll.active = false;
  ragdoll.wound = null;
  ragdoll.points = {};
  ragdoll.sticks = [];
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
  ragdoll.groundY = groundY;
  ragdoll.baseX = baseX;
  ragdoll.baseY = groundY;

  // Set up wound for blood spurting
  ragdoll.wound = {
    intensity: 1.0,
    bulletVx: bulletVx,
    bulletVy: bulletVy,
  };

  // Initialize the skeleton
  initRagdollSkeleton(baseX, groundY);

  // Randomize hit location for varied death animations
  const hitDir = bulletVx > 0 ? 1 : -1;
  const force = 8 + Math.random() * 6;
  const p = ragdoll.points;

  // Pick random hit zone: 0=head, 1=chest, 2=gut, 3=shoulder
  const hitZone = Math.floor(Math.random() * 4);

  if (hitZone === 0) {
    // HEAD SHOT - head snaps back violently, body follows
    p.head.oldX = p.head.x - hitDir * force * 2.5;
    p.head.oldY = p.head.y - force * 0.8; // Head jerks up and back
    p.neck.oldX = p.neck.x - hitDir * force * 1.5;
    p.chest.oldX = p.chest.x - hitDir * force * 0.8;
    // Arms fly up
    p.handF.oldX = p.handF.x + (Math.random() * 12 - 6);
    p.handF.oldY = p.handF.y - force * 1.2;
    p.handB.oldX = p.handB.x + (Math.random() * 12 - 6);
    p.handB.oldY = p.handB.y - force * 0.8;
  } else if (hitZone === 1) {
    // CHEST SHOT - classic knockback, upper body takes it
    p.chest.oldX = p.chest.x - hitDir * force * 1.8;
    p.chest.oldY = p.chest.y - force * 0.3;
    p.neck.oldX = p.neck.x - hitDir * force * 1.5;
    p.head.oldX = p.head.x - hitDir * force * 1.2;
    p.shoulderF.oldX = p.shoulderF.x - hitDir * force * 1.6;
    p.shoulderB.oldX = p.shoulderB.x - hitDir * force * 1.6;
    // Arms flail back
    p.handF.oldX = p.handF.x - hitDir * force * 0.8;
    p.handB.oldX = p.handB.x - hitDir * force * 0.5;
  } else if (hitZone === 2) {
    // GUT SHOT - doubles over, then collapses
    p.hip.oldX = p.hip.x - hitDir * force * 1.2;
    p.hip.oldY = p.hip.y + force * 0.5; // Hip drops
    p.chest.oldX = p.chest.x - hitDir * force * 0.4;
    p.chest.oldY = p.chest.y + force * 0.8; // Chest folds forward
    p.head.oldX = p.head.x - hitDir * force * 0.2;
    p.head.oldY = p.head.y + force * 1.2; // Head drops down
    // Arms clutch toward gut
    p.handF.oldY = p.handF.y + force * 0.6;
    p.handB.oldY = p.handB.y + force * 0.6;
    // Knees buckle
    p.kneeL.oldX = p.kneeL.x + hitDir * force * 0.4;
    p.kneeR.oldX = p.kneeR.x + hitDir * force * 0.4;
  } else {
    // SHOULDER SHOT - spins them around
    const spinDir = Math.random() > 0.5 ? 1 : -1;
    p.shoulderF.oldX = p.shoulderF.x - hitDir * force * 2.0;
    p.shoulderF.oldY = p.shoulderF.y - force * 0.4;
    p.shoulderB.oldX = p.shoulderB.x + hitDir * force * 0.8; // Opposite shoulder goes other way
    p.chest.oldX = p.chest.x - hitDir * force * 1.0;
    p.head.oldX = p.head.x - hitDir * force * 0.8;
    // Hit arm flies back
    p.elbowF.oldX = p.elbowF.x - hitDir * force * 2.5;
    p.handF.oldX = p.handF.x - hitDir * force * 3.0;
    p.handF.oldY = p.handF.y - force * 0.8;
    // Creates a spin/twist
    p.hipL.oldX = p.hipL.x + hitDir * force * 0.3;
    p.hipR.oldX = p.hipR.x - hitDir * force * 0.3;
  }

  // All zones: arms get some random flail
  p.elbowF.oldX += (Math.random() * 8 - 4);
  p.elbowB.oldX += (Math.random() * 8 - 4);
  p.handF.oldX += (Math.random() * 6 - 3);
  p.handB.oldX += (Math.random() * 6 - 3);

  // Feet stay mostly planted for stumble effect (except gut shot)
  if (hitZone !== 2) {
    p.footL.oldX = p.footL.x;
    p.footL.oldY = p.footL.y;
    p.footR.oldX = p.footR.x;
    p.footR.oldY = p.footR.y;
  }
}

// Draw ragdolled cowboy - hierarchical: torso is root, limbs attach to it
// Draw ragdoll using Verlet points - body parts stretch between points
function drawRagdoll(baseX, baseY, facingRight) {
  if (!ragdoll.points.head) return;

  ctx.save();
  const s = scale(1);
  const lineWidth = scale(3);

  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000';

  const p = ragdoll.points;

  // Helper: draw a limb (thick line) between two points
  function drawLimb(p1, p2, thickness, color) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = thickness + scale(2);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // Helper: draw a circle (joint or head)
  function drawCircle(point, radius, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = scale(2);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Helper: draw torso as a filled shape
  function drawTorso() {
    ctx.fillStyle = cowboyColors.shirt;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = scale(2);
    ctx.beginPath();
    ctx.moveTo(p.shoulderB.x, p.shoulderB.y);
    ctx.lineTo(p.shoulderF.x, p.shoulderF.y);
    ctx.lineTo(p.hipR.x, p.hipR.y);
    ctx.lineTo(p.hipL.x, p.hipL.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Vest accent
    ctx.fillStyle = cowboyColors.vest;
    ctx.beginPath();
    ctx.moveTo(p.chest.x, p.chest.y);
    ctx.lineTo(p.shoulderF.x, p.shoulderF.y);
    ctx.lineTo(p.hipR.x, p.hipR.y);
    ctx.closePath();
    ctx.fill();
  }

  // Draw order: back leg, back arm, torso, front leg, front arm, head

  // Back leg (left leg)
  drawLimb(p.hipL, p.kneeL, s * 10, cowboyColors.pants);
  drawLimb(p.kneeL, p.footL, s * 9, cowboyColors.pants);
  drawCircle(p.footL, s * 7, cowboyColors.boots);

  // Back arm
  drawLimb(p.shoulderB, p.elbowB, s * 8, cowboyColors.shirt);
  drawLimb(p.elbowB, p.handB, s * 7, cowboyColors.shirt);
  drawCircle(p.handB, s * 5, cowboyColors.skin);

  // Torso
  drawTorso();

  // Spine/neck for connection
  drawLimb(p.chest, p.neck, s * 8, cowboyColors.shirt);

  // Front leg (right leg)
  drawLimb(p.hipR, p.kneeR, s * 10, cowboyColors.pants);
  drawLimb(p.kneeR, p.footR, s * 9, cowboyColors.pants);
  drawCircle(p.footR, s * 7, cowboyColors.boots);

  // Front arm (gun arm)
  drawLimb(p.shoulderF, p.elbowF, s * 8, cowboyColors.shirt);
  drawLimb(p.elbowF, p.handF, s * 7, cowboyColors.shirt);
  drawCircle(p.handF, s * 5, cowboyColors.skin);

  // Gun in hand
  const gunAngle = Math.atan2(p.handF.y - p.elbowF.y, p.handF.x - p.elbowF.x);
  ctx.save();
  ctx.translate(p.handF.x, p.handF.y);
  ctx.rotate(gunAngle);
  ctx.fillStyle = cowboyColors.gun;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = scale(1.5);
  ctx.beginPath();
  ctx.roundRect(0, -s * 3, s * 18, s * 6, s * 1);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Neck
  drawLimb(p.neck, p.head, s * 6, cowboyColors.skin);

  // Head
  drawCircle(p.head, s * 14, cowboyColors.skin);

  // X eyes (dead) - calculate head angle from neck
  const headAngle = Math.atan2(p.head.y - p.neck.y, p.head.x - p.neck.x) - Math.PI / 2;
  ctx.save();
  ctx.translate(p.head.x, p.head.y);
  ctx.rotate(headAngle);

  ctx.strokeStyle = '#000';
  ctx.lineWidth = scale(2);
  // Left X
  ctx.beginPath();
  ctx.moveTo(-s * 5, -s * 4);
  ctx.lineTo(-s * 1, 0);
  ctx.moveTo(-s * 1, -s * 4);
  ctx.lineTo(-s * 5, 0);
  ctx.stroke();
  // Right X
  ctx.beginPath();
  ctx.moveTo(s * 1, -s * 4);
  ctx.lineTo(s * 5, 0);
  ctx.moveTo(s * 5, -s * 4);
  ctx.lineTo(s * 1, 0);
  ctx.stroke();

  // Hat
  ctx.fillStyle = cowboyColors.hat;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = scale(2);
  // Brim
  ctx.beginPath();
  ctx.ellipse(0, -s * 10, s * 20, s * 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Crown
  ctx.beginPath();
  ctx.roundRect(-s * 10, -s * 25, s * 20, s * 16, s * 3);
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

// Draw dynamic sky background with foreground overlay
function drawBackground() {
  const w = canvas.width;
  const h = canvas.height;
  const palette = getInterpolatedPalette();

  // Layer 1: Sky gradient
  const skyGradient = ctx.createLinearGradient(0, 0, 0, h);
  skyGradient.addColorStop(0, palette.top);
  skyGradient.addColorStop(0.5, palette.mid);
  skyGradient.addColorStop(1, palette.bottom);
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, w, h);

  // Layer 2: Stars (fade in/out during day/night transitions)
  if (palette.starOpacity > 0) {
    drawStars(palette.starOpacity);
  }

  // Layer 3: Sun or Moon
  drawCelestialBody(palette);

  // Layer 4: Clouds (parallax layers)
  drawClouds(palette);

  // Layer 5: Foreground image (saloon/buildings)
  if (foregroundLoaded) {
    ctx.drawImage(foregroundImage, 0, 0, w, h);
  }

  // Layer 5: Color tint overlay for time-of-day lighting
  if (palette.tint && palette.tintOpacity > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = palette.tintOpacity;
    ctx.fillStyle = palette.tint;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

// Draw twinkling stars for night sky
function drawStars(starOpacity = 1) {
  const speedMult = getTransitionSpeedMultiplier();
  const time = Date.now() * 0.001 * speedMult;  // Convert to seconds, speed up during transition

  for (const star of stars) {
    const x = star.x * canvas.width;
    const y = star.y * canvas.height;

    // Twinkle effect (faster during transition)
    const twinkle = 0.5 + Math.sin(time * star.twinkleSpeed * 10 + star.twinkleOffset) * 0.5;
    const opacity = (0.4 + twinkle * 0.6) * starOpacity;

    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Draw a single celestial body (sun or moon)
function drawSingleCelestialBody(centerX, centerY, color, glowColor, isNight, opacity) {
  if (opacity <= 0) return;

  const bodyRadius = scale(isNight ? 25 : 30);

  ctx.save();
  ctx.globalAlpha = opacity;

  // Outer glow
  const glowRadius = bodyRadius * 3;
  const glowGradient = ctx.createRadialGradient(centerX, centerY, bodyRadius * 0.5, centerX, centerY, glowRadius);
  glowGradient.addColorStop(0, glowColor + '60');  // Semi-transparent
  glowGradient.addColorStop(0.5, glowColor + '20');
  glowGradient.addColorStop(1, glowColor + '00');  // Fully transparent
  ctx.fillStyle = glowGradient;
  ctx.fillRect(centerX - glowRadius, centerY - glowRadius, glowRadius * 2, glowRadius * 2);

  // Main body
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(centerX, centerY, bodyRadius, 0, Math.PI * 2);
  ctx.fill();

  // Moon craters (subtle, only at night)
  if (isNight) {
    ctx.globalAlpha = 0.15 * opacity;
    ctx.fillStyle = '#888888';
    ctx.beginPath();
    ctx.arc(centerX - bodyRadius * 0.3, centerY - bodyRadius * 0.2, bodyRadius * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX + bodyRadius * 0.2, centerY + bodyRadius * 0.3, bodyRadius * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX + bodyRadius * 0.35, centerY - bodyRadius * 0.1, bodyRadius * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// Draw sun or moon based on palette
function drawCelestialBody(palette) {
  const centerX = canvas.width * 0.5;

  // During day/night transition, draw both outgoing and incoming bodies
  if (palette.transitioning && palette.crossingDayNight) {
    // Draw outgoing body (sinking below horizon)
    const outgoing = palette.outgoingBody;
    const outgoingY = canvas.height * outgoing.y;
    drawSingleCelestialBody(centerX, outgoingY, outgoing.color, outgoing.glow, outgoing.isNight, outgoing.opacity);

    // Draw incoming body (descending from above)
    const incoming = palette.incomingBody;
    const incomingY = canvas.height * incoming.y;
    drawSingleCelestialBody(centerX, incomingY, incoming.color, incoming.glow, incoming.isNight, incoming.opacity);
  } else {
    // Normal case: single celestial body
    const centerY = canvas.height * palette.sunY;
    drawSingleCelestialBody(centerX, centerY, palette.sun, palette.sunGlow, palette.isNight, 1);
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

// Draw word with character coloring (supports two-line wrapping)
function drawWord(word, typed, x, y, fontSize) {
  const scaledSize = scale(fontSize);
  ctx.font = `bold ${scaledSize}px "Courier New", monospace`;
  const charWidth = ctx.measureText('W').width;
  const totalWidth = word.length * charWidth;
  const maxWidth = canvas.width * 0.9;

  let shakeX = 0, shakeY = 0;
  const shaking = Date.now() < state.errorShakeUntil;
  if (shaking) {
    shakeX = (Math.random() - 0.5) * scale(16);
    shakeY = (Math.random() - 0.5) * scale(16);
  }

  const offset = scale(3);

  // Check if we need to split into two lines
  let lines = [{ text: word, startIndex: 0 }];
  if (totalWidth > maxWidth) {
    // Find a space near the middle to split
    const midPoint = Math.floor(word.length / 2);
    let splitIndex = -1;
    for (let i = midPoint; i >= 0; i--) {
      if (word[i] === ' ') {
        splitIndex = i;
        break;
      }
    }
    if (splitIndex === -1) {
      for (let i = midPoint; i < word.length; i++) {
        if (word[i] === ' ') {
          splitIndex = i;
          break;
        }
      }
    }
    if (splitIndex !== -1) {
      lines = [
        { text: word.slice(0, splitIndex), startIndex: 0 },
        { text: word.slice(splitIndex + 1), startIndex: splitIndex + 1 }
      ];
    }
  }

  const lineHeight = scaledSize * 1.2;
  const totalHeight = lines.length * lineHeight;
  const startY = y - totalHeight / 2 + lineHeight / 2;

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const lineWidth = line.text.length * charWidth;
    const startX = x - lineWidth / 2;
    const lineY = startY + lineNum * lineHeight;

    for (let i = 0; i < line.text.length; i++) {
      const globalIndex = line.startIndex + i;
      let fillColor = colors.textPrimary;
      let displayChar = line.text[i];

      if (globalIndex < typed.length) {
        fillColor = colors.textCorrect;
      } else if (globalIndex === typed.length && state.wrongChar && shaking) {
        fillColor = colors.textError;
      }

      const charX = startX + i * charWidth + charWidth / 2 + shakeX;
      const charY = lineY + shakeY;

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
  drawWeather(); // Weather particles behind characters

  // Cowboys positioned relative to canvas (25% and 75% width, 80% height)
  const playerX = canvas.width * PLAYER_X;
  const enemyX = canvas.width * ENEMY_X;
  const cowboyY = canvas.height * GROUND_LEVEL;

  // Draw cowboys - use ragdoll for the loser, sprite-based for active
  if (ragdoll.active && ragdoll.isPlayer) {
    drawRagdoll(playerX, cowboyY, true);
  } else {
    drawSpriteCowboy(playerX, cowboyY, true, state.playerArmDisplay, true);
  }

  if (ragdoll.active && !ragdoll.isPlayer) {
    drawRagdoll(enemyX, cowboyY, false);
  } else {
    drawSpriteCowboy(enemyX, cowboyY, false, state.aiArmDisplay, false);
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
    // Static centered countdown position
    const countdownY = canvas.height * 0.25;
    drawOutlinedText(state.countdownValue.toString(), centerX, countdownY, 80, '#FFF');

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

  // Weather overlay (tint/haze)
  drawWeatherOverlay();

  // Version number in bottom-left corner
  ctx.font = `${scale(12)}px "Courier New", monospace`;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(`v${VERSION}`, scale(10), canvas.height - scale(10));
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

  // Start sky transition to next background
  state.skyTransition.active = true;
  state.skyTransition.fromIndex = state.currentBg;
  state.skyTransition.toIndex = (state.currentBg + 1) % skyPalettes.length;
  state.skyTransition.startTime = Date.now();

  // Initialize random weather
  initWeather();

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
  updateSkyTransition();
  updateWeather();
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

// Debug joint editor state
window.DEBUG_JOINTS = false;
window.DEBUG_SELECTED = null; // { part: 'torso', point: 'shoulderFront' }
window.DEBUG_JOINTS_LIST = []; // Populated during draw

document.addEventListener('keydown', (e) => {
  // Toggle debug joint visualization with 0 key
  if (e.key === '0') {
    window.DEBUG_JOINTS = !window.DEBUG_JOINTS;
    window.DEBUG_SELECTED = null;
    console.log('Debug joints:', window.DEBUG_JOINTS ? 'ON - click joints to select, arrows to move' : 'OFF');
  }

  // Arrow keys to adjust selected joint
  if (window.DEBUG_JOINTS && window.DEBUG_SELECTED) {
    const { part, point } = window.DEBUG_SELECTED;
    const config = skeleton[part][point];
    let moved = false;

    if (e.key === 'ArrowLeft') { config.x -= 1; moved = true; }
    if (e.key === 'ArrowRight') { config.x += 1; moved = true; }
    if (e.key === 'ArrowUp') { config.y -= 1; moved = true; }
    if (e.key === 'ArrowDown') { config.y += 1; moved = true; }

    if (moved) {
      e.preventDefault();
      console.log(`${part}.${point}: { x: ${config.x}, y: ${config.y} }`);
    }
  }

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

// Click to select debug joints
canvas.addEventListener('click', (e) => {
  if (!window.DEBUG_JOINTS || window.DEBUG_JOINTS_LIST.length === 0) return;

  const rect = canvas.getBoundingClientRect();
  const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);

  // Find closest joint within 20px
  let closest = null;
  let closestDist = 20;

  for (const joint of window.DEBUG_JOINTS_LIST) {
    const dx = joint.x - clickX;
    const dy = joint.y - clickY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < closestDist) {
      closest = joint;
      closestDist = dist;
    }
  }

  if (closest) {
    window.DEBUG_SELECTED = { part: closest.part, point: closest.point };
    const config = skeleton[closest.part][closest.point];
    console.log(`Selected ${closest.part}.${closest.point}: { x: ${config.x}, y: ${config.y} } - use arrow keys to adjust`);
  } else {
    window.DEBUG_SELECTED = null;
  }
});

console.log('Quick Draw loaded!');
initAtmosphere();
draw();
gameLoop();
