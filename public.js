(() => {
  "use strict";

  // ---------- Age gate ----------
  const AGE_KEY = "versaai.age.confirmed";
  const ageGate = document.getElementById("ageGate");

  function showAgeGate() {
    if (!ageGate) return;
    ageGate.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function hideAgeGate() {
    if (!ageGate) return;
    ageGate.hidden = true;
    document.body.style.overflow = "";
    try { localStorage.setItem(AGE_KEY, "1"); } catch (_) {}
  }
  try {
    if (!localStorage.getItem(AGE_KEY)) showAgeGate();
  } catch (_) {
    showAgeGate();
  }
  document.querySelectorAll("[data-age-confirm]").forEach((btn) => {
    btn.addEventListener("click", hideAgeGate);
  });

  // ---------- Background canvas (drifting particles) ----------
  const bg = document.getElementById("bgCanvas");
  if (bg) {
    const ctx = bg.getContext("2d");
    const stars = [];
    let w = 0, h = 0, dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = bg.clientWidth = window.innerWidth;
      h = bg.clientHeight = window.innerHeight;
      bg.width = Math.floor(w * dpr);
      bg.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }
    function seed() {
      stars.length = 0;
      const count = Math.min(120, Math.floor((w * h) / 14000));
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.4 + 0.3,
          dx: (Math.random() - 0.5) * 0.12,
          dy: (Math.random() - 0.5) * 0.12,
          hue: Math.random() < 0.5 ? 320 : 280,
          a: Math.random() * 0.5 + 0.2,
        });
      }
    }
    function tick() {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.x += s.dx; s.y += s.dy;
        if (s.x < -10) s.x = w + 10;
        if (s.x > w + 10) s.x = -10;
        if (s.y < -10) s.y = h + 10;
        if (s.y > h + 10) s.y = -10;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue}, 100%, 70%, ${s.a})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    resize();
    window.addEventListener("resize", resize);
    tick();
  }

  // ---------- Orb canvas (animated mascot) ----------
  const orb = document.getElementById("orbCanvas");
  if (orb) {
    const octx = orb.getContext("2d");
    let ow = 0, oh = 0, odpr = 1;
    const start = performance.now();

    function oresize() {
      odpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = orb.getBoundingClientRect();
      ow = rect.width; oh = rect.height;
      orb.width = Math.floor(ow * odpr);
      orb.height = Math.floor(oh * odpr);
      octx.setTransform(odpr, 0, 0, odpr, 0, 0);
    }
    function odraw() {
      const t = (performance.now() - start) / 1000;
      octx.clearRect(0, 0, ow, oh);
      const cx = ow / 2, cy = oh / 2;
      const baseR = Math.min(ow, oh) * 0.42;

      // Wobbly blob outline
      octx.beginPath();
      const points = 64;
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const wob =
          Math.sin(a * 3 + t * 1.3) * 6 +
          Math.sin(a * 5 - t * 0.9) * 4 +
          Math.sin(a * 2 + t * 0.5) * 8;
        const r = baseR + wob;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) octx.moveTo(x, y);
        else octx.lineTo(x, y);
      }
      octx.closePath();

      const grad = octx.createRadialGradient(
        cx - baseR * 0.3, cy - baseR * 0.3, baseR * 0.1,
        cx, cy, baseR * 1.1
      );
      grad.addColorStop(0, "rgba(255, 200, 230, 0.95)");
      grad.addColorStop(0.35, "rgba(255, 45, 146, 0.85)");
      grad.addColorStop(0.7, "rgba(177, 76, 255, 0.7)");
      grad.addColorStop(1, "rgba(0, 229, 255, 0.35)");
      octx.fillStyle = grad;
      octx.fill();

      // Inner glitch lines
      octx.save();
      octx.globalCompositeOperation = "overlay";
      octx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      octx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const yy = cy + Math.sin(t * 2 + i) * baseR * 0.5;
        octx.beginPath();
        octx.moveTo(cx - baseR, yy);
        octx.lineTo(cx + baseR, yy + Math.sin(t + i) * 4);
        octx.stroke();
      }
      octx.restore();

      // Eye-like dual pupils that drift
      const eyeOff = baseR * 0.28;
      const eyeY = cy - baseR * 0.05;
      const drift = Math.sin(t * 0.7) * baseR * 0.06;
      octx.fillStyle = "rgba(10, 4, 20, 0.85)";
      octx.beginPath();
      octx.arc(cx - eyeOff + drift, eyeY, baseR * 0.07, 0, Math.PI * 2);
      octx.arc(cx + eyeOff + drift, eyeY, baseR * 0.07, 0, Math.PI * 2);
      octx.fill();

      // Smirk
      octx.strokeStyle = "rgba(10, 4, 20, 0.85)";
      octx.lineWidth = 3;
      octx.lineCap = "round";
      octx.beginPath();
      const smirkY = cy + baseR * 0.22;
      octx.moveTo(cx - baseR * 0.18, smirkY);
      octx.quadraticCurveTo(cx, smirkY + baseR * 0.16 + Math.sin(t * 2) * 2, cx + baseR * 0.22, smirkY - baseR * 0.04);
      octx.stroke();

      requestAnimationFrame(odraw);
    }
    oresize();
    window.addEventListener("resize", oresize);
    odraw();
  }

  // ---------- Demo chat (typed) ----------
  const chatBody = document.getElementById("chatBody");
  const chatInputText = document.getElementById("chatInputText");

  const script = [
    { who: "user",  text: "rate my code on a scale of 1 to 10" },
    { who: "versa", text: "i'd love to but the scale only goes up to 10" },
    { who: "user",  text: "be nice" },
    { who: "versa", text: "fine. it's a beautifully indented disaster. you're growing." },
    { who: "user",  text: "should i text my ex" },
    { who: "versa", text: "absolutely. then text me your address so i can come slap the phone out of your hand." },
  ];

  let stepIdx = 0;
  let typingTimeout = null;

  function clearChat() {
    if (chatBody) chatBody.innerHTML = "";
    if (chatInputText) chatInputText.textContent = "";
  }

  function typeInto(el, text, speed = 28) {
    return new Promise((resolve) => {
      let i = 0;
      el.textContent = "";
      function step() {
        el.textContent += text[i++];
        if (i < text.length) {
          typingTimeout = setTimeout(step, speed + Math.random() * 30);
        } else {
          resolve();
        }
      }
      step();
    });
  }

  async function runStep() {
    if (!chatBody || !chatInputText) return;
    if (stepIdx >= script.length) {
      await wait(2200);
      clearChat();
      stepIdx = 0;
    }
    const item = script[stepIdx++];
    if (item.who === "user") {
      await typeInto(chatInputText, item.text, 32);
      await wait(400);
      addMsg(item.who, item.text);
      chatInputText.textContent = "";
    } else {
      const typingEl = addMsg("versa", "Versa is typing", { typing: true });
      await wait(900 + Math.random() * 600);
      typingEl.classList.remove("typing");
      typingEl.textContent = "";
      await typeInto(typingEl, item.text, 22);
    }
    await wait(800);
    runStep();
  }

  function addMsg(who, text, opts = {}) {
    const el = document.createElement("div");
    el.className = "msg " + who + (opts.typing ? " typing" : "");
    el.textContent = text;
    chatBody.appendChild(el);
    chatBody.scrollTop = chatBody.scrollHeight;
    return el;
  }
  function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // Only start the demo when it scrolls into view, to keep things calm.
  if (chatBody && chatInputText && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          io.disconnect();
          runStep();
          break;
        }
      }
    }, { threshold: 0.3 });
    io.observe(chatBody);
  } else if (chatBody) {
    runStep();
  }

  // ---------- Waitlist form (no backend yet) ----------
  const form = document.getElementById("waitlistForm");
  const note = document.getElementById("waitlistNote");
  if (form && note) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = (form.elements.namedItem("email") || {}).value || "";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        note.textContent = "That email looks fake. Versa noticed.";
        note.style.color = "#ffcc33";
        return;
      }
      form.reset();
      note.textContent = "You're in. Check your inbox in a sec — and your spam, just in case.";
      note.style.color = "#44ff9a";
    });
  }
})();
