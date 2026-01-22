// Quick Draw - Typing Showdown Game
import Matter from 'matter-js';
const VERSION = '5.0.0'; // Matter.js ragdoll physics

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
// STARS (for night sky)
// ============================================

const stars = [];
const STAR_COUNT = 80;
for (let i = 0; i < STAR_COUNT; i++) {
  stars.push({
    x: Math.random(),
    y: Math.random() * 0.5,
    size: 0.5 + Math.random() * 1.5,
    twinkleOffset: Math.random() * Math.PI * 2,
    twinkleSpeed: 0.02 + Math.random() * 0.03,
  });
}

// ============================================
// PARALLAX CLOUDS
// ============================================

const cloudsBack = [];
const CLOUDS_BACK_COUNT = 4;
const cloudsFront = [];
const CLOUDS_FRONT_COUNT = 3;

function createCloud(isBack) {
  const baseSize = isBack ? 30 + Math.random() * 20 : 50 + Math.random() * 30;
  return {
    x: Math.random() * 1.5 - 0.25,
    y: isBack ? 0.08 + Math.random() * 0.15 : 0.12 + Math.random() * 0.2,
    size: baseSize,
    speed: isBack ? 0.00003 + Math.random() * 0.00002 : 0.00006 + Math.random() * 0.00003,
    puffs: generateCloudPuffs(),
    opacity: isBack ? 0.4 + Math.random() * 0.2 : 0.6 + Math.random() * 0.2,
  };
}

function generateCloudPuffs() {
  const puffs = [
    { ox: 0, oy: 0, scale: 0.8 + Math.random() * 0.4 },
    { ox: -0.7, oy: 0.1, scale: 0.5 + Math.random() * 0.3 },
    { ox: 0.7, oy: 0.05, scale: 0.6 + Math.random() * 0.3 },
  ];
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
  for (let i = 0; i < CLOUDS_BACK_COUNT; i++) cloudsBack.push(createCloud(true));
  for (let i = 0; i < CLOUDS_FRONT_COUNT; i++) cloudsFront.push(createCloud(false));
}

function updateClouds() {
  const speedMult = getTransitionSpeedMultiplier();
  for (const cloud of cloudsBack) {
    cloud.x += cloud.speed * speedMult;
    if (cloud.x > 1.3) { cloud.x = -0.3; cloud.y = 0.08 + Math.random() * 0.15; cloud.puffs = generateCloudPuffs(); }
  }
  for (const cloud of cloudsFront) {
    cloud.x += cloud.speed * speedMult;
    if (cloud.x > 1.3) { cloud.x = -0.3; cloud.y = 0.12 + Math.random() * 0.2; cloud.puffs = generateCloudPuffs(); }
  }
}

function drawClouds(palette) {
  let cloudColor, cloudOpacityMult;
  if (palette.isNight) { cloudColor = { r: 60, g: 60, b: 80 }; cloudOpacityMult = 0.3; }
  else if (palette.sunY > 0.45) { cloudColor = { r: 255, g: 180, b: 140 }; cloudOpacityMult = 0.9; }
  else if (palette.sunY > 0.35) { cloudColor = { r: 255, g: 220, b: 180 }; cloudOpacityMult = 0.85; }
  else { cloudColor = { r: 255, g: 255, b: 255 }; cloudOpacityMult = 0.75; }
  for (const cloud of cloudsBack) drawSingleCloud(cloud, cloudColor, cloudOpacityMult * 0.6);
  for (const cloud of cloudsFront) drawSingleCloud(cloud, cloudColor, cloudOpacityMult);
}

function drawSingleCloud(cloud, color, opacityMult) {
  const x = cloud.x * canvas.width;
  const y = cloud.y * canvas.height;
  const size = cloud.size * (canvas.height / 400);
  ctx.globalAlpha = cloud.opacity * opacityMult;
  for (const puff of cloud.puffs) {
    const px = x + puff.ox * size;
    const py = y + puff.oy * size;
    const psize = size * puff.scale;
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
// ATMOSPHERIC EFFECTS (dust, tumbleweeds, dust motes)
// ============================================

const dustParticles = [];
const DUST_COUNT = 40;
const tumbleweeds = [];
let lastTumbleweedTime = 0;
const TUMBLEWEED_INTERVAL = 8000 + Math.random() * 12000;
const dustMotes = [];
const MOTE_COUNT = 8;
let glintPhase = 0;

function initDust() {
  for (let i = 0; i < DUST_COUNT; i++) dustParticles.push(createDustParticle(true));
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
    if (p.x < -10) dustParticles[i] = createDustParticle(false);
  }
}

function drawDust() {
  const palette = getInterpolatedPalette();
  const dustColor = palette.isNight ? '#8090A0' : '#d4a76a';
  for (const p of dustParticles) {
    ctx.globalAlpha = p.opacity * (palette.isNight ? 0.6 : 1);
    ctx.fillStyle = dustColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

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
  const spawnInterval = state.weather.type === 'wind' ? TUMBLEWEED_INTERVAL * 0.3 : TUMBLEWEED_INTERVAL;
  const maxTumbleweeds = state.weather.type === 'wind' ? 5 : 2;
  if (now - lastTumbleweedTime > spawnInterval && tumbleweeds.length < maxTumbleweeds) {
    tumbleweeds.push(createTumbleweed());
    lastTumbleweedTime = now;
  }
  for (let i = tumbleweeds.length - 1; i >= 0; i--) {
    const t = tumbleweeds[i];
    t.x += t.speedX * speedMult;
    t.rotation += t.rotationSpeed * speedMult;
    t.bouncePhase += 0.15 * speedMult;
    t.y += Math.sin(t.bouncePhase) * 0.5 * speedMult;
    if ((t.speedX > 0 && t.x > canvas.width + t.size * 2) || (t.speedX < 0 && t.x < -t.size * 2)) {
      tumbleweeds.splice(i, 1);
    }
  }
}

function drawTumbleweeds() {
  const palette = getInterpolatedPalette();
  const tumbleweedColor = palette.isNight ? '#5A4535' : '#8B7355';
  for (const t of tumbleweeds) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rotation);
    ctx.globalAlpha = t.opacity * (palette.isNight ? 0.7 : 1);
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
    if (!m.fading) {
      m.opacity = Math.min(m.targetOpacity, m.opacity + m.fadeSpeed);
      if (m.opacity >= m.targetOpacity && Math.random() < 0.002) m.fading = true;
    } else {
      m.opacity = Math.max(0, m.opacity - m.fadeSpeed);
      if (m.opacity <= 0) {
        m.x = canvas.width + Math.random() * 100;
        m.y = canvas.height * (0.3 + Math.random() * 0.4);
        m.fading = false;
        m.targetOpacity = 0.3 + Math.random() * 0.3;
      }
    }
    if (m.x < -20) m.x = canvas.width + Math.random() * 100;
  }
}

function drawDustMotes() {
  const palette = getInterpolatedPalette();
  for (const m of dustMotes) {
    if (m.opacity <= 0) continue;
    ctx.globalAlpha = m.opacity * (palette.isNight ? 0.5 : 1);
    const gradient = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.size * 2);
    if (palette.isNight) {
      gradient.addColorStop(0, 'rgba(200, 210, 230, 0.6)');
      gradient.addColorStop(0.5, 'rgba(180, 190, 210, 0.2)');
      gradient.addColorStop(1, 'rgba(160, 170, 190, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(255, 245, 220, 0.8)');
      gradient.addColorStop(0.5, 'rgba(255, 240, 200, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 235, 180, 0)');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(m.x - m.size * 2, m.y - m.size * 2, m.size * 4, m.size * 4);
  }
  ctx.globalAlpha = 1;
}

function drawSunGlint() {
  const speedMult = getTransitionSpeedMultiplier();
  glintPhase += 0.02 * speedMult;
  const palette = getInterpolatedPalette();
  const sunX = canvas.width * 0.5;
  const sunY = canvas.height * palette.sunY;
  const pulseSize = 1 + Math.sin(glintPhase) * 0.15;
  const baseGlowSize = palette.isNight ? 0.08 : 0.15;
  const glowRadius = canvas.height * baseGlowSize * pulseSize;
  const glowColor = palette.sunGlow;
  const glowOpacity = palette.isNight ? 0.15 : 0.3;
  const gradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, glowRadius);
  gradient.addColorStop(0, glowColor + Math.round(glowOpacity * 255).toString(16).padStart(2, '0'));
  gradient.addColorStop(0.5, glowColor + Math.round(glowOpacity * 0.33 * 255).toString(16).padStart(2, '0'));
  gradient.addColorStop(1, glowColor + '00');
  ctx.fillStyle = gradient;
  ctx.fillRect(sunX - glowRadius, sunY - glowRadius, glowRadius * 2, glowRadius * 2);
  if (!palette.isNight) {
    const flareIntensity = (palette.sunY > 0.35) ? 0.2 : 0.12;
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

function initAtmosphere() {
  initDust();
  initDustMotes();
  initClouds();
  lastTumbleweedTime = Date.now();
}

function updateAtmosphere() {
  updateDust();
  updateDustMotes();
  updateTumbleweeds();
  updateClouds();
}

function drawAtmosphere() {
  drawSunGlint();
  drawDust();
  drawDustMotes();
  drawTumbleweeds();
}

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

function getWeatherWindMultiplier() {
  if (!state.weather.type) return 1;
  return weatherTypes[state.weather.type].windMultiplier * state.weather.intensity;
}

function initWeather() {
  state.weather.particles = [];
  if (Math.random() > WEATHER_CHANCE) {
    state.weather.type = null;
    state.weather.intensity = 0;
    return;
  }
  const types = Object.keys(weatherTypes);
  state.weather.type = types[Math.floor(Math.random() * types.length)];
  state.weather.intensity = 0.6 + Math.random() * 0.4;
  const config = weatherTypes[state.weather.type];
  const count = Math.floor(config.particleCount * state.weather.intensity);
  for (let i = 0; i < count; i++) {
    state.weather.particles.push(createWeatherParticle(state.weather.type, true));
  }
}

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
  } else {
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

function updateWeather() {
  if (!state.weather.type) return;
  const speedMult = getTransitionSpeedMultiplier();
  for (let i = state.weather.particles.length - 1; i >= 0; i--) {
    const p = state.weather.particles[i];
    if (state.weather.type === 'rain') {
      p.x += p.speedX * speedMult;
      p.y += p.speedY * speedMult;
      if (p.y > canvas.height || p.x < -50) {
        state.weather.particles[i] = createWeatherParticle('rain', false);
        state.weather.particles[i].y = -Math.random() * 50;
        state.weather.particles[i].x = Math.random() * canvas.width * 1.5;
      }
    } else if (state.weather.type === 'dust_storm') {
      p.wobble += 0.05 * speedMult;
      p.x += p.speedX * speedMult;
      p.y += (p.speedY + Math.sin(p.wobble) * 1.5) * speedMult;
      if (p.x < -20) state.weather.particles[i] = createWeatherParticle('dust_storm', false);
    } else {
      p.x += p.speedX * speedMult;
      p.y += p.speedY * speedMult;
      p.rotation += p.rotSpeed * speedMult;
      p.y += Math.sin(p.x * 0.02) * 0.5 * speedMult;
      if (p.x < -20) state.weather.particles[i] = createWeatherParticle('wind', false);
    }
  }
}

function drawWeather() {
  if (!state.weather.type) return;
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
  } else {
    for (const p of state.weather.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = palette.isNight ? '#4A4035' : '#7A6B55';
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

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
  if (state.weather.type === 'dust_storm') {
    const gradient = ctx.createLinearGradient(0, canvas.height * 0.5, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(139, 105, 20, 0)');
    gradient.addColorStop(1, `rgba(139, 105, 20, ${0.2 * state.weather.intensity})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// ============================================
// DAY/NIGHT CYCLE PALETTES
// ============================================

const skyPalettes = [
  { top: '#5BA3D9', mid: '#87CEEB', bottom: '#E8DCC4', sun: '#FFFDE7', sunGlow: '#FFF8E1', sunY: 0.15, isNight: false, tint: '#FFE4B5', tintOpacity: 0.08 },
  { top: '#6B9BC3', mid: '#9DC4D9', bottom: '#E8D4B8', sun: '#FFF8E1', sunGlow: '#FFECB3', sunY: 0.22, isNight: false, tint: '#FFFACD', tintOpacity: 0.05 },
  { top: '#7A9DBF', mid: '#C4A77D', bottom: '#E8C4A0', sun: '#FFE082', sunGlow: '#FFCC80', sunY: 0.30, isNight: false, tint: null, tintOpacity: 0 },
  { top: '#8B6B61', mid: '#D4956B', bottom: '#E8A870', sun: '#FFB74D', sunGlow: '#FFA726', sunY: 0.40, isNight: false, tint: '#FFD700', tintOpacity: 0.06 },
  { top: '#4A2C4A', mid: '#C75B5B', bottom: '#F4A259', sun: '#FF8A65', sunGlow: '#FF7043', sunY: 0.52, isNight: false, tint: '#FF6347', tintOpacity: 0.12 },
  { top: '#1A1A2E', mid: '#2D2D44', bottom: '#4A3A5E', sun: '#E8E8E8', sunGlow: '#B0B0B0', sunY: 0.12, isNight: true, tint: '#4169E1', tintOpacity: 0.15 },
  { top: '#151525', mid: '#252538', bottom: '#3A3A52', sun: '#E0E0E0', sunGlow: '#A0A0A0', sunY: 0.20, isNight: true, tint: '#191970', tintOpacity: 0.18 },
  { top: '#101020', mid: '#1E1E30', bottom: '#2E2E45', sun: '#D8D8D8', sunGlow: '#909090', sunY: 0.28, isNight: true, tint: '#2E1A47', tintOpacity: 0.20 },
  { top: '#0D0D1A', mid: '#1A1A2E', bottom: '#2A2A40', sun: '#D0D0D0', sunGlow: '#888888', sunY: 0.36, isNight: true, tint: '#1A1A3E', tintOpacity: 0.18 },
  { top: '#151525', mid: '#2A2A40', bottom: '#3D3D55', sun: '#C8C8C8', sunGlow: '#808080', sunY: 0.45, isNight: true, tint: '#2A1A4A', tintOpacity: 0.15 },
];

// ============================================
// SKY TRANSITION HELPERS
// ============================================

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function lerpColor(hex1, hex2, t) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  return rgbToHex(c1.r + (c2.r - c1.r) * t, c1.g + (c2.g - c1.g) * t, c1.b + (c2.b - c1.b) * t);
}

function lerpNumber(a, b, t) { return a + (b - a) * t; }

function getTransitionSpeedMultiplier() {
  if (!state.skyTransition.active) return 1;
  return 8;
}

function getInterpolatedPalette() {
  const trans = state.skyTransition;
  if (!trans.active) {
    const palette = skyPalettes[state.currentBg % skyPalettes.length];
    return { ...palette, starOpacity: palette.isNight ? 1 : 0, transitioning: false };
  }
  const elapsed = Date.now() - trans.startTime;
  const t = Math.min(1, elapsed / trans.duration);
  const from = skyPalettes[trans.fromIndex % skyPalettes.length];
  const to = skyPalettes[trans.toIndex % skyPalettes.length];
  const fromStarOpacity = from.isNight ? 1 : 0;
  const toStarOpacity = to.isNight ? 1 : 0;
  const crossingDayNight = from.isNight !== to.isNight;
  let outgoingSunY, incomingSunY, outgoingOpacity, incomingOpacity;
  if (crossingDayNight) {
    outgoingSunY = lerpNumber(from.sunY, 0.7, t);
    outgoingOpacity = Math.max(0, 1 - t * 1.5);
    const incomingT = Math.max(0, (t - 0.3) / 0.7);
    incomingSunY = lerpNumber(-0.1, to.sunY, incomingT);
    incomingOpacity = Math.min(1, (t - 0.2) * 2);
  } else {
    outgoingSunY = lerpNumber(from.sunY, to.sunY, t);
    outgoingOpacity = 1;
    incomingSunY = 0;
    incomingOpacity = 0;
  }
  return {
    top: lerpColor(from.top, to.top, t),
    mid: lerpColor(from.mid, to.mid, t),
    bottom: lerpColor(from.bottom, to.bottom, t),
    sun: lerpColor(from.sun, to.sun, t),
    sunGlow: lerpColor(from.sunGlow, to.sunGlow, t),
    sunY: outgoingSunY,
    isNight: t < 0.5 ? from.isNight : to.isNight,
    starOpacity: lerpNumber(fromStarOpacity, toStarOpacity, t),
    tint: from.tint && to.tint ? lerpColor(from.tint, to.tint, t) : (t < 0.5 ? from.tint : to.tint),
    tintOpacity: lerpNumber(from.tintOpacity, to.tintOpacity, t),
    transitioning: true,
    crossingDayNight,
    outgoingBody: { color: from.sun, glow: from.sunGlow, y: outgoingSunY, isNight: from.isNight, opacity: outgoingOpacity },
    incomingBody: { color: to.sun, glow: to.sunGlow, y: incomingSunY, isNight: to.isNight, opacity: incomingOpacity },
  };
}

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
  };
  cowboySprites[name] = img;
});

// Skeleton configuration
const skeleton = {
  baseScale: 0.22,
  torso: { pivot: { x: 50, y: 72 }, neck: { x: 50, y: 0 }, shoulderFront: { x: 5, y: 25 }, shoulderBack: { x: 94, y: 25 }, hipRight: { x: 30, y: 142 }, hipLeft: { x: 68, y: 142 } },
  head: { pivot: { x: 85, y: 115 } },
  arm_upper_front: { pivot: { x: 55, y: 15 }, elbow: { x: 25, y: 68 } },
  arm_lower_front: { pivot: { x: 45, y: 15 } },
  arm_upper_back: { pivot: { x: 18, y: 10 }, elbow: { x: 18, y: 65 } },
  arm_lower_back: { pivot: { x: 50, y: 10 } },
  leg_upper_right: { pivot: { x: 24, y: 8 }, knee: { x: 24, y: 138 } },
  leg_lower_right: { pivot: { x: 43, y: 8 } },
  leg_upper_left: { pivot: { x: 34, y: 8 }, knee: { x: 34, y: 115 } },
  leg_lower_left: { pivot: { x: 42, y: 8 } },
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

// Draw shape-based cowboy with skeletal animation
function drawCowboy(x, y, facingRight, armProgress, isPlayer) {
  ctx.save();
  const dir = facingRight ? 1 : -1;
  const s = scale(0.22); // 0.22 scale factor
  const lineWidth = scale(0.5);

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
  const legHeight = s * 200;
  const torsoHeight = s * 220;
  const headY = footY - legHeight - torsoHeight;
  const torsoY = footY - legHeight;
  const hipY = torsoY;
  const shoulderY = headY + s * 60;

  // Arm animation angles (arm rises as progress increases)
  const armRestAngle = Math.PI * 0.1;   // Arm hanging down at rest
  const armShootAngle = Math.PI * 0.55; // Arm raised to aim
  const armAngle = armRestAngle + (armShootAngle - armRestAngle) * armProgress;

  // === LEGS ===
  // Back leg
  drawShape(cowboyColors.pants, () => {
    ctx.moveTo(x - dir * s * 35, hipY);
    ctx.lineTo(x - dir * s * 50, footY - s * 60);
    ctx.lineTo(x - dir * s * 30, footY - s * 60);
    ctx.lineTo(x - dir * s * 20, hipY);
    ctx.closePath();
  });
  // Back boot
  drawShape(cowboyColors.boots, () => {
    ctx.moveTo(x - dir * s * 50, footY - s * 60);
    ctx.lineTo(x - dir * s * 60, footY);
    ctx.lineTo(x - dir * s * 20, footY);
    ctx.lineTo(x - dir * s * 30, footY - s * 60);
    ctx.closePath();
  });

  // Front leg
  drawShape(cowboyColors.pants, () => {
    ctx.moveTo(x + dir * s * 20, hipY);
    ctx.lineTo(x + dir * s * 8, footY - s * 60);
    ctx.lineTo(x + dir * s * 40, footY - s * 60);
    ctx.lineTo(x + dir * s * 35, hipY);
    ctx.closePath();
  });
  // Front boot
  drawShape(cowboyColors.boots, () => {
    ctx.moveTo(x + dir * s * 8, footY - s * 60);
    ctx.lineTo(x + dir * s * 0, footY);
    ctx.lineTo(x + dir * s * 50, footY);
    ctx.lineTo(x + dir * s * 40, footY - s * 60);
    ctx.closePath();
  });

  // === TORSO ===
  drawShape(cowboyColors.shirt, () => {
    ctx.moveTo(x - dir * s * 60, shoulderY);
    ctx.lineTo(x + dir * s * 70, shoulderY);
    ctx.lineTo(x + dir * s * 50, hipY);
    ctx.lineTo(x - dir * s * 40, hipY);
    ctx.closePath();
  });

  // Vest
  drawShape(cowboyColors.vest, () => {
    ctx.moveTo(x + dir * s * 20, shoulderY);
    ctx.lineTo(x + dir * s * 65, shoulderY + s * 20);
    ctx.lineTo(x + dir * s * 45, hipY);
    ctx.lineTo(x + dir * s * 10, hipY);
    ctx.closePath();
  });

  // === BACK ARM ===
  const backShoulderX = x - dir * s * 50;
  const backShoulderY = shoulderY + s * 20;
  const backElbowX = backShoulderX - dir * s * 30;
  const backElbowY = backShoulderY + s * 70;
  const backHandX = backElbowX - dir * s * 10;
  const backHandY = backElbowY + s * 50;

  // Upper arm
  ctx.lineWidth = s * 35;
  ctx.strokeStyle = cowboyColors.shirt;
  ctx.beginPath();
  ctx.moveTo(backShoulderX, backShoulderY);
  ctx.lineTo(backElbowX, backElbowY);
  ctx.stroke();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = lineWidth;

  // Lower arm
  ctx.lineWidth = s * 30;
  ctx.strokeStyle = cowboyColors.shirt;
  ctx.beginPath();
  ctx.moveTo(backElbowX, backElbowY);
  ctx.lineTo(backHandX, backHandY);
  ctx.stroke();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = lineWidth;

  // Back hand
  ctx.fillStyle = cowboyColors.skin;
  ctx.beginPath();
  ctx.arc(backHandX, backHandY, s * 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // === FRONT ARM (gun arm) ===
  const frontShoulderX = x + dir * s * 55;
  const frontShoulderY = shoulderY + s * 20;
  const armLen = s * 80;
  const forearmLen = s * 70;

  const frontElbowX = frontShoulderX + Math.sin(dir * armAngle) * armLen;
  const frontElbowY = frontShoulderY + Math.cos(armAngle) * armLen;
  const frontHandX = frontElbowX + Math.sin(dir * armAngle * 0.5) * forearmLen;
  const frontHandY = frontElbowY + Math.cos(armAngle * 0.5) * forearmLen;

  // Upper arm
  ctx.lineWidth = s * 35;
  ctx.strokeStyle = cowboyColors.shirt;
  ctx.beginPath();
  ctx.moveTo(frontShoulderX, frontShoulderY);
  ctx.lineTo(frontElbowX, frontElbowY);
  ctx.stroke();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = lineWidth;

  // Lower arm
  ctx.lineWidth = s * 30;
  ctx.strokeStyle = cowboyColors.shirt;
  ctx.beginPath();
  ctx.moveTo(frontElbowX, frontElbowY);
  ctx.lineTo(frontHandX, frontHandY);
  ctx.stroke();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = lineWidth;

  // Front hand
  ctx.fillStyle = cowboyColors.skin;
  ctx.beginPath();
  ctx.arc(frontHandX, frontHandY, s * 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Gun
  const gunAngle = Math.atan2(frontHandY - frontElbowY, frontHandX - frontElbowX);
  ctx.save();
  ctx.translate(frontHandX, frontHandY);
  ctx.rotate(gunAngle);
  ctx.fillStyle = cowboyColors.gun;
  ctx.fillRect(0, -s * 12, s * 70, s * 24);
  ctx.strokeRect(0, -s * 12, s * 70, s * 24);
  ctx.restore();

  // === HEAD ===
  const headCenterY = headY + s * 50;
  ctx.fillStyle = cowboyColors.skin;
  ctx.beginPath();
  ctx.arc(x, headCenterY, s * 55, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Eyes
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(x - dir * s * 15, headCenterY - s * 5, s * 8, 0, Math.PI * 2);
  ctx.arc(x + dir * s * 15, headCenterY - s * 5, s * 8, 0, Math.PI * 2);
  ctx.fill();

  // Hat brim
  ctx.fillStyle = cowboyColors.hat;
  ctx.beginPath();
  ctx.ellipse(x, headCenterY - s * 40, s * 80, s * 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hat top
  ctx.fillRect(x - s * 40, headCenterY - s * 120, s * 80, s * 80);
  ctx.strokeRect(x - s * 40, headCenterY - s * 120, s * 80, s * 80);

  // Hat band
  ctx.fillStyle = cowboyColors.hatBand;
  ctx.fillRect(x - s * 40, headCenterY - s * 50, s * 80, s * 12);

  ctx.restore();

  // Store hitbox data for targeting (enemy only)
  if (!isPlayer && state.phase === 'targeting') {
    state.targets = [
      { id: 'head', x: x, y: headCenterY, r: s * 60, label: 'HEAD' },
      { id: 'chest', x: x, y: shoulderY + s * 80, r: s * 70, label: 'CHEST' },
      { id: 'groin', x: x, y: hipY + s * 30, r: s * 50, label: 'LEGS' },
      { id: 'arm', x: frontElbowX, y: frontElbowY, r: s * 40, label: 'ARM' }
    ];
  }
}

// ============================================
// GAME STATE & PHYSICS CONSTANTS
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

const state = {
  phase: 'idle', // idle, countdown, playing, targeting, bullet_time, finished
  currentWord: '',
  playerTyped: '',
  playerProgress: 0,
  playerArmDisplay: 0,
  playerErrors: 0,
  aiProgress: 0,
  aiArmDisplay: 0,
  aiTyped: '',
  winStreak: 0,
  countdownValue: 3,
  winner: null,
  playerFinishTime: null,
  aiFinishTime: null,
  roundStartTime: null,
  showingResult: false,
  errorShakeUntil: 0,
  muzzleFlashUntil: 0,
  currentBg: 0,
  wrongChar: null,
  countdownInterval: null,
  roundEndTime: null,
  timeouts: [],
  bullet: null,
  blood: [],
  stains: [], // Permanent blood stains on floor
  gibs: [],
  targets: [], // Hit zones for targeting phase
  hoverTarget: null,
  selectedTarget: null, // The body part chosen to shoot
  timeScale: 1.0, // For slow motion (1.0 = normal, 0.25 = slow)
  skyTransition: {
    active: false,
    fromIndex: 0,
    toIndex: 0,
    startTime: 0,
    duration: 1500,
  },
  weather: {
    type: null,
    intensity: 0,
    particles: [],
  },
};

// Physics spring for arms
const physics = {
  player: { position: 0, velocity: 0, target: 0 },
  ai: { position: 0, velocity: 0, target: 0 },
  stiffness: 0.3,
  damping: 0.6,
  maxVelocity: 0.15,
};

function updatePhysics() {
  const pSpring = physics.player;
  const pForce = (pSpring.target - pSpring.position) * physics.stiffness;
  pSpring.velocity += pForce;
  pSpring.velocity *= physics.damping;
  pSpring.velocity = Math.max(-physics.maxVelocity, Math.min(physics.maxVelocity, pSpring.velocity));
  pSpring.position += pSpring.velocity;
  state.playerArmDisplay = pSpring.position;

  const aSpring = physics.ai;
  const aForce = (aSpring.target - aSpring.position) * physics.stiffness;
  aSpring.velocity += aForce;
  aSpring.velocity *= physics.damping;
  aSpring.velocity = Math.max(-physics.maxVelocity, Math.min(physics.maxVelocity, aSpring.velocity));
  aSpring.position += aSpring.velocity;
  state.aiArmDisplay = aSpring.position;
}

function setPlayerArmTarget(target) { physics.player.target = target; }
function setAiArmTarget(target) { physics.ai.target = target; }

// ============================================
// MATTER.JS RAGDOLL PHYSICS
// ============================================

const { Engine, Render, Bodies, Body, Composite, Constraint, World, Events } = Matter;

// Create Matter.js engine
const matterEngine = Engine.create();
matterEngine.gravity.y = 1;

// Ragdoll state
const ragdoll = {
  active: false,
  isPlayer: false,
  groundY: 0,
  wound: null,
  bodies: {},      // Named body parts
  constraints: [], // Joint constraints
  ground: null,    // Ground body
  walls: [],       // Wall bodies
};

// Create the ragdoll composite body
function createRagdollBody(x, y) {
  const s = scale(0.7);
  const bodies = {};

  // Body part dimensions (width, height)
  const parts = {
    head:     { w: s * 28, h: s * 28, y: -s * 95 },
    torso:    { w: s * 24, h: s * 50, y: -s * 50 },
    upperArmF: { w: s * 8, h: s * 20, y: -s * 55, x: s * 18 },
    lowerArmF: { w: s * 6, h: s * 22, y: -s * 35, x: s * 32 },
    upperArmB: { w: s * 8, h: s * 20, y: -s * 55, x: -s * 18 },
    lowerArmB: { w: s * 6, h: s * 22, y: -s * 35, x: -s * 32 },
    upperLegL: { w: s * 10, h: s * 25, y: -s * 18, x: -s * 8 },
    lowerLegL: { w: s * 9, h: s * 22, y: s * 5, x: -s * 10 },
    upperLegR: { w: s * 10, h: s * 25, y: -s * 18, x: s * 8 },
    lowerLegR: { w: s * 9, h: s * 22, y: s * 5, x: s * 10 },
  };

  // Create body parts
  for (const [name, part] of Object.entries(parts)) {
    const px = x + (part.x || 0);
    const py = y + part.y;

    if (name === 'head') {
      bodies[name] = Bodies.circle(px, py, part.w / 2, {
        friction: 0.8,
        restitution: 0.2,
        label: name,
      });
    } else {
      bodies[name] = Bodies.rectangle(px, py, part.w, part.h, {
        friction: 0.8,
        restitution: 0.2,
        chamfer: { radius: 3 },
        label: name,
      });
    }
  }

  // Joint constraints with angle limits
  const constraints = [];

  // Helper to create a joint
  const joint = (bodyA, bodyB, offsetA, offsetB, stiffness = 0.9, angularStiffness = 0.7) => {
    return Constraint.create({
      bodyA: bodies[bodyA],
      bodyB: bodies[bodyB],
      pointA: offsetA,
      pointB: offsetB,
      stiffness: stiffness,
      damping: 0.3,
      length: 0,
    });
  };

  // Head to torso
  constraints.push(joint('head', 'torso', { x: 0, y: s * 14 }, { x: 0, y: -s * 25 }));

  // Arms to torso
  constraints.push(joint('upperArmF', 'torso', { x: 0, y: -s * 10 }, { x: s * 12, y: -s * 20 }));
  constraints.push(joint('lowerArmF', 'upperArmF', { x: 0, y: -s * 11 }, { x: 0, y: s * 10 }));
  constraints.push(joint('upperArmB', 'torso', { x: 0, y: -s * 10 }, { x: -s * 12, y: -s * 20 }));
  constraints.push(joint('lowerArmB', 'upperArmB', { x: 0, y: -s * 11 }, { x: 0, y: s * 10 }));

  // Legs to torso
  constraints.push(joint('upperLegL', 'torso', { x: 0, y: -s * 12 }, { x: -s * 6, y: s * 25 }));
  constraints.push(joint('lowerLegL', 'upperLegL', { x: 0, y: -s * 11 }, { x: 0, y: s * 12 }));
  constraints.push(joint('upperLegR', 'torso', { x: 0, y: -s * 12 }, { x: s * 6, y: s * 25 }));
  constraints.push(joint('lowerLegR', 'upperLegR', { x: 0, y: -s * 11 }, { x: 0, y: s * 12 }));

  return { bodies, constraints };
}

function initRagdoll(baseX, groundY) {
  // Clear any existing bodies
  World.clear(matterEngine.world);

  // Create ground
  const groundThickness = 60;
  ragdoll.ground = Bodies.rectangle(
    canvas.width / 2,
    groundY + groundThickness / 2,
    canvas.width,
    groundThickness,
    { isStatic: true, friction: 0.9 }
  );

  // Create walls
  const wallThickness = 50;
  const leftWall = Bodies.rectangle(
    canvas.width * 0.18 - wallThickness / 2,
    canvas.height / 2,
    wallThickness,
    canvas.height,
    { isStatic: true }
  );
  const rightWall = Bodies.rectangle(
    canvas.width * 0.82 + wallThickness / 2,
    canvas.height / 2,
    wallThickness,
    canvas.height,
    { isStatic: true }
  );
  ragdoll.walls = [leftWall, rightWall];

  // Create ragdoll
  const { bodies, constraints } = createRagdollBody(baseX, groundY);
  ragdoll.bodies = bodies;
  ragdoll.constraints = constraints;
  ragdoll.groundY = groundY;

  // Add everything to the world
  World.add(matterEngine.world, [
    ragdoll.ground,
    ...ragdoll.walls,
    ...Object.values(bodies),
    ...constraints,
  ]);
}

function updateRagdoll() {
  if (!ragdoll.active) return;

  // Step the physics engine
  Engine.update(matterEngine, 1000 / 60);
}

function resetRagdoll() {
  ragdoll.active = false;
  ragdoll.wound = null;
  ragdoll.bodies = {};
  ragdoll.constraints = [];
  World.clear(matterEngine.world);
}

// Get render position for a body part (for drawing)
function getBodyPosition(name) {
  const body = ragdoll.bodies[name];
  if (!body) return null;
  return {
    x: body.position.x,
    y: body.position.y,
    angle: body.angle,
  };
}

// ============================================
// COMBAT & PHYSICS LOGIC
// ============================================

function fireBullet(fromX, fromY, toX, toY, isPlayerShooting) {
  const speed = 40; // Super fast bullet
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  state.bullet = {
    x: fromX, y: fromY,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    targetX: toX, targetY: toY,
    isPlayerShooting: isPlayerShooting,
  };
}

function updateBullet() {
  if (!state.bullet) return;
  const b = state.bullet;

  b.x += b.vx;
  b.y += b.vy;

  const dx = b.targetX - b.x;
  const dy = b.targetY - b.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 40) { // Impact
    spawnBlood(b.x, b.y, b.vx, b.vy);
    spawnGibs(b.x, b.y, b.vx, b.vy);

    // Start ragdoll
    const loserIsPlayer = !b.isPlayerShooting;
    const baseX = loserIsPlayer ? canvas.width * PLAYER_X : canvas.width * ENEMY_X;
    const baseY = canvas.height * GROUND_LEVEL;

    // TRIGGER SLOW MO
    state.timeScale = 0.25;

    startRagdollWithImpact(loserIsPlayer, baseX, baseY, b.vx, b.vy);
    state.bullet = null;
    state.roundEndTime = Date.now();
  }
}

function spawnBlood(x, y, bulletVx, bulletVy) {
  const numParticles = 30 + Math.floor(Math.random() * 20);
  for (let i = 0; i < numParticles; i++) {
    const spread = (Math.random() - 0.5) * 2;
    const speed = 3 + Math.random() * 8;
    const angle = Math.atan2(bulletVy, bulletVx) + spread;
    state.blood.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 5,
      life: 1.0,
      color: Math.random() > 0.3 ? '#8B0000' : '#5C0000'
    });
  }
}

function spawnGibs(x, y, bulletVx, bulletVy) {
  const numGibs = 5 + Math.floor(Math.random() * 5);
  for (let i = 0; i < numGibs; i++) {
    const spread = (Math.random() - 0.5) * 1.5;
    const speed = 2 + Math.random() * 6;
    const angle = Math.atan2(bulletVy, bulletVx) + spread;
    state.gibs.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - Math.random() * 3,
      size: 3 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.4,
      life: 1.0,
      color: Math.random() > 0.5 ? '#8B0000' : '#654321'
    });
  }
}

function updateBlood() {
  const gravity = 0.4;
  const groundY = canvas.height * GROUND_LEVEL;

  for (let i = state.blood.length - 1; i >= 0; i--) {
    const p = state.blood[i];
    p.vy += gravity;
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.005;

    // Floor Staining Logic
    if (p.y > groundY) {
      // Create permanent stain
      state.stains.push({
        x: p.x,
        y: groundY + Math.random() * 5, // Slight depth variation
        scaleX: 1 + Math.random() * 2,
        scaleY: 0.2 + Math.random() * 0.3, // Flattened
        alpha: p.life * 0.8,
        color: p.color
      });
      state.blood.splice(i, 1);
      continue;
    }

    if (p.life <= 0) state.blood.splice(i, 1);
  }
}

function updateGibs() {
    const gravity = 0.5;
    const groundY = canvas.height * GROUND_LEVEL;
    for (let i = state.gibs.length - 1; i >= 0; i--) {
        const g = state.gibs[i];
        g.vy += gravity;
        g.x += g.vx;
        g.y += g.vy;
        g.rot += g.vrot;
        g.life -= 0.003;
        if (g.y > groundY) {
            g.y = groundY;
            g.vy *= -0.2; g.vx *= 0.7; g.vrot *= 0.5;
            if (Math.abs(g.vy) < 0.5) { g.vy = 0; g.vrot = 0; }
        }
        if (g.life <= 0) state.gibs.splice(i, 1);
    }
}

function startRagdollWithImpact(isPlayer, baseX, groundY, bulletVx, bulletVy) {
  ragdoll.active = true;
  ragdoll.isPlayer = isPlayer;

  // Initialize the Matter.js ragdoll
  initRagdoll(baseX, groundY);

  const hitDir = bulletVx > 0 ? 1 : -1;
  const b = ragdoll.bodies;
  const target = state.selectedTarget || 'chest';
  const forceMult = 0.15; // Adjust for good visual impact

  // Helper to apply force to a body
  const applyImpact = (bodyName, forceX, forceY) => {
    if (b[bodyName]) {
      Body.applyForce(b[bodyName], b[bodyName].position, {
        x: forceX * forceMult,
        y: forceY * forceMult,
      });
    }
  };

  // Specific Physics Reactions based on Hit Zone
  if (target === 'head') {
    // Headshot: Violent snap back
    applyImpact('head', -hitDir * 0.8, -0.4);
    applyImpact('torso', -hitDir * 0.3, 0);
    // Add spin by pushing shoulders opposite ways
    Body.setAngularVelocity(b.torso, hitDir * 0.3);
  }
  else if (target === 'groin') {
    // Leg shot: Sweep feet, faceplant
    applyImpact('lowerLegL', hitDir * 0.5, -0.2);
    applyImpact('lowerLegR', hitDir * 0.5, -0.2);
    applyImpact('upperLegL', hitDir * 0.3, -0.1);
    applyImpact('upperLegR', hitDir * 0.3, -0.1);
    applyImpact('head', -hitDir * 0.1, 0);
  }
  else if (target === 'arm') {
    // Arm shot: Spin
    applyImpact('upperArmF', -hitDir * 0.6, -0.3);
    applyImpact('lowerArmF', -hitDir * 0.5, -0.2);
    Body.setAngularVelocity(b.torso, hitDir * 0.2);
  }
  else {
    // Chest (Default): Big knockback
    applyImpact('torso', -hitDir * 0.6, -0.2);
    applyImpact('head', -hitDir * 0.4, -0.1);
  }

  // Generic limb flail
  applyImpact('lowerArmF', (Math.random() - 0.5) * 0.3, -0.3);
  applyImpact('lowerArmB', (Math.random() - 0.5) * 0.2, -0.2);
}

// ============================================
// DRAWING
// ============================================

function scale(val) { return val * (canvas.height / 400); }

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

  // Layer 6: Color tint overlay for time-of-day lighting
  if (palette.tint && palette.tintOpacity > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = palette.tintOpacity;
    ctx.fillStyle = palette.tint;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

function drawStars(starOpacity = 1) {
  const speedMult = getTransitionSpeedMultiplier();
  const time = Date.now() * 0.001 * speedMult;
  for (const star of stars) {
    const x = star.x * canvas.width;
    const y = star.y * canvas.height;
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

function drawSingleCelestialBody(centerX, centerY, color, glowColor, isNight, opacity) {
  if (opacity <= 0) return;
  const bodyRadius = scale(isNight ? 25 : 30);
  ctx.save();
  ctx.globalAlpha = opacity;
  const glowRadius = bodyRadius * 3;
  const glowGradient = ctx.createRadialGradient(centerX, centerY, bodyRadius * 0.5, centerX, centerY, glowRadius);
  glowGradient.addColorStop(0, glowColor + '60');
  glowGradient.addColorStop(0.5, glowColor + '20');
  glowGradient.addColorStop(1, glowColor + '00');
  ctx.fillStyle = glowGradient;
  ctx.fillRect(centerX - glowRadius, centerY - glowRadius, glowRadius * 2, glowRadius * 2);
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(centerX, centerY, bodyRadius, 0, Math.PI * 2);
  ctx.fill();
  if (isNight) {
    ctx.globalAlpha = 0.15 * opacity;
    ctx.fillStyle = '#888888';
    ctx.beginPath(); ctx.arc(centerX - bodyRadius * 0.3, centerY - bodyRadius * 0.2, bodyRadius * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(centerX + bodyRadius * 0.2, centerY + bodyRadius * 0.3, bodyRadius * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(centerX + bodyRadius * 0.35, centerY - bodyRadius * 0.1, bodyRadius * 0.08, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawCelestialBody(palette) {
  const centerX = canvas.width * 0.5;
  if (palette.transitioning && palette.crossingDayNight) {
    const outgoing = palette.outgoingBody;
    const outgoingY = canvas.height * outgoing.y;
    drawSingleCelestialBody(centerX, outgoingY, outgoing.color, outgoing.glow, outgoing.isNight, outgoing.opacity);
    const incoming = palette.incomingBody;
    const incomingY = canvas.height * incoming.y;
    drawSingleCelestialBody(centerX, incomingY, incoming.color, incoming.glow, incoming.isNight, incoming.opacity);
  } else {
    const centerY = canvas.height * palette.sunY;
    drawSingleCelestialBody(centerX, centerY, palette.sun, palette.sunGlow, palette.isNight, 1);
  }
}

function drawStains() {
    for (const stain of state.stains) {
        ctx.save();
        ctx.globalAlpha = stain.alpha;
        ctx.fillStyle = stain.color;
        ctx.translate(stain.x, stain.y);
        ctx.scale(stain.scaleX, stain.scaleY);
        ctx.beginPath();
        ctx.arc(0, 0, scale(3), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}

function drawOutlinedText(text, x, y, fontSize, fillColor) {
  const scaledSize = scale(fontSize);
  ctx.font = `bold ${scaledSize}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const offset = scale(3);
  ctx.fillStyle = '#000';
  ctx.fillText(text, x + offset, y + offset);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = scale(4);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
}

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
    const midPoint = Math.floor(word.length / 2);
    let splitIndex = -1;
    for (let i = midPoint; i >= 0; i--) {
      if (word[i] === ' ') { splitIndex = i; break; }
    }
    if (splitIndex === -1) {
      for (let i = midPoint; i < word.length; i++) {
        if (word[i] === ' ') { splitIndex = i; break; }
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

function drawMuzzleFlash(x, y) {
  if (Date.now() < state.muzzleFlashUntil) {
    // Core
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(x, y, scale(12), 0, Math.PI*2);
    ctx.fill();
    // Spikes
    ctx.fillStyle = '#FFD700';
    for(let i=0; i<5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const len = scale(30 + Math.random()*20);
        ctx.beginPath();
        ctx.moveTo(x,y);
        ctx.lineTo(x + Math.cos(angle)*len, y + Math.sin(angle)*len);
        ctx.lineWidth = scale(4);
        ctx.strokeStyle = '#FFA500';
        ctx.stroke();
    }
  }
}

function drawTargets() {
    if (state.phase !== 'targeting') return;

    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw target instruction
    ctx.font = `bold ${scale(30)}px "Courier New"`;
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center';
    ctx.fillText("FINISH HIM", canvas.width/2, scale(80));
    ctx.font = `${scale(16)}px "Courier New"`;
    ctx.fillText("SELECT TARGET", canvas.width/2, scale(110));

    // Draw reticles
    for (const t of state.targets) {
        const isHover = state.hoverTarget === t.id;
        const pulse = Math.sin(Date.now() / 100) * 0.1 + 1;
        const r = t.r * (isHover ? 1.2 : 1.0) * pulse;

        ctx.strokeStyle = isHover ? '#FF0000' : '#FFFFFF';
        ctx.lineWidth = scale(isHover ? 4 : 2);

        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshair lines
        ctx.beginPath();
        ctx.moveTo(t.x - r/2, t.y); ctx.lineTo(t.x + r/2, t.y);
        ctx.moveTo(t.x, t.y - r/2); ctx.lineTo(t.x, t.y + r/2);
        ctx.stroke();

        if (isHover) {
            ctx.fillStyle = '#FF0000';
            ctx.font = `bold ${scale(14)}px Arial`;
            ctx.fillText(t.label, t.x, t.y - r - 5);
        }
    }
}

function drawRagdoll(baseX, baseY, isPlayer) {
  if (!ragdoll.bodies.head) return;
  const s = scale(0.7);
  const b = ragdoll.bodies;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Helper to draw a rotated rectangle body part
  const drawBodyPart = (body, color, widthMult = 1, heightMult = 1) => {
    if (!body) return;
    const pos = body.position;
    const angle = body.angle;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);

    // Get dimensions from body bounds
    const w = (body.bounds.max.x - body.bounds.min.x) * widthMult;
    const h = (body.bounds.max.y - body.bounds.min.y) * heightMult;

    ctx.fillStyle = color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  // Draw back leg (behind torso)
  drawBodyPart(b.upperLegL, cowboyColors.pants);
  drawBodyPart(b.lowerLegL, cowboyColors.pants);

  // Draw back arm (behind torso)
  drawBodyPart(b.upperArmB, cowboyColors.shirt);
  drawBodyPart(b.lowerArmB, cowboyColors.shirt);

  // Draw torso
  drawBodyPart(b.torso, cowboyColors.shirt);

  // Draw front leg
  drawBodyPart(b.upperLegR, cowboyColors.pants);
  drawBodyPart(b.lowerLegR, cowboyColors.pants);

  // Draw front arm
  drawBodyPart(b.upperArmF, cowboyColors.shirt);
  drawBodyPart(b.lowerArmF, cowboyColors.shirt);

  // Draw hands (circles at end of lower arms)
  ctx.fillStyle = cowboyColors.skin;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  if (b.lowerArmF) {
    const handF = b.lowerArmF.position;
    const angleF = b.lowerArmF.angle;
    const handOffsetF = s * 11;
    ctx.beginPath();
    ctx.arc(
      handF.x + Math.sin(angleF) * handOffsetF,
      handF.y + Math.cos(angleF) * handOffsetF,
      s * 5, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();
  }
  if (b.lowerArmB) {
    const handB = b.lowerArmB.position;
    const angleB = b.lowerArmB.angle;
    const handOffsetB = s * 11;
    ctx.beginPath();
    ctx.arc(
      handB.x + Math.sin(angleB) * handOffsetB,
      handB.y + Math.cos(angleB) * handOffsetB,
      s * 5, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();
  }

  // Draw boots (circles at end of lower legs)
  ctx.fillStyle = cowboyColors.boots;
  if (b.lowerLegL) {
    const footL = b.lowerLegL.position;
    const angleL = b.lowerLegL.angle;
    const footOffset = s * 11;
    ctx.beginPath();
    ctx.arc(
      footL.x + Math.sin(angleL) * footOffset,
      footL.y + Math.cos(angleL) * footOffset,
      s * 6, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();
  }
  if (b.lowerLegR) {
    const footR = b.lowerLegR.position;
    const angleR = b.lowerLegR.angle;
    const footOffset = s * 11;
    ctx.beginPath();
    ctx.arc(
      footR.x + Math.sin(angleR) * footOffset,
      footR.y + Math.cos(angleR) * footOffset,
      s * 6, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();
  }

  // Draw head
  if (b.head) {
    const head = b.head.position;
    const headAngle = b.head.angle;

    ctx.fillStyle = cowboyColors.skin;
    ctx.beginPath();
    ctx.arc(head.x, head.y, s * 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hat (rotates with head)
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(headAngle);

    ctx.fillStyle = cowboyColors.hat;
    ctx.beginPath();
    ctx.ellipse(0, -s * 10, s * 20, s * 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(-s * 10, -s * 30, s * 20, s * 20);
    ctx.fill();
    ctx.stroke();

    // X eyes (dead)
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    const eyeSize = s * 4;
    // Left eye X
    ctx.beginPath();
    ctx.moveTo(-s * 5 - eyeSize, -eyeSize);
    ctx.lineTo(-s * 5 + eyeSize, eyeSize);
    ctx.moveTo(-s * 5 + eyeSize, -eyeSize);
    ctx.lineTo(-s * 5 - eyeSize, eyeSize);
    ctx.stroke();
    // Right eye X
    ctx.beginPath();
    ctx.moveTo(s * 5 - eyeSize, -eyeSize);
    ctx.lineTo(s * 5 + eyeSize, eyeSize);
    ctx.moveTo(s * 5 + eyeSize, -eyeSize);
    ctx.lineTo(s * 5 - eyeSize, eyeSize);
    ctx.stroke();

    ctx.restore();
  }
}

// ============================================
// GAME LOGIC & LOOP
// ============================================

// AI logic
const ai = { baseWPM: 25, wpmPerStreak: 3, maxWPM: 80, lastTypeTime: 0 };
const sentences = {
  short: ['draw now', 'hands up', 'you lose'],
  medium: ['reach for the sky', 'time to meet your maker', 'this is the end partner'],
  long: ['this town aint big enough for both of us']
};
function generateWord(streak) {
  const pool = streak > 3 ? sentences.long : sentences.medium;
  return pool[Math.floor(Math.random() * pool.length)];
}

function updateAI() {
  if (state.phase !== 'playing') return;
  const now = Date.now();
  const wpm = Math.min(ai.baseWPM + (state.winStreak * ai.wpmPerStreak), ai.maxWPM);
  const interval = 60000 / (wpm * 5);

  if (now - ai.lastTypeTime >= interval) {
    ai.lastTypeTime = now;
    if (state.aiTyped.length < state.currentWord.length) {
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
}

function startRound() {
  state.phase = 'playing';
  state.currentWord = generateWord(state.winStreak);
  state.roundStartTime = Date.now();
  ai.lastTypeTime = Date.now();
  hiddenInput.focus();
}

function checkWinner() {
  if (state.winner) return;
  const playerDone = state.playerFinishTime !== null;
  const aiDone = state.aiFinishTime !== null;
  if (playerDone && !aiDone) endRound('player');
  else if (aiDone && !playerDone) endRound('ai');
  else if (playerDone && aiDone) endRound('player'); // Tie goes to player
}

function endRound(winner) {
  state.winner = winner;
  state.roundEndTime = Date.now();

  if (winner === 'player') {
      // ENTER TARGETING PHASE
      state.phase = 'targeting';
      state.winStreak++;
  } else {
      // AI WINS - Standard death
      state.phase = 'bullet_time';
      state.winStreak = 0;
      state.selectedTarget = 'chest';

      const playerX = canvas.width * PLAYER_X;
      const enemyX = canvas.width * ENEMY_X;
      const gunY = canvas.height * GROUND_LEVEL - scale(60);

      fireBullet(enemyX - scale(50), gunY, playerX, gunY, false);
      state.muzzleFlashUntil = Date.now() + 100;
  }
}

function triggerPlayerShot(targetId) {
    state.phase = 'bullet_time';
    state.selectedTarget = targetId;

    const playerX = canvas.width * PLAYER_X;
    const enemyX = canvas.width * ENEMY_X;
    const gunY = canvas.height * GROUND_LEVEL - scale(60);

    // Find target coordinates
    const t = state.targets.find(t => t.id === targetId) || state.targets[1];

    // Visuals
    state.muzzleFlashUntil = Date.now() + 150;

    // Fire!
    fireBullet(playerX + scale(50), gunY, t.x, t.y, true);
}

// Main Draw Loop
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Background (sky, sun/moon, clouds, foreground)
  drawBackground();

  // 2. Atmospheric effects (dust, tumbleweeds, glint)
  drawAtmosphere();

  // 2.5. Weather particles (behind characters)
  drawWeather();

  // 3. Stains (Behind characters)
  drawStains();

  // 3. Characters
  const playerX = canvas.width * PLAYER_X;
  const enemyX = canvas.width * ENEMY_X;
  const cowboyY = canvas.height * GROUND_LEVEL;

  if (ragdoll.active && ragdoll.isPlayer) drawRagdoll(playerX, cowboyY, true);
  else drawCowboy(playerX, cowboyY, true, state.playerArmDisplay, true);

  if (ragdoll.active && !ragdoll.isPlayer) drawRagdoll(enemyX, cowboyY, false);
  else drawCowboy(enemyX, cowboyY, false, state.aiArmDisplay, false);

  // 4. Effects
  if (state.bullet) {
      ctx.fillStyle = '#444';
      ctx.beginPath(); ctx.arc(state.bullet.x, state.bullet.y, scale(4), 0, Math.PI*2); ctx.fill();
      // Bullet trail
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = scale(2);
      ctx.beginPath(); ctx.moveTo(state.bullet.x, state.bullet.y);
      ctx.lineTo(state.bullet.x - state.bullet.vx*4, state.bullet.y - state.bullet.vy*4);
      ctx.stroke();
  }

  // Blood
  for (const p of state.blood) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Gibs
  for (const g of state.gibs) {
     ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.rot);
     ctx.globalAlpha = Math.min(1, g.life * 2);
     ctx.fillStyle = g.color; ctx.fillRect(-g.size/2, -g.size/2, g.size, g.size);
     ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Muzzle Flash
  if (state.winner === 'player') drawMuzzleFlash(playerX + scale(70), cowboyY - scale(80));
  else if (state.winner === 'ai') drawMuzzleFlash(enemyX - scale(70), cowboyY - scale(80));

  // 5. Weather overlay (tint/fog effect)
  drawWeatherOverlay();

  // 6. UI - Targeting overlay
  drawTargets();

  // 7. Text UI
  const centerX = canvas.width/2;

  if (state.phase === 'playing' && state.currentWord) {
      drawWord(state.currentWord, state.playerTyped, centerX, scale(100), 56);
  } else if (state.phase === 'countdown') {
      drawOutlinedText(state.countdownValue.toString(), centerX, scale(150), 80, '#FFF');
  } else if (state.phase === 'finished') {
      const winColor = state.winner === 'player' ? colors.textCorrect : colors.textError;
      const winText = state.winner === 'player' ? 'YOU WIN' : 'YOU LOSE';
      drawOutlinedText(winText, centerX, scale(80), 64, winColor);
      if (state.currentWord) {
        drawWord(state.currentWord, state.playerTyped, centerX, scale(150), 48);
      }
      if (Date.now() - state.roundEndTime > 2000) {
        drawOutlinedText("Press Space to Continue", centerX, canvas.height * 0.9, 20, '#FFF');
      }
  } else if (state.phase === 'idle') {
      drawOutlinedText("Press Space to Start", centerX, scale(150), 40, '#FFF');
  }

  // Version
  ctx.font = `${scale(12)}px Courier New`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'right';
  ctx.fillText(`v${VERSION}`, canvas.width - 10, canvas.height - 10);
}

// ============================================
// MAIN LOOP with FIXED TIMESTEP
// ============================================

let lastTime = Date.now();
let accumulator = 0;
const FIXED_STEP = 1000 / 60; // 60 updates per second

function gameLoop() {
  const now = Date.now();
  const frameTime = now - lastTime;
  lastTime = now;

  // Accumulate time based on timeScale (Slow Mo Logic)
  accumulator += frameTime * state.timeScale;

  // Cap accumulator to prevent spiral of death
  if (accumulator > 200) accumulator = 200;

  while (accumulator >= FIXED_STEP) {
    updateGameLogic();
    accumulator -= FIXED_STEP;
  }

  // Gradually restore time scale
  if (state.timeScale < 1.0 && state.phase === 'finished') {
    state.timeScale = Math.min(1.0, state.timeScale + 0.005);
  }

  draw();
  requestAnimationFrame(gameLoop);
}

function updateGameLogic() {
    updateAI();
    updatePhysics();
    updateBullet();
    updateBlood();
    updateGibs();
    updateRagdoll();
    updateAtmosphere();
    updateWeather();

    // Complete sky transition when duration elapses
    if (state.skyTransition.active) {
        const elapsed = Date.now() - state.skyTransition.startTime;
        if (elapsed >= state.skyTransition.duration) {
            state.skyTransition.active = false;
        }
    }

    // Transition from bullet_time to finished after ragdoll settles
    if (state.phase === 'bullet_time' && !state.bullet && ragdoll.active) {
      // Check if ragdoll has mostly settled (low velocity)
      const head = ragdoll.bodies.head;
      if (head) {
        const headVel = Math.abs(head.velocity.x) + Math.abs(head.velocity.y);
        if (headVel < 0.5 || Date.now() - state.roundEndTime > 3000) {
          state.phase = 'finished';
          state.showingResult = true;
        }
      }
    }
}

// Input Handling
function handleTyping(e) {
    if (state.phase === 'playing') {
        if (e.key === 'Backspace') {
            state.playerTyped = state.playerTyped.slice(0, -1);
            state.playerProgress = state.playerTyped.length / state.currentWord.length;
            setPlayerArmTarget(state.playerProgress);
            return;
        }
        if (e.key.length === 1) {
            const nextChar = state.currentWord[state.playerTyped.length];
            if (e.key.toLowerCase() === nextChar) {
                state.playerTyped += nextChar;
                state.playerProgress = state.playerTyped.length / state.currentWord.length;
                setPlayerArmTarget(state.playerProgress);
                if (state.playerTyped === state.currentWord) {
                    state.playerFinishTime = Date.now();
                    setPlayerArmTarget(1);
                    checkWinner();
                }
            } else {
                state.playerErrors++;
                state.errorShakeUntil = Date.now() + 200;
            }
        }
    }
}

window.addEventListener('keydown', e => {
    handleTyping(e);

    if (state.phase === 'idle' || (state.phase === 'finished' && Date.now() - state.roundEndTime > 2000)) {
        if (e.key === ' ') {
            e.preventDefault();
            startCountdown();
        }
    }
});

canvas.addEventListener('mousemove', e => {
    if (state.phase === 'targeting') {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);

        state.hoverTarget = null;
        for (const t of state.targets) {
            const dx = x - t.x;
            const dy = y - t.y;
            if (dx*dx + dy*dy < t.r * t.r) {
                state.hoverTarget = t.id;
            }
        }
    }
});

canvas.addEventListener('click', e => {
    if (state.phase === 'targeting' && state.hoverTarget) {
        triggerPlayerShot(state.hoverTarget);
    }
});

function startCountdown() {
    state.phase = 'countdown';
    state.countdownValue = 3;
    state.timeScale = 1.0;
    state.blood = [];
    state.gibs = [];
    state.targets = [];
    state.hoverTarget = null;
    state.selectedTarget = null;
    state.showingResult = false;
    // Keep stains (persistent)
    state.playerTyped = '';
    state.aiTyped = '';
    state.winner = null;
    state.playerFinishTime = null;
    state.aiFinishTime = null;
    state.playerProgress = 0;
    state.aiProgress = 0;
    resetRagdoll();
    setPlayerArmTarget(0);
    setAiArmTarget(0);

    // Advance sky palette with transition
    state.skyTransition.active = true;
    state.skyTransition.fromIndex = state.currentBg;
    state.currentBg = (state.currentBg + 1) % skyPalettes.length;
    state.skyTransition.toIndex = state.currentBg;
    state.skyTransition.startTime = Date.now();

    // Initialize random weather for this round
    initWeather();

    const iv = setInterval(() => {
        state.countdownValue--;
        if (state.countdownValue === 0) {
            clearInterval(iv);
            startRound();
        }
    }, 1000);
}

// Boot
console.log('Quick Draw v' + VERSION + ' loaded!');
initAtmosphere();
gameLoop();
