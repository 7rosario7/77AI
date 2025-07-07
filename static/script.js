document.addEventListener("DOMContentLoaded", init);

function init() {
  fetchMe();
  loginForm.addEventListener("submit", onLogin);
  signupForm.addEventListener("submit", onSignup);
  logoutBtn.addEventListener("click", onLogout);
  newSessionBtn.addEventListener("click", toggleSessionList);
  clearBtn.addEventListener("click", clearMessages);
  chatInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// DOM refs
const loginDiv     = document.getElementById("login-div");
const chatDiv      = document.getElementById("chat-div");
const loginForm    = document.getElementById("login-form");
const signupForm   = document.getElementById("signup-form");
const userField    = document.getElementById("username");
const passField    = document.getElementById("password");
const newSessionBtn= document.getElementById("new-session-btn");
const sessionList  = document.getElementById("session-list");
const clearBtn     = document.getElementById("clear-btn");
const logoutBtn    = document.getElementById("logout-btn");
const chatContainer= document.getElementById("chat-container");
const chatInput    = document.getElementById("chat-input");
const sendBtn      = document.getElementById("send-btn");

let currentSession = null;

// --- AUTH FLOW ---
async function fetchMe() {
  const resp = await fetch("/me", { credentials: "include" });
  if (resp.status === 401) {
    showLogin();
  } else {
    await startChat();
  }
}

function showLogin() {
  loginDiv.style.display = "block";
  chatDiv.style.display  = "none";
}

function showChat() {
  loginDiv.style.display = "none";
  chatDiv.style.display  = "block";
  chatInput.placeholder = "Speak your truth into the void...";
}

// --- LOGIN/SIGNUP ---
async function onLogin(e) {
  e.preventDefault();
  const resp = await fetch("/login", {
    method: "POST",
    credentials: "include",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      username: userField.value,
      password: passField.value
    })
  });
  if (resp.ok) {
    startChat();
  } else {
    alert("Invalid login");
  }
}

async function onSignup(e) {
  e.preventDefault();
  const resp = await fetch("/signup", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      username: userField.value,
      password: passField.value
    })
  });
  if (resp.ok) {
    alert("Account created—please log in");
  } else {
    alert("Username taken");
  }
}

async function onLogout() {
  await fetch("/logout", { method: "POST", credentials: "include" });
  showLogin();
}

// --- CHAT & SESSIONS ---
async function startChat() {
  showChat();
  await loadSessions();
  if (currentSession) {
    await loadMessages(currentSession);
  }
}

async function loadSessions() {
  const resp = await fetch("/sessions", { credentials: "include" });
  const sessions = await resp.json();
  sessionList.innerHTML = "";
  sessions.forEach(s => {
    const li = document.createElement("li");
    li.textContent = s.title;
    li.dataset.id = s.id;
    // click to switch
    li.addEventListener("click", () => {
      currentSession = s.id;
      loadMessages(s.id);
      hideSessionList();
    });
    // delete button
    const del = document.createElement("span");
    del.textContent = "×";
    del.className = "del";
    del.addEventListener("click", async e => {
      e.stopPropagation();
      await fetch(`/sessions/${s.id}`, { method: "DELETE", credentials: "include" });
      await loadSessions();
      if (s.id === currentSession) {
        currentSession = null;
        chatContainer.innerHTML = "";
      }
    });
    li.appendChild(del);
    sessionList.appendChild(li);
  });
}

function toggleSessionList() {
  sessionList.classList.toggle("visible");
}

function hideSessionList() {
  sessionList.classList.remove("visible");
}

async function clearMessages() {
  if (!currentSession) return;
  await fetch(`/sessions/${currentSession}/messages`, {
    method: "DELETE",
    credentials: "include"
  });
  chatContainer.innerHTML = "";
}

async function sendMessage() {
  if (!currentSession) {
    const resp = await fetch("/sessions", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      credentials: "include",
      body: JSON.stringify({ title: "New Chat" })
    });
    const data = await resp.json();
    currentSession = data.id;
    await loadSessions();
  }
  const prompt = chatInput.value.trim();
  if (!prompt) return;
  appendLine("You:", prompt);
  chatInput.value = "";
  const resp = await fetch("/chat", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    credentials: "include",
    body: JSON.stringify({ session_id: currentSession, prompt })
  });
  if (!resp.ok) {
    appendLine("Error:", "Could not send message.");
    return;
  }
  const { messages } = await resp.json();
  const aiReply = messages.find(m => m.role === "assistant")?.content;
  appendLine("AI:", aiReply);
}

async function loadMessages(sessionId) {
  const resp = await fetch(`/messages?session_id=${sessionId}`, { credentials: "include" });
  const history = await resp.json();
  chatContainer.innerHTML = "";
  history.forEach(m => appendLine(m.role === "assistant" ? "AI:" : "You:", m.content));
}

function appendLine(who, text) {
  const p = document.createElement("p");
  p.innerHTML = `<strong>${who}</strong> ${text}`;
  chatContainer.appendChild(p);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}
