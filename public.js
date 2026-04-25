const canvas = document.querySelector("#siteInk");
const ctx = canvas.getContext("2d");
const ink = {
  width: 0,
  height: 0,
  dpr: 1,
  start: performance.now(),
  pointerX: 0.5,
  pointerY: 0.5,
};

function resize() {
  ink.dpr = Math.min(window.devicePixelRatio || 1, 2);
  ink.width = window.innerWidth;
  ink.height = window.innerHeight;
  canvas.width = Math.floor(ink.width * ink.dpr);
  canvas.height = Math.floor(ink.height * ink.dpr);
  canvas.style.width = `${ink.width}px`;
  canvas.style.height = `${ink.height}px`;
  ctx.setTransform(ink.dpr, 0, 0, ink.dpr, 0, 0);
}

function draw(now) {
  const elapsed = now - ink.start;
  ctx.clearRect(0, 0, ink.width, ink.height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, ink.width, ink.height);

  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 9; i += 1) {
    const phase = i * 0.82;
    const x =
      ink.width * (0.1 + ((i * 0.17) % 0.8)) +
      Math.sin(elapsed * (0.00008 + i * 0.00001) + phase) * 90 +
      (ink.pointerX - 0.5) * 70;
    const y =
      ink.height * (0.12 + ((i * 0.29) % 0.76)) +
      Math.cos(elapsed * (0.00009 + i * 0.000012) + phase) * 100 +
      (ink.pointerY - 0.5) * 70;
    const radius = 180 + (i % 4) * 78;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${0.035 + i * 0.003})`);
    gradient.addColorStop(0.24, "rgba(185,186,179,0.035)");
    gradient.addColorStop(0.52, "rgba(0,0,0,0.11)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 7; i += 1) {
    const y = ink.height * (0.18 + i * 0.11) + Math.sin(elapsed * 0.00016 + i) * 85;
    ctx.beginPath();
    ctx.moveTo(-100, y);
    for (let j = 0; j <= 6; j += 1) {
      const x = (ink.width / 6) * j;
      ctx.lineTo(x, y + Math.sin(elapsed * 0.00022 + i + j * 0.8) * (55 + i * 8));
    }
    ctx.lineTo(ink.width + 100, y + 130);
    ctx.lineTo(-100, y + 170);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, ink.width, 0);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.28, "rgba(255,255,255,0.035)");
    gradient.addColorStop(0.5, "rgba(0,0,0,0.08)");
    gradient.addColorStop(0.8, "rgba(255,255,255,0.03)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.filter = "blur(30px)";
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.filter = "none";
  }

  requestAnimationFrame(draw);
}

window.addEventListener("resize", resize);
window.addEventListener("pointermove", (event) => {
  ink.pointerX = event.clientX / Math.max(1, window.innerWidth);
  ink.pointerY = event.clientY / Math.max(1, window.innerHeight);
});

resize();
requestAnimationFrame(draw);
