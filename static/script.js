document.addEventListener("DOMContentLoaded", init);

const authView     = document.getElementById("auth-view");
const chatView     = document.getElementById("chat-view");
const chatNav      = document.getElementById("chat-nav");
const newChatBtn   = document.getElementById("new-chat-btn");
const clearBtn     = document.getElementById("clear-btn");
const logoutBtn    = document.getElementById("logout-btn");

const authBox      = document.getElementById("auth-box");
const authTitle    = document.getElementById("auth-title");
const authForm     = document.getElementById("auth-form");
const toggleLink   = document.getElementById("toggle-link");

const sessionsList = document.getElementById("sessions-list");
const chatWindow   = document.getElementById("chat-window");
const userInput    = document.getElementById("user-input");
const sendBtn      = document.getElementById("send-btn");

let isLogin = true;
let currentSession = null;

async function init() {
  authForm.addEventListener("submit", onAuthSubmit);
  toggleLink.addEventListener("click", toggleAuthMode);
  newChatBtn.addEventListener("click", startNewChat);
  clearBtn.addEventListener("click", clearCurrentChat);
  logoutBtn.addEventListener("click", doLogout);
  sendBtn.addEventListener("click", sendMessage);

  await checkAuth();
}

async function checkAuth() {
  const resp = await fetch("/me", { credentials: "include" });
  if (resp.status === 200) {
    showChat();
    await loadSessions();
  } else {
    showAuth();
  }
}

function showAuth() {
  authView.style.display = "flex";
  chatView.style.display = "none";
  chatNav.style.display = "none";
}

function showChat() {
  authView.style.display = "none";
  chatView.style.display = "flex";
  chatNav.style.display = "flex";
}

function toggleAuthMode(e) {
  e.preventDefault();
  isLogin = !isLogin;
  authTitle.textContent = isLogin ? "Log In" : "Sign Up";
  authForm.querySelector("button").textContent = isLogin ? "Log In" : "Sign Up";
  toggleLink.textContent = isLogin ? "Sign Up" : "Log In";
}

async function onAuthSubmit(e) {
  e.preventDefault();
  const url   = isLogin ? "/login" : "/signup";
  const body  = {
    username: authForm.username.value,
    password: authForm.password.value
  };
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body)
  });
  if (resp.ok) {
    await checkAuth();
  } else {
    alert((await resp.json()).detail || "Error");
  }
}

async function doLogout() {
  await fetch("/logout", { method:"POST", credentials:"include" });
  currentSession = null;
  chatWindow.innerHTML = "";
  showAuth();
}

async function loadSessions() {
  const rows = await fetch("/sessions", { credentials:"include" }).then(r=>r.json());
  sessionsList.innerHTML = "";
  rows.forEach(s => {
    const btn = document.createElement("button");
    btn.textContent = s.title;
    btn.onclick = () => loadChat(s.id);
    sessionsList.appendChild(btn);
  });
  // auto-start first
  if (rows[0]) loadChat(rows[0].id);
}

async function startNewChat() {
  const { id } = await fetch("/sessions", {
    method:"POST",
    credentials:"include",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({})
  }).then(r=>r.json());
  currentSession = id;
  chatWindow.innerHTML = "<p>New chat started.</p>";
  await loadSessions();
}

async function loadChat(sessionId) {
  currentSession = sessionId;
  const msgs = await fetch(`/messages?session_id=${sessionId}`, { credentials:"include" })
                  .then(r=>r.json());
  chatWindow.innerHTML = "";
  msgs.forEach(m => {
    const p = document.createElement("p");
    p.textContent = (m.role === "user" ? "You: " : "AI: ") + m.content;
    chatWindow.appendChild(p);
  });
}

async function clearCurrentChat() {
  if (!currentSession) return;
  await fetch(`/sessions/${currentSession}/messages`, {
    method:"DELETE",
    credentials:"include"
  });
  chatWindow.innerHTML = "";
}

async function sendMessage() {
  if (!currentSession) return;
  const prompt = userInput.value.trim();
  if (!prompt) return;
  const res = await fetch("/chat", {
    method:"POST",
    credentials:"include",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ session_id: currentSession, prompt })
  });
  if (!res.ok) {
    chatWindow.insertAdjacentHTML("beforeend", "<p><em>Error sending message</em></p>");
    return;
  }
  const { messages } = await res.json();
  // re-render entire history
  chatWindow.innerHTML = "";
  messages.forEach(m => {
    const p = document.createElement("p");
    p.textContent = (m.role==="user"?"You: ":"AI: ") + m.content;
    chatWindow.appendChild(p);
  });
  userInput.value = "";
  chatWindow.scrollTop = chatWindow.scrollHeight;
}
