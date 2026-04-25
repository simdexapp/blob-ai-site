const canvas = document.querySelector("#siteInk");
const ctx = canvas.getContext("2d");

const field = {
  width: 0,
  height: 0,
  dpr: 1,
  start: performance.now(),
  pointerX: 0.52,
  pointerY: 0.48,
  ripples: [],
};

function resize() {
  field.dpr = Math.min(window.devicePixelRatio || 1, 2);
  field.width = window.innerWidth;
  field.height = window.innerHeight;
  canvas.width = Math.floor(field.width * field.dpr);
  canvas.height = Math.floor(field.height * field.dpr);
  canvas.style.width = `${field.width}px`;
  canvas.style.height = `${field.height}px`;
  ctx.setTransform(field.dpr, 0, 0, field.dpr, 0, 0);
}

function addRipple(x, y, strength = 1) {
  field.ripples.push({
    x,
    y,
    born: performance.now(),
    strength,
  });
  if (field.ripples.length > 18) {
    field.ripples.shift();
  }
}

function draw(now) {
  const elapsed = now - field.start;
  ctx.clearRect(0, 0, field.width, field.height);
  ctx.globalCompositeOperation = "source-over";

  const base = ctx.createRadialGradient(
    field.width * 0.55,
    field.height * 0.45,
    0,
    field.width * 0.55,
    field.height * 0.45,
    Math.max(field.width, field.height) * 0.82
  );
  base.addColorStop(0, "rgba(40,40,40,0.98)");
  base.addColorStop(0.5, "rgba(25,25,25,0.98)");
  base.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, field.width, field.height);

  ctx.globalCompositeOperation = "screen";
  drawInkClouds(elapsed);
  drawRibbons(elapsed);
  drawRipples(now);
  drawPointerRipple(elapsed);

  requestAnimationFrame(draw);
}

function drawInkClouds(elapsed) {
  for (let i = 0; i < 13; i += 1) {
    const phase = i * 1.17;
    const speed = 0.00007 + i * 0.000008;
    const x =
      field.width * (0.14 + ((i * 0.137) % 0.76)) +
      Math.sin(elapsed * speed + phase) * (90 + i * 4) +
      (field.pointerX - 0.5) * 80;
    const y =
      field.height * (0.12 + ((i * 0.251) % 0.76)) +
      Math.cos(elapsed * speed * 1.3 + phase) * (75 + i * 5) +
      (field.pointerY - 0.5) * 75;
    const radius = 150 + (i % 5) * 58;
    const alpha = 0.018 + (i % 4) * 0.006;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(0.2, `rgba(190,190,185,${alpha * 0.7})`);
    gradient.addColorStop(0.5, "rgba(0,0,0,0.05)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRibbons(elapsed) {
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 8; i += 1) {
    const centerY = field.height * (0.2 + i * 0.095) + Math.sin(elapsed * 0.00011 + i) * 52;
    const height = 92 + i * 9;
    const gradient = ctx.createLinearGradient(0, 0, field.width, 0);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.2, `rgba(255,255,255,${0.018 + i * 0.002})`);
    gradient.addColorStop(0.48, "rgba(0,0,0,0.12)");
    gradient.addColorStop(0.78, `rgba(215,215,210,${0.018 + i * 0.002})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.beginPath();
    ctx.moveTo(-120, centerY);
    for (let j = 0; j <= 7; j += 1) {
      const x = (field.width / 7) * j;
      const y =
        centerY +
        Math.sin(elapsed * 0.00016 + i * 0.8 + j * 0.95) * height +
        (field.pointerY - 0.5) * 24;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(field.width + 120, centerY + height * 1.1);
    ctx.lineTo(-120, centerY + height * 1.45);
    ctx.closePath();
    ctx.filter = "blur(26px)";
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.filter = "none";
  }
  ctx.globalCompositeOperation = "screen";
}

function drawRipples(now) {
  field.ripples = field.ripples.filter((ripple) => now - ripple.born < 2400);
  for (const ripple of field.ripples) {
    const age = now - ripple.born;
    const progress = age / 2400;
    const radius = 18 + progress * Math.max(field.width, field.height) * 0.34 * ripple.strength;
    const alpha = (1 - progress) * 0.12 * ripple.strength;
    ctx.lineWidth = 1.2 + progress * 3;
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    const glow = ctx.createRadialGradient(ripple.x, ripple.y, radius * 0.25, ripple.x, ripple.y, radius);
    glow.addColorStop(0, "rgba(255,255,255,0)");
    glow.addColorStop(0.7, `rgba(255,255,255,${alpha * 0.25})`);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPointerRipple(elapsed) {
  const x = field.width * field.pointerX;
  const y = field.height * field.pointerY;
  const radius = 130 + Math.sin(elapsed * 0.0012) * 18;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, "rgba(255,255,255,0.08)");
  gradient.addColorStop(0.22, "rgba(255,255,255,0.035)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, field.width, field.height);
}

window.addEventListener("resize", resize);
window.addEventListener("pointermove", (event) => {
  field.pointerX = event.clientX / Math.max(1, window.innerWidth);
  field.pointerY = event.clientY / Math.max(1, window.innerHeight);
});
window.addEventListener("pointerdown", (event) => addRipple(event.clientX, event.clientY, 1.2));

resize();
addRipple(window.innerWidth * 0.55, window.innerHeight * 0.48, 1);
setInterval(() => {
  const x = window.innerWidth * (0.25 + Math.random() * 0.5);
  const y = window.innerHeight * (0.22 + Math.random() * 0.45);
  addRipple(x, y, 0.45 + Math.random() * 0.45);
}, 1800);
requestAnimationFrame(draw);
