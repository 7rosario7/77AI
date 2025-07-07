document.addEventListener("DOMContentLoaded", init);

let currentSession = null;

async function init() {
  // show auth only at startup
  document.getElementById("auth-panel").hidden = false;
  document.getElementById("chat-panel").hidden = true;

  // wire buttons
  document.getElementById("login-btn").onclick    = doLogin;
  document.getElementById("signup-btn").onclick   = doSignup;
  document.getElementById("to-signup").onclick    = e => { e.preventDefault(); toggleAuth("signup"); };
  document.getElementById("to-login").onclick     = e => { e.preventDefault(); toggleAuth("login"); };
  document.getElementById("new-chat").onclick     = createNewSession;
  document.getElementById("logout-btn").onclick   = doLogout;
  document.getElementById("clear-btn").onclick    = () => clearChat(currentSession);
  document.getElementById("send-btn").onclick     = sendPrompt;

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

  // check if already logged in
  await fetchMe();
}

function toggleAuth(mode) {
  document.getElementById("login-box").hidden  = (mode === "signup");
  document.getElementById("signup-box").hidden = (mode === "login");
}

// --- implement these exactly as before, pointing at your FastAPI endpoints:

async function doLogin() {
  const u = document.getElementById("login-username").value;
  const p = document.getElementById("login-password").value;
  const res = await fetch("/login", {
    method: "POST",
    credentials: "include",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({username:u,password:p})
  });
  if (res.ok) fetchMe();
  else alert("Invalid credentials");
}

async function doSignup() {
  const u = document.getElementById("signup-username").value;
  const p = document.getElementById("signup-password").value;
  const res = await fetch("/signup", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({username:u,password:p})
  });
  if (res.ok) alert("Signed up—please log in."); 
  else res.text().then(t=>alert(t));
}

async function doLogout() {
  await fetch("/logout", {method:"POST",credentials:"include"});
  document.getElementById("auth-panel").hidden = false;
  document.getElementById("chat-panel").hidden = true;
}

async function fetchMe() {
  const me = await fetch("/me", {credentials:"include"});
  if (me.status===200) {
    document.getElementById("auth-panel").hidden = true;
    document.getElementById("chat-panel").hidden = false;
    await loadSessions();
    // show greeting only on first load
    showSystemMessage("Your mirror awaits—let’s begin.");
  }
}

// Sessions list, create, delete, select—hitting /sessions endpoints:
async function loadSessions() {
  const list = await (await fetch("/sessions", {credentials:"include"})).json();
  const ul = document.getElementById("session-list");
  ul.innerHTML = "";
  list.forEach(s => {
    const li = document.createElement("li");
    li.textContent = s.title||"New Chat";
    li.onclick = () => selectSession(s.id);
    const x = document.createElement("button");
    x.textContent = "×"; x.onclick = e=>{e.stopPropagation(); deleteSession(s.id);};
    li.appendChild(x);
    ul.appendChild(li);
  });
}

async function createNewSession() {
  const {id} = await (await fetch("/sessions",{ method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body:JSON.stringify({title:"New Chat"}) })).json();
  currentSession = id;
  await loadSessions();
  clearChat(id);
  showSystemMessage("Your mirror awaits—let’s begin.");
}

async function deleteSession(id) {
  await fetch(`/sessions/${id}`,{method:"DELETE",credentials:"include"});
  if (id===currentSession) clearChat(null);
  await loadSessions();
}

async function selectSession(id) {
  currentSession = id;
  clearChat(id);
  const msgs = await (await fetch(`/messages?session_id=${id}`,{credentials:"include"})).json();
  const box = document.getElementById("chat-box");
  msgs.forEach(m => {
    const d = document.createElement("div");
    d.className = m.role;
    d.textContent = m.content;
    box.appendChild(d);
  });
  box.scrollTop = box.scrollHeight;
}

function clearChat(id) {
  currentSession = id;
  document.getElementById("chat-box").innerHTML = "";
}

async function sendPrompt() {
  const text = document.getElementById("prompt").value.trim();
  if (!text || !currentSession) return;
  document.getElementById("prompt").value = "";
  // post to /reflect
  const {messages} = await (await fetch("/reflect", {
    method:"POST",
    credentials:"include",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({session_id: currentSession, prompt: text})
  })).json();

  const box = document.getElementById("chat-box");
  messages.forEach(m => {
    const d = document.createElement("div");
    d.className = m.role;
    d.textContent = m.content;
    box.appendChild(d);
  });
  box.scrollTop = box.scrollHeight;
}
