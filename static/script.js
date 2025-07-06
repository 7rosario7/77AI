const API = window.location.origin;
let currentSession = null;

// helpers
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  return res;
}

// AUTH
async function onLogin(e) {
  e.preventDefault();
  const username = ui.username.value;
  const password = ui.password.value;
  const res = await api("/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (res.ok) return setupUI();
  ui.authMsg.textContent = "Login failed.";
}

async function onSignup(e) {
  e.preventDefault();
  const username = ui.username.value;
  const password = ui.password.value;
  const res = await api("/signup", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (res.ok) return setupUI();
  ui.authMsg.textContent = "Signup failed.";
}

async function onLogout() {
  await api("/logout", { method: "POST" });
  window.location.reload();
}

// SESSIONS
async function loadSessions() {
  const res = await api("/sessions");
  if (!res.ok) return;
  const list = await res.json();
  ui.sessionList.innerHTML = "";
  list.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s.title;
    li.onclick = () => selectSession(s.id);
    if (s.id === currentSession) li.classList.add("active");
    ui.sessionList.append(li);
  });
}

async function createSession() {
  const title = ui.newSessionTitle.value.trim();
  if (!title) return;
  const res = await api("/sessions", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  if (res.ok) {
    ui.newSessionTitle.value = "";
    await loadSessions();
  }
}

async function selectSession(id) {
  currentSession = id;
  await loadSessions();
  ui.messages.innerHTML = "";
}

// MESSAGES
async function sendMessage() {
  const prompt = ui.prompt.value.trim();
  if (!prompt || !currentSession) return;
  ui.messages.innerHTML += `<div class="msg user">${prompt}</div>`;
  ui.prompt.value = "";
  const res = await api("/reflect", {
    method: "POST",
    body: JSON.stringify({ session_id: currentSession, prompt }),
  });
  if (res.ok) {
    const { messages } = await res.json();
    messages.forEach((m) => {
      ui.messages.innerHTML += `<div class="msg ${m.role}">${m.content}</div>`;
    });
  }
  ui.messages.scrollTop = ui.messages.scrollHeight;
}

// UI STATE
async function setupUI() {
  const me = await api("/me");
  if (me.status === 200) {
    // logged in
    ui.authSection.style.display = "none";
    ui.loginBtn.style.display = "none";
    ui.logoutBtn.style.display = "";
    ui.chatSection.style.display = "";
    await loadSessions();
  } else {
    // not logged in
    ui.authSection.style.display = "";
    ui.loginBtn.style.display = "";
    ui.logoutBtn.style.display = "none";
    ui.chatSection.style.display = "none";
  }
}

// wire up
const ui = {
  authSection: document.getElementById("auth-section"),
  chatSection: document.getElementById("chat-section"),
  username: document.getElementById("username"),
  password: document.getElementById("password"),
  authMsg: document.getElementById("auth-msg"),
  loginBtn: document.getElementById("login-btn"),
  logoutBtn: document.getElementById("logout-btn"),
  sessionList: document.getElementById("session-list"),
  newSessionTitle: document.getElementById("new-session-title"),
  createSession: document.getElementById("create-session"),
  messages: document.getElementById("messages"),
  prompt: document.getElementById("prompt"),
  sendBtn: document.getElementById("send-btn"),
};

ui.loginBtn.onclick = () => ui.authSection.style.display = "";
ui.logoutBtn.onclick = onLogout;
document.getElementById("auth-form").addEventListener("submit", (e) => e.preventDefault());
ui.createSession.onclick = createSession;
ui.sendBtn.onclick = sendMessage;
document.getElementById("do-login").onclick = onLogin;
document.getElementById("do-signup").onclick = onSignup;

// init
setupUI();
