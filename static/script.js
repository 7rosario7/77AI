document.addEventListener("DOMContentLoaded", init);
let currentSession = null;

async function init() {
  // auth tabs
  document.getElementById("show-login").onclick  = ()=>toggleTab("login");
  document.getElementById("show-signup").onclick = ()=>toggleTab("signup");
  // auth actions
  document.getElementById("login-btn").onclick  = login;
  document.getElementById("signup-btn").onclick = signup;
  document.getElementById("logout-btn").onclick = logout;
  // session & chat actions
  document.getElementById("new-chat").onclick   = createNewSession;
  document.getElementById("session-select").onchange = e=>loadMessages(e.target.value);
  document.getElementById("rename-btn").onclick = renameSession;
  document.getElementById("delete-btn").onclick = deleteCurrentSession;
  document.getElementById("clear-btn").onclick  = ()=>clearChat(currentSession);
  document.getElementById("send-btn").onclick   = sendPrompt;

  // placeholder + Enter
  const input = document.getElementById("prompt");
  input.addEventListener("focus", ()=>{
    if (input.placeholder==="Speak your truth into the void...")
      input.placeholder="";
  });
  input.addEventListener("keydown", e => {
    if (e.key==="Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  });

  // check login
  await fetchMe();
}

function toggleTab(tab) {
  document.getElementById("show-login").classList.toggle("active", tab==="login");
  document.getElementById("show-signup").classList.toggle("active", tab==="signup");
  document.getElementById("login-form").style.display  = tab==="login"? "flex" : "none";
  document.getElementById("signup-form").style.display = tab==="signup"? "flex" : "none";
}

async function fetchMe() {
  const ok = (await fetch("/me")).ok;
  const authElems = ["auth-container"];
  const appElems  = ["new-chat","session-select","rename-btn","delete-btn","clear-btn","logout-btn","app-container"];

  if (ok) {
    authElems.forEach(id=>document.getElementById(id).style.display="none");
    appElems.forEach(id=>document.getElementById(id).style.display = 
      id==="app-container" ? "flex" : "inline-block"
    );
    await loadSessions();
  } else {
    authElems.forEach(id=>document.getElementById(id).style.display="flex");
    appElems.forEach(id=>document.getElementById(id).style.display="none");
  }
}

async function login() {
  const u = document.getElementById("login-username").value,
        p = document.getElementById("login-password").value;
  const res = await fetch("/login", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({username:u,password:p})
  });
  if (!res.ok) return alert("Login failed");
  await fetchMe();
}

async function signup() {
  const u = document.getElementById("signup-username").value,
        p = document.getElementById("signup-password").value;
  const res = await fetch("/signup", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({username:u,password:p})
  });
  if (!res.ok) return alert("Sign-up failed");
  await fetchMe();
}

async function logout() {
  await fetch("/logout",{method:"POST"});
  currentSession = null;
  document.getElementById("session-select").innerHTML = "";
  document.getElementById("chat-box").innerHTML       = "";
  await fetchMe();
}

async function loadSessions() {
  const sessions = await fetch("/sessions").then(r=>r.json());
  const sel      = document.getElementById("session-select");
  sel.innerHTML  = sessions.map(s=>
    `<option value="${s.id}">${s.title||"New Chat"}</option>`
  ).join("");
  if (sessions.length) {
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

async function renameSession() {
  const title = prompt("Enter new name:");
  if (!title) return;
  await fetch(`/sessions/${currentSession}`, {
    method:"PUT",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({title})
  });
  await loadSessions();
}

async function deleteCurrentSession() {
  if (!confirm("Delete this chat?")) return;
  await fetch(`/sessions/${currentSession}`, {method:"DELETE"});
  currentSession = null;
  await loadSessions();
}

async function loadMessages(sessionId) {
  currentSession = sessionId;
  const msgs = await fetch(`/messages?session_id=${sessionId}`).then(r=>r.json());
  const box  = document.getElementById("chat-box");
  box.innerHTML = "";
  showSystemMessage("Your mirror awaits—let's begin.");
  msgs.forEach(m=>{
    const d = document.createElement("div");
    d.className = m.role;
    d.textContent = `${m.role==="user"?"You":"AI"}: ${m.content}`;
    box.appendChild(d);
  });
  box.scrollTop = box.scrollHeight;
}

async function clearChat(sessionId) {
  await fetch(`/sessions/${sessionId}/messages`, {method:"DELETE"});
  document.getElementById("chat-box").innerHTML = "";
  showSystemMessage("Chat cleared — speak again.");
}

async function sendPrompt() {
  const txt = document.getElementById("prompt").value.trim();
  if (!txt || !currentSession) return;
  const box = document.getElementById("chat-box");
  // user
  const uel = document.createElement("div");
  uel.className  = "user";
  uel.textContent = `You: ${txt}`;
  box.appendChild(uel);
  document.getElementById("prompt").value = "";
  box.scrollTop = box.scrollHeight;

  // AI
  const res = await fetch("/reflect", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({session_id:currentSession, prompt:txt})
  });
  if (!res.ok) {
    showSystemMessage("Error: could not send message.");
    return;
  }
  const {messages} = await res.json();
  messages.forEach(m=>{
    const ael = document.createElement("div");
    ael.className  = "ai";
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
