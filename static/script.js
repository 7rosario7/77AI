document.addEventListener("DOMContentLoaded", init);

let currentSession = null;

async function init() {
  // Tab toggles
  document.getElementById("show-login").onclick = () => toggleTab("login");
  document.getElementById("show-signup").onclick = () => toggleTab("signup");

  // Auth buttons
  document.getElementById("login-btn").onclick  = login;
  document.getElementById("signup-btn").onclick = signup;

  // App buttons
  document.getElementById("new-chat").onclick  = createNewSession;
  document.getElementById("logout-btn").onclick= logout;
  document.getElementById("clear-btn").onclick = () => clearChat(currentSession);
  document.getElementById("send-btn").onclick  = sendPrompt;

  // Prompt placeholder & enter key
  const input = document.getElementById("prompt");
  input.addEventListener("focus", () => {
    if (input.placeholder === "Speak your truth into the void...")
      input.placeholder = "";
  });
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  });

  await fetchMe();
}

function toggleTab(tab) {
  document.getElementById("show-login").classList.toggle("active", tab==="login");
  document.getElementById("show-signup").classList.toggle("active", tab==="signup");
  document.getElementById("login-form").style.display  = tab==="login"  ? "block" : "none";
  document.getElementById("signup-form").style.display = tab==="signup" ? "block" : "none";
}

async function fetchMe() {
  let ok = false;
  try {
    const res = await fetch("/me");
    if (res.ok) ok = true;
  } catch(_) {}
  if (ok) {
    document.getElementById("auth-container").style.display = "none";
    document.getElementById("app-container" ).style.display = "block";
    await loadSessions();
  } else {
    document.getElementById("auth-container").style.display = "block";
    document.getElementById("app-container" ).style.display = "none";
  }
}

async function login() {
  const u = document.getElementById("login-username").value;
  const p = document.getElementById("login-password").value;
  const res = await fetch("/login", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({username:u,password:p})
  });
  if (res.ok) {
    await fetchMe();
  } else {
    alert("Login failed");
  }
}

async function signup() {
  const u = document.getElementById("signup-username").value;
  const p = document.getElementById("signup-password").value;
  const res = await fetch("/signup", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({username:u,password:p})
  });
  if (res.ok) {
    await fetchMe();
  } else {
    alert("Sign-up failed");
  }
}

async function logout() {
  await fetch("/logout", {method:"POST"});
  currentSession = null;
  document.getElementById("session-select").innerHTML = "";
  document.getElementById("chat-box").innerHTML = "";
  await fetchMe();
}

async function loadSessions() {
  const sessions = await fetch("/sessions").then(r=>r.json());
  const sel = document.getElementById("session-select");
  sel.innerHTML = sessions.map(s => `
    <option value="${s.id}">${s.title||"New Chat"}</option>
  `).join("");
  sel.onchange = () => loadMessages(sel.value);
  if (sessions.length) {
    sel.value = sessions[0].id;
    await loadMessages(sessions[0].id);
  } else {
    await createNewSession();
  }
}

async function createNewSession() {
  const {id} = await fetch("/sessions", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({title:null})
  }).then(r=>r.json());
  currentSession = id;
  await loadSessions();
}

async function loadMessages(sessionId) {
  currentSession = sessionId;
  const msgs = await fetch(`/messages?session_id=${sessionId}`).then(r=>r.json());
  const box = document.getElementById("chat-box");
  box.innerHTML = "";
  msgs.forEach(m => {
    const el = document.createElement("div");
    el.className = m.role;
    el.textContent = `${m.role === "user" ? "You" : "AI"}: ${m.content}`;
    box.appendChild(el);
  });
  showSystemMessage("Your mirror awaits—let's begin.");
}

async function clearChat(sessionId) {
  await fetch(`/sessions/${sessionId}/messages`, {method:"DELETE"});
  document.getElementById("chat-box").innerHTML = "";
  showSystemMessage("Chat cleared — speak again.");
}

async function sendPrompt() {
  const txt = document.getElementById("prompt").value.trim();
  if (!txt || !currentSession) return;
  // append user msg
  const box = document.getElementById("chat-box");
  const uel = document.createElement("div");
  uel.className = "user";
  uel.textContent = `You: ${txt}`;
  box.appendChild(uel);
  document.getElementById("prompt").value = "";
  box.scrollTop = box.scrollHeight;

  // send to AI
  const res = await fetch("/reflect", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ session_id: currentSession, prompt: txt })
  });
  if (!res.ok) {
    showSystemMessage("Error: could not send message.");
    return;
  }
  const { messages } = await res.json();
  messages.forEach(m => {
    const ael = document.createElement("div");
    ael.className = "ai";
    ael.textContent = `AI: ${m.content}`;
    box.appendChild(ael);
  });
  box.scrollTop = box.scrollHeight;
}

function showSystemMessage(text) {
  const sys = document.createElement("div");
  sys.className = "system";
  sys.textContent = text;
  document.getElementById("chat-box").appendChild(sys);
}
