// versaAI chat client. Talks to the Cloudflare Worker proxy at /api/chat,
// streams Anthropic SSE deltas back into a message bubble, persists per-persona
// transcripts in localStorage, optionally speaks responses via SpeechSynthesis.

const AGE_KEY = "versaai.age.confirmed";
const PERSONA_KEY = "versaai.persona";
const VOICE_KEY = "versaai.voice";
const transcriptKey = (id) => `versaai.chat.${id}`;
const MAX_TURNS = 40;

// Override at build time by editing this constant, or via ?api=... in dev.
// ?api=http://localhost:8787 in dev points both /api/chat and /api/tts at the
// local Worker; otherwise paths are same-origin.
const apiBase = (() => {
  const fromQuery = new URLSearchParams(location.search).get("api");
  if (!fromQuery) return "";
  // Accept either a base URL (http://localhost:8787) or a full /api/chat URL
  // for backwards compat with the previous override format.
  return fromQuery.replace(/\/api\/chat\/?$/, "").replace(/\/$/, "");
})();
const CHAT_ENDPOINT = `${apiBase}/api/chat`;
const TTS_ENDPOINT = `${apiBase}/api/tts`;

const PERSONAS = {
  versa: { name: "Versa", voice: { rate: 1.05, pitch: 1.0 } },
  nyx:   { name: "Nyx",   voice: { rate: 0.95, pitch: 1.15 } },
  ozzy:  { name: "Ozzy",  voice: { rate: 1.15, pitch: 0.85 } },
  saint: { name: "Saint", voice: { rate: 0.9,  pitch: 1.05 } },
};

// ---------- Age gate ----------

const ageGate = document.getElementById("ageGate");
let ageOk = false;
try {
  ageOk = localStorage.getItem(AGE_KEY) === "1";
} catch (_) {}

if (!ageOk && ageGate) {
  ageGate.hidden = false;
  document.body.style.overflow = "hidden";
  document.querySelectorAll("[data-age-confirm]").forEach((btn) => {
    btn.addEventListener("click", () => {
      try { localStorage.setItem(AGE_KEY, "1"); } catch (_) {}
      ageGate.hidden = true;
      document.body.style.overflow = "";
    });
  });
}

// ---------- Background canvas ----------

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
    stars.length = 0;
    const count = Math.min(80, Math.floor((w * h) / 18000));
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.2 + 0.3,
        dx: (Math.random() - 0.5) * 0.08,
        dy: (Math.random() - 0.5) * 0.08,
        hue: Math.random() < 0.5 ? 320 : 280,
        a: Math.random() * 0.45 + 0.15,
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

// ---------- DOM refs ----------

const chatBody = document.getElementById("chatBody");
const emptyState = document.getElementById("emptyState");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const personaPills = document.getElementById("personaPills");
const voiceToggle = document.getElementById("voiceToggle");
const newChatBtn = document.getElementById("newChatBtn");
const statusLabel = document.getElementById("statusLabel");
const chatTitle = document.getElementById("chatTitle");

// ---------- State ----------

let currentPersona = (() => {
  try { return localStorage.getItem(PERSONA_KEY) || "versa"; } catch (_) { return "versa"; }
})();
if (!PERSONAS[currentPersona]) currentPersona = "versa";

let voiceOn = (() => {
  try { return localStorage.getItem(VOICE_KEY) === "1"; } catch (_) { return false; }
})();
voiceToggle.checked = voiceOn;

let messages = loadTranscript(currentPersona);
let inFlight = false;

selectPersona(currentPersona, { skipReload: true });
renderTranscript();

// ---------- Persistence ----------

function loadTranscript(personaId) {
  try {
    const raw = localStorage.getItem(transcriptKey(personaId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) { return []; }
}
function saveTranscript() {
  try {
    const trimmed = messages.slice(-MAX_TURNS);
    localStorage.setItem(transcriptKey(currentPersona), JSON.stringify(trimmed));
  } catch (_) {}
}

// ---------- Persona switching ----------

personaPills.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-persona]");
  if (!btn) return;
  selectPersona(btn.dataset.persona);
});

function selectPersona(id, opts = {}) {
  if (!PERSONAS[id]) return;
  currentPersona = id;
  try { localStorage.setItem(PERSONA_KEY, id); } catch (_) {}

  for (const btn of personaPills.querySelectorAll("button[data-persona]")) {
    btn.setAttribute("aria-selected", String(btn.dataset.persona === id));
  }

  const persona = PERSONAS[id];
  statusLabel.textContent = `${persona.name} is online`;
  chatTitle.textContent = `${id} · live`;

  if (!opts.skipReload) {
    stopVoice();
    messages = loadTranscript(id);
    renderTranscript();
  }
}

newChatBtn.addEventListener("click", () => {
  if (inFlight) return;
  stopVoice();
  messages = [];
  saveTranscript();
  renderTranscript();
});

voiceToggle.addEventListener("change", () => {
  voiceOn = voiceToggle.checked;
  try { localStorage.setItem(VOICE_KEY, voiceOn ? "1" : "0"); } catch (_) {}
  if (!voiceOn) stopVoice();
});

// ---------- Render ----------

function renderTranscript() {
  chatBody.innerHTML = "";
  if (messages.length === 0) {
    chatBody.appendChild(emptyState);
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;
  for (const m of messages) {
    appendBubble(m.role, m.content);
  }
  scrollToBottom();
}

function appendBubble(role, text) {
  if (emptyState && !emptyState.hidden) {
    emptyState.hidden = true;
  }
  const el = document.createElement("div");
  el.className = "msg " + (role === "user" ? "user" : "versa");
  el.textContent = text;
  chatBody.appendChild(el);
  scrollToBottom();
  return el;
}

function appendError(text) {
  const el = document.createElement("div");
  el.className = "msg error";
  el.textContent = text;
  chatBody.appendChild(el);
  scrollToBottom();
}

function scrollToBottom() {
  chatBody.scrollTop = chatBody.scrollHeight;
}

// ---------- Composer ----------

chatInput.addEventListener("input", autosize);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

function autosize() {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + "px";
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (inFlight) return;
  const text = chatInput.value.trim();
  if (!text) return;

  inFlight = true;
  sendBtn.disabled = true;
  chatInput.value = "";
  autosize();
  stopVoice();

  messages.push({ role: "user", content: text });
  appendBubble("user", text);

  const assistantBubble = appendBubble("assistant", "");
  let assistantText = "";

  try {
    const resp = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona: currentPersona, messages }),
    });

    if (!resp.ok || !resp.body) {
      let detail = "";
      try { detail = (await resp.json()).error || ""; } catch (_) {}
      throw new Error(detail || `request failed (${resp.status})`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const delta = parseSSEBlock(block);
        if (delta) {
          assistantText += delta;
          assistantBubble.textContent = assistantText;
          scrollToBottom();
        }
      }
    }

    if (!assistantText) {
      assistantBubble.remove();
      messages.pop();
      appendError("No response. Try again.");
    } else {
      messages.push({ role: "assistant", content: assistantText });
      saveTranscript();
      if (voiceOn) speak(assistantText);
    }
  } catch (err) {
    assistantBubble.remove();
    messages.pop();
    appendError(err.message || "Something went wrong.");
  } finally {
    inFlight = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
});

// ---------- SSE parsing ----------

// Anthropic SSE events look like:
//   event: content_block_delta
//   data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
function parseSSEBlock(block) {
  let dataLine = null;
  for (const line of block.split("\n")) {
    if (line.startsWith("data:")) {
      dataLine = line.slice(5).trim();
      break;
    }
  }
  if (!dataLine || dataLine === "[DONE]") return null;
  let payload;
  try { payload = JSON.parse(dataLine); } catch (_) { return null; }
  if (payload.type === "content_block_delta" && payload.delta?.type === "text_delta") {
    return payload.delta.text || "";
  }
  return null;
}

// ---------- Voice ----------

let currentAudio = null;
let currentAudioUrl = null;
let ttsAvailable = true; // flips to false on first server-disabled response

function stopVoice() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
}

// Strip markdown so the TTS engine doesn't pronounce asterisks and code fences.
function cleanForSpeech(text) {
  return text
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

async function speak(text) {
  const clean = cleanForSpeech(text);
  if (!clean) return;
  stopVoice();

  if (ttsAvailable) {
    try {
      const resp = await fetch(TTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: currentPersona, text: clean }),
      });
      if (resp.status === 503) {
        ttsAvailable = false; // server has no ELEVENLABS_API_KEY; don't retry
        speakLocal(clean);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error(`tts ${resp.status}`);
      const blob = await resp.blob();
      currentAudioUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(currentAudioUrl);
      currentAudio.addEventListener("ended", () => {
        if (currentAudioUrl) {
          URL.revokeObjectURL(currentAudioUrl);
          currentAudioUrl = null;
        }
      });
      await currentAudio.play();
      return;
    } catch (_) {
      // network / playback failure → fall back for this one utterance
    }
  }
  speakLocal(clean);
}

function speakLocal(text) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  const v = PERSONAS[currentPersona]?.voice || {};
  u.rate = v.rate ?? 1.0;
  u.pitch = v.pitch ?? 1.0;
  speechSynthesis.speak(u);
}
