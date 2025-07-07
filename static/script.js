// static/script.js
document.addEventListener("DOMContentLoaded", init);

let currentSession = null;

async function init() {
  // Auth buttons
  document.getElementById("login-btn").onclick  = handleLogin;
  document.getElementById("signup-btn").onclick = handleSignup;
  document.getElementById("logout-btn").onclick = handleLogout;

  // Chat buttons
  document.getElementById("new-chat").onclick  = createNewSession;
  document.getElementById("clear-btn").onclick = () => clearChat(currentSession);
  document.getElementById("send-btn").onclick  = sendPrompt;

  // Prompt placeholder + Enter handling
  const input = document.getElementById("prompt");
  input.placeholder = "Speak your truth into the void...";
  input.addEventListener("focus", () => {
    if (input.placeholder === "Speak your truth into the void…") input.placeholder = "";
  });
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  });

  // Check auth
  try {
    await fetch("/me", { credentials: "include" });
    showChatUI();
    await loadSessions();
  } catch {
    showAuthUI();
  }
}

function showAuthUI() {
  document.getElementById("auth-container").style.display = "block";
  document.getElementById("chat-container").style.display = "none";
  document.getElementById("top-bar").style.display       = "none";
}

function showChatUI() {
  document.getElementById("auth-container").style.display = "none";
  document.getElementById("chat-container").style.display = "block";
  document.getElementById("top-bar").style.display         = "flex";
}

// === AUTH handlers ===
async function handleLogin() {
  const u = document.getElementById("login-user").value;
  const p = document.getElementById("login-pass").value;
  const res = await fetch("/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: p })
  });
  if (res.ok) {
    showChatUI();
    await loadSessions();
  } else {
    alert("Login failed");
  }
}

async function handleSignup() {
  const u = document.getElementById("signup-user").value;
  const p = document.getElementById("signup-pass").value;
  const res = await fetch("/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: p })
  });
  if (res.ok) {
    alert("Account created! Please log in.");
  } else {
    alert("Signup failed");
  }
}

async function handleLogout() {
  await fetch("/logout", { method: "POST", credentials: "include" });
  showAuthUI();
}

// === SESSIONS & CHAT (unchanged) ===
async function loadSessions() { /* … your code to fetch and populate sessions dropdown … */ }
async function createNewSession() { /* … your code to POST /sessions, clear UI, show system msg … */ }
async function clearChat(sid)        { /* … your code to DELETE /sessions/{sid}/messages and clear chat box … */ }
async function sendPrompt()          { /* … your code to POST /reflect, append messages, etc. … */ }
function showSystemMessage(text)     { /* … same helper to append a system-line div … */ }
