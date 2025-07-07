document.addEventListener("DOMContentLoaded", init);

function init() {
  // wire up controls
  document.getElementById("show-signup").onclick = showSignup;
  document.getElementById("show-login").onclick  = showLogin;
  document.getElementById("login-form").onsubmit    = handleLogin;
  document.getElementById("signup-form").onsubmit   = handleSignup;
  document.getElementById("new-chat-btn").onclick   = startNewChat;
  document.getElementById("clear-btn").onclick      = clearChat;
  document.getElementById("logout-btn").onclick     = logout;
  document.getElementById("send-btn").onclick       = sendMessage;

  fetchMe();
}

async function fetchMe() {
  let resp = await fetch("/me", { credentials: "include" });
  if (resp.status === 401) {
    showLogin();   // default to login
  } else {
    const { id } = await resp.json();
    onLoggedIn(id);
  }
}

function showLogin(e) {
  if (e) e.preventDefault();
  toggleSections("login");
}
function showSignup(e) {
  if (e) e.preventDefault();
  toggleSections("signup");
}

function toggleSections(mode) {
  document.getElementById("login-card").classList.toggle("hidden", mode!=="login");
  document.getElementById("signup-card").classList.toggle("hidden", mode!=="signup");
  document.getElementById("chat-section").classList.add("hidden");
}

async function handleLogin(e) {
  e.preventDefault();
  const u = document.getElementById("login-username").value,
        p = document.getElementById("login-password").value;
  let resp = await fetch("/login", {
    method: "POST",
    credentials: "include",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ username:u, password:p })
  });
  if (resp.ok) {
    const { id } = await resp.json();
    onLoggedIn(id);
  } else {
    alert("Login failed");
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const u = document.getElementById("signup-username").value,
        p = document.getElementById("signup-password").value;
  let resp = await fetch("/signup", {
    method: "POST",
    credentials: "include",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ username:u, password:p })
  });
  if (resp.ok) {
    onLoggedIn((await resp.json()).id);
  } else {
    alert("Signup failed");
  }
}

function onLoggedIn(userId) {
  // show chat UI
  document.getElementById("auth-section").classList.add("hidden");
  document.getElementById("top-bar").querySelectorAll("button").forEach(b=>b.classList.remove("hidden"));
  document.getElementById("chat-section").classList.remove("hidden");
  document.getElementById("new-chat-btn").classList.remove("hidden");
  document.getElementById("clear-btn").classList.remove("hidden");
  document.getElementById("logout-btn").classList.remove("hidden");
  startNewChat();
}

function startNewChat() {
  clearChat();
  appendSystemMessage("New chat started.");
}

function clearChat() {
  document.getElementById("chat-window").innerHTML = "";
}

async function logout() {
  await fetch("/logout", { method:"POST", credentials:"include" });
  window.location.reload();
}

function appendSystemMessage(text) {
  let d = document.createElement("div");
  d.className = "system-msg";
  d.textContent = text;
  document.getElementById("chat-window").appendChild(d);
}

async function sendMessage() {
  const input = document.getElementById("user-input");
  const txt = input.value.trim();
  if (!txt) return;
  appendSystemMessage(`You: ${txt}`);
  input.value = "";

  const resp = await fetch("/chat", {
    method: "POST",
    credentials: "include",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ message: txt })
  });
  if (resp.ok) {
    const { reply } = await resp.json();
    appendSystemMessage(`AI: ${reply}`);
  } else {
    appendSystemMessage("Error sending message");
  }
}
