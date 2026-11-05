/* ==========================================================
   CONFIGURACIÓN
   ========================================================== */
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemma-4-31b-it:free";
const KEY_STORAGE = "openrouter_api_key";

const SYSTEM_PROMPT = `Eres un vendedor de ropa amable y persuasivo.
Recomiendas prendas, tallas, combinaciones y colores según la ocasión, el clima y el presupuesto del cliente.
Haces preguntas breves para entender mejor sus necesidades.
Respondes siempre en español, con mensajes cortos y claros.`;

/* ==========================================================
   ESTADO
   ========================================================== */
let history = [];       // Historial de la conversación
let isWaiting = false;  // true mientras se espera respuesta

/* ==========================================================
   REFERENCIAS AL DOM
   ========================================================== */
const $ = (id) => document.getElementById(id);
const keyPanel = $("keyPanel");
const keyInput = $("apiKeyInput");
const saveKeyBtn = $("saveKeyBtn");
const welcome = $("welcome");
const messagesEl = $("messages");
const typingEl = $("typing");
const composer = $("composer");
const userInput = $("userInput");
const sendBtn = $("sendBtn");
const newChatBtn = $("newChatBtn");

/* ==========================================================
   CLAVE API (sessionStorage)
   ========================================================== */
function getApiKey() {
  return sessionStorage.getItem(KEY_STORAGE);
}

function saveApiKey() {
  const key = keyInput.value.trim();
  if (!key) return;
  sessionStorage.setItem(KEY_STORAGE, key);
  keyInput.value = "";
  keyPanel.classList.add("hidden");
  showMessage("assistant", "Clave guardada. ¿En qué te puedo ayudar hoy? 👗");
}

function loadApiKeyState() {
  // Si ya hay clave guardada, ocultamos el panel automáticamente
  if (getApiKey()) {
    keyPanel.classList.add("hidden");
  }
}

/* ==========================================================
   UTILIDADES DE INTERFAZ
   ========================================================== */
function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Crea una burbuja. textContent evita la inyección de HTML.
function showMessage(role, text) {
  welcome.classList.add("hidden");
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function setWaiting(state) {
  isWaiting = state;
  sendBtn.disabled = state;
  typingEl.classList.toggle("hidden", !state);
  scrollToBottom();
}

// Ajusta la altura del textarea según su contenido
function autoResize() {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 128) + "px";
}

/* ==========================================================
   MENSAJES DE ERROR AMABLES
   ========================================================== */
function getErrorMessage(status) {
  if (status === 429) {
    return "Estamos recibiendo muchas consultas en este momento 😊 Por favor, intenta de nuevo en unos segundos.";
  }
  if (status === 401) {
    return "Tu clave de OpenRouter no es válida. Revísala e ingrésala de nuevo.";
  }
  return "Ocurrió un problema al procesar tu mensaje. Inténtalo de nuevo.";
}

/* ==========================================================
   LLAMADA A LA API (fetch)
   ========================================================== */
async function sendToModel() {
  const apiKey = getApiKey();

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history
      ]
    })
  });

  if (!response.ok) {
    const error = new Error("HTTP " + response.status);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "No recibí respuesta. Intenta de nuevo.";
}

/* ==========================================================
   FLUJO DE ENVÍO
   ========================================================== */
async function handleSend() {
  const text = userInput.value.trim();
  if (!text || isWaiting) return;

  // Validar clave antes de enviar
  if (!getApiKey()) {
    keyPanel.classList.remove("hidden");
    showMessage("error", "Primero necesitas guardar tu clave de OpenRouter 🔑");
    return;
  }

  // Mostrar mensaje del usuario y actualizar historial
  showMessage("user", text);
  history.push({ role: "user", content: text });
  userInput.value = "";
  autoResize();

  setWaiting(true);

  try {
    const reply = await sendToModel();
    history.push({ role: "assistant", content: reply });
    showMessage("assistant", reply);
  } catch (err) {
    // Si falla, quitamos el último mensaje del usuario del historial
    history.pop();
    const msg = err.status ? getErrorMessage(err.status) : "Sin conexión o error de red. Revisa tu internet.";
    showMessage("error", msg);
  } finally {
    setWaiting(false);
    userInput.focus();
  }
}

/* ==========================================================
   NUEVO CHAT
   ========================================================== */
function resetChat() {
  history = [];
  messagesEl.innerHTML = "";
  welcome.classList.remove("hidden");
  userInput.value = "";
  autoResize();
}

/* ==========================================================
   EVENTOS
   ========================================================== */
saveKeyBtn.addEventListener("click", saveApiKey);

keyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); saveApiKey(); }
});

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  handleSend();
});

// Enter envía; Shift+Enter hace salto de línea
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

userInput.addEventListener("input", autoResize);
newChatBtn.addEventListener("click", resetChat);

/* ==========================================================
   INICIO
   ========================================================== */
loadApiKeyState();
