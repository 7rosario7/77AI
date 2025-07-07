document.addEventListener("DOMContentLoaded", init);

let currentSession = null;

async function init() {
  // auth toggles
  document.getElementById("show-signup").onclick = e => { e.preventDefault(); toggleAuth("signup"); };
  document.getElementById("show-login").onclick  = e => { e.preventDefault(); toggleAuth("login"); };

  // forms
  document.getElementById("login-form").onsubmit = handleLogin;
  document.getElementById("signup-form").onsubmit = handleSignup;

  // nav
  document.getElementById("logout-btn").onclick = async () => {
    await fetch("/logout", { method: "POST", credentials: "include" });
    window.location.reload();
  };
  document.getElementById("clear-btn").onclick = () => clearChat();
  document.getElementById("new-chat-btn").onclick = () => createSession();

  // sessions dropdown
  document.getElementById("session-list").onchange = e => {
    currentSession = e.target.value;
    loadMessages();
  };

  // send
  const sendBtn = document.getElementById("send-btn");
  sendBtn.onclick = sendMessage;
  const userInput = document.getElementById("user-input");
  userInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  // initial auth check
  let me = await fetch("/me", { credentials: "include" });
  if (me.ok) return afterAuth();
  showAuth();
}

function toggleAuth(mode) {
  document.getElementById("login-form").classList.toggle("hidden", mode === "signup");
  document.getElementById("signup-form").classList.toggle("hidden", mode === "login");
}

async function handleLogin(e) {
  e.preventDefault();
  let u = e.target["login-username"].value,
      p = e.target["login-password"].value;
  let res = await fetch("/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: p })
  });
  if (res.ok) afterAuth();
  else alert("Invalid credentials");
}

async function handleSignup(e) {
  e.preventDefault();
  let u = e.target["signup-username"].value,
      p = e.target["signup-password"].value;
  let res = await fetch("/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: p })
  });
  if (res.ok) afterAuth();
  else alert("Username taken");
}

async function afterAuth() {
  // hide auth, show chat
  document.getElementById("auth-container").classList.add("hidden");
  ["top-nav", "chat-container", "input-bar"].forEach(id => document.getElementById(id).classList.remove("hidden"));
  await loadSessions();
  if (!currentSession) await createSession();
  else await loadMessages();
}

function showAuth() {
  document.getElementById("auth-container").classList.remove("hidden");
}

async function loadSessions() {
  let res = await fetch("/sessions", { credentials: "include" });
  let arr = await res.json();
  let sel = document.getElementById("session-list");
  sel.innerHTML = "";
  arr.forEach(s => {
    let opt = document.createElement("option");
    opt.value = s.id;
    opt.text = s.title || "New Chat";
    sel.add(opt);
  });
  currentSession = sel.value;
}

async function createSession() {
  let res = await fetch("/sessions", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "New Chat" })
  });
  let obj = await res.json();
  await loadSessions();
  currentSession = obj.id;
  loadMessages();
}

async function loadMessages() {
  let res = await fetch(`/messages?session_id=${currentSession}`, { credentials: "include" });
  let msgs = await res.json();
  let win = document.getElementById("chat-window");
  win.innerHTML = "";
  msgs.forEach(m => appendMessage(m.role === "user" ? "You" : "AI", m.content));
}

async function sendMessage() {
  let txt = document.getElementById("user-input").value.trim();
  if (!txt) return;
  appendMessage("You", txt);
  document.getElementById("user-input").value = "";

  try {
    let res = await fetch("/reflect", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: txt, session_id: currentSession })
    });
    let data = await res.json();
    data.messages.forEach(m => appendMessage("AI", m.content));
  } catch {
    appendMessage("Error", "Could not send message.");
  }
}

function clearChat() {
  fetch(`/sessions/${currentSession}/messages`, {
    method: "DELETE",
    credentials: "include"
  }).then(() => {
    document.getElementById("chat-window").innerHTML = "";
  });
}

function appendMessage(who, text) {
  let p = document.createElement("p");
  p.innerHTML = `<strong>${who}:</strong> ${text}`;
  let win = document.getElementById("chat-window");
  win.append(p);
  win.scrollTop = win.scrollHeight;
}
