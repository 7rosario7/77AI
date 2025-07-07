document.addEventListener("DOMContentLoaded", init);

let currentSession = null;

async function init() {
  await fetchMe();
  document.getElementById("login-btn").onclick = doLogin;
  document.getElementById("signup-btn").onclick = doSignup;
  document.getElementById("to-signup").onclick = e => toggleAuth(false);
  document.getElementById("to-login").onclick = e => toggleAuth(true);

  document.getElementById("new-chat").onclick = showSessionDropdown;
  document.getElementById("logout-btn").onclick = doLogout;
  document.getElementById("clear-btn").onclick = () => clearChat(currentSession);

  const input = document.getElementById("prompt");
  input.placeholder = "Speak your truth into the void...";
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
  document.getElementById("send-btn").onclick = sendPrompt;
}

function toggleAuth(showLogin) {
  document.getElementById("login-box").hidden  = !showLogin;
  document.getElementById("signup-box").hidden =  showLogin;
}

async function fetchMe() {
  let me = await fetch("/me").then(r => r.json()).catch(_=>null);
  if (me && me.id) {
    document.getElementById("auth-panel").hidden = true;
    document.getElementById("chat-panel").hidden = false;
    await loadSessions();
  }
}

async function doLogin() {
  const u = document.getElementById("login-user").value;
  const p = document.getElementById("login-pass").value;
  let res = await fetch("/login", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({username:u,password:p})
  });
  if (res.ok) return fetchMe();
  alert("Login failed");
}

async function doSignup() {
  const u = document.getElementById("signup-user").value;
  const p = document.getElementById("signup-pass").value;
  let res = await fetch("/signup", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({username:u,password:p})
  });
  if (res.ok) {
    toggleAuth(true);
    alert("Created—please log in");
  } else {
    alert("Sign-up error");
  }
}

async function doLogout() {
  await fetch("/logout", {method:"POST"});
  location.reload();
}

async function loadSessions() {
  const sel = document.getElementById("session-list");
  sel.innerHTML = "";
  const sessions = await fetch("/sessions").then(r=>r.json());
  sessions.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.text = s.title;
    sel.appendChild(opt);
  });
  sel.onchange = async () => {
    currentSession = sel.value;
    await populateChat(currentSession);
  };
  showSessionDropdown();  
}

function showSessionDropdown() {
  const sel = document.getElementById("session-list");
  sel.hidden = !sel.hidden;
  if (!sel.hidden && sel.options.length === 0) {
    // first time: create a new session
    createSession();
  }
}

async function createSession() {
  const {id} = await fetch("/sessions", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({title:"New Chat"})
  }).then(r=>r.json());
  currentSession = id;
  await loadSessions();
  clearChat(currentSession);
  showSystemMessage("Your mirror awaits—let’s begin.");
}

async function deleteSession(id) {
  await fetch(`/sessions/${id}`, {method:"DELETE"});
  await loadSessions();
}

async function populateChat(sessionId) {
  const msgs = await fetch(`/messages?session_id=${sessionId}`)
                     .then(r=>r.json());
  const box = document.getElementById("chat-box");
  box.innerHTML = "";
  msgs.forEach(m => {
    const d = document.createElement("div");
    d.className = m.role === "system" ? "system" : "";
    d.textContent = `${m.role === "user" ? "You" : "AI"}: ${m.content}`;
    box.appendChild(d);
  });
  box.scrollTop = box.scrollHeight;
}

function clearChat(sessionId) {
  document.getElementById("chat-box").innerHTML = "";
  showSystemMessage("Chat cleared. Your mirror awaits—let’s begin.");
}

function showSystemMessage(text) {
  const box = document.getElementById("chat-box");
  const sys = document.createElement("div");
  sys.className = "system";
  sys.textContent = text;
  box.appendChild(sys);
  box.scrollTop = box.scrollHeight;
}

async function sendPrompt() {
  const prompt = document.getElementById("prompt").value.trim();
  if (!prompt || !currentSession) return;
  // render user
  const box = document.getElementById("chat-box");
  const u = document.createElement("div");
  u.textContent = `You: ${prompt}`;
  box.appendChild(u);
  document.getElementById("prompt").value = "";
  box.scrollTop = box.scrollHeight;

  // call API
  const res = await fetch("/reflect", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({session_id:currentSession,prompt})
  });
  if (!res.ok) {
    showSystemMessage("Error: could not send message.");
    return;
  }
  const {messages} = await res.json();
  // AI’s last message
  const aiText = messages[messages.length-1].content;
  const a = document.createElement("div");
  a.textContent = `AI: ${aiText}`;
  box.appendChild(a);
  box.scrollTop = box.scrollHeight;
}
