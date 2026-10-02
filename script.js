// ---- Translations ----
const TRANSLATIONS = {
  en: {
    pageTitle: "Brizall catalogue",
    formTitle: "Get instant access",
    formSub: "Tell us where to reach you",
    nameLabel: "Name",
    namePlaceholder: "Jane Doe",
    emailLabel: "Email",
    emailPlaceholder: "jane@example.com",
    phoneLabel: "Phone number",
    phonePlaceholder: "Phone number",
    continue: "Continue",
    submitting: "Submitting…",
    downloadTitle: "Your download is ready",
    thankYou: "Thank you for reaching out! The file is ready when you are.",
    downloadEn: "Download Catalogue (English)",
    downloadEs: "Download Catalogue (Spanish)",
    footNote: "By submitting, you agree to be contacted about this catalogue.",
    errName: "Enter your name.",
    errEmail: "Enter a valid email address.",
    errPhone: "Enter a valid phone number.",
    errSave: "Something went wrong saving your details. Please try again.",
  },
  es: {
    pageTitle: "Catálogo Brizall",
    formTitle: "Obtén acceso inmediato",
    formSub: "Dinos cómo contactarte",
    nameLabel: "Nombre",
    namePlaceholder: "María Pérez",
    emailLabel: "Correo electrónico",
    emailPlaceholder: "maria@ejemplo.com",
    phoneLabel: "Número de teléfono",
    phonePlaceholder: "Número de teléfono",
    continue: "Continuar",
    submitting: "Enviando…",
    downloadTitle: "Tu descarga está lista",
    thankYou: "¡Gracias por contactarnos! El archivo está listo cuando tú lo estés.",
    downloadEn: "Descargar catálogo (inglés)",
    downloadEs: "Descargar catálogo (español)",
    footNote: "Al enviar, aceptas que te contactemos acerca de este catálogo.",
    errName: "Ingresa tu nombre.",
    errEmail: "Ingresa un correo electrónico válido.",
    errPhone: "Ingresa un número de teléfono válido.",
    errSave: "Algo salió mal al guardar tus datos. Inténtalo de nuevo.",
  },
};

const LANG_STORAGE_KEY = "brizall_lang";
let currentLang = "en";

function t(key) {
  return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) || TRANSLATIONS.en[key] || key;
}

function detectInitialLang() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && TRANSLATIONS[saved]) return saved;
  } catch (e) {
    /* localStorage unavailable — ignore */
  }
  const browser = (navigator.language || "en").toLowerCase();
  return browser.startsWith("es") ? "es" : "en";
}

// Re-render any message that was set via a key (errors, form note)
function renderKeyedMessages() {
  document.querySelectorAll("[data-msg-key]").forEach((el) => {
    el.textContent = t(el.dataset.msgKey);
  });
}

function setMessage(el, key) {
  if (key) {
    el.dataset.msgKey = key;
    el.textContent = t(key);
  } else {
    delete el.dataset.msgKey;
    el.textContent = "";
  }
}

function applyLanguage(lang) {
  if (!TRANSLATIONS[lang]) lang = "en";
  currentLang = lang;
  document.documentElement.lang = lang;
  document.title = t("pageTitle");

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    // Don't overwrite the submit label while it's showing "Submitting…"
    if (el.classList.contains("btnLabel") && submitBtn && submitBtn.disabled) {
      el.textContent = t("submitting");
      return;
    }
    el.textContent = t(el.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  document.querySelectorAll(".langBtn").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
  });

  renderKeyedMessages();

  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch (e) {
    /* ignore */
  }
}

// ---- Phone input (country code selector) ----
// Wrapped in try/catch so a failed CDN load can't break the whole form.
let iti = null;
const phoneInput = document.querySelector("#phone");

try {
  iti = window.intlTelInput(phoneInput, {
    initialCountry: "auto",
    geoIpLookup: function (callback) {
      fetch("https://ipapi.co/json")
        .then((res) => res.json())
        .then((data) => callback(data.country_code))
        .catch(() => callback("us"));
    },
    utilsScript:
      "https://cdn.jsdelivr.net/npm/intl-tel-input@18.1.1/build/js/utils.js",
  });
} catch (err) {
  console.error("intl-tel-input failed to load, falling back to plain validation:", err);
}

// ---- Elements ----
const form = document.getElementById("leadForm");
const submitBtn = document.getElementById("submitBtn");
const formNote = document.getElementById("formNote");
const formStep = document.getElementById("formStep");
const downloadStep = document.getElementById("downloadStep");

const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");

const nameError = document.getElementById("nameError");
const emailError = document.getElementById("emailError");
const phoneError = document.getElementById("phoneError");

// ---- Language toggle wiring ----
document.querySelectorAll(".langBtn").forEach((btn) => {
  btn.addEventListener("click", () => applyLanguage(btn.dataset.lang));
});
applyLanguage(detectInitialLang());

// ---- Validation ----
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

// Fallback phone check used only if intl-tel-input didn't load
function isValidPhoneFallback(value) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7;
}

function clearErrors() {
  [nameError, emailError, phoneError, formNote].forEach((el) => setMessage(el, null));
  [nameInput, emailInput, phoneInput].forEach((el) =>
    el.classList.remove("invalid")
  );
}

function validate() {
  clearErrors();
  let valid = true;

  if (!nameInput.value.trim()) {
    setMessage(nameError, "errName");
    nameInput.classList.add("invalid");
    valid = false;
  }

  if (!isValidEmail(emailInput.value.trim())) {
    setMessage(emailError, "errEmail");
    emailInput.classList.add("invalid");
    valid = false;
  }

  const phoneOk = iti ? iti.isValidNumber() : isValidPhoneFallback(phoneInput.value);
  if (!phoneOk) {
    setMessage(phoneError, "errPhone");
    phoneInput.classList.add("invalid");
    valid = false;
  }

  return valid;
}

// ---- Submit to Supabase ----
async function saveLead({ name, email, phone }) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify([{ name, email, phone }]),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase insert failed (${res.status}): ${text}`);
  }
}

// This listener now attaches no matter what happened above.
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validate()) return;

  const btnLabel = submitBtn.querySelector(".btnLabel");
  submitBtn.disabled = true;
  btnLabel.textContent = t("submitting");

  const payload = {
    name: nameInput.value.trim(),
    email: emailInput.value.trim(),
    phone: iti ? iti.getNumber() : phoneInput.value.trim(),
  };

  try {
    await saveLead(payload);
    formStep.classList.add("hidden");
    downloadStep.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    setMessage(formNote, "errSave");
    submitBtn.disabled = false;
    btnLabel.textContent = t("continue");
  }
});
