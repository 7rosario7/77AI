document.addEventListener("DOMContentLoaded", init);
let currentSession = null;

async function init() {
  // Auth tabs
  document.getElementById("show-login").onclick  = ()=>toggleTab("login");
  document.getElementById("show-signup").onclick = ()=>toggleTab("signup");
  // Auth actions
  document.getElementById("login-btn").onclick    = login;
  document.getElementById("signup-btn").onclick   = signup;
  document.getElementById("logout-btn").onclick   = logout;
  // Session/chat actions
  document.getElementById("new-chat").onclick     = createNewSession;
  document.getElementById("session-select").onchange = e=>loadMessages(e.target.value);
  document.getElementById("rename-btn").onclick   = renameSession;
  document.getElementById("delete-btn").onclick   = deleteCurrentSession;
  document.getElementById("clear-btn").onclick    = ()=>clearChat(currentSession);
  document.getElementById("send-btn").onclick     = sendPrompt;

  // Placeholder + Enter to send
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

  // Kick off
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
  const authEls = ["auth-container"];
  const appEls  = ["new-chat","session-select","rename-btn","delete-btn","clear-btn","logout-btn","app-container"];
  if (ok) {
    authEls.forEach(id=>el(id).style.display="none");
    appEls.forEach(id=>el(id).style.display = id==="app-container" ? "flex" : "inline-block");
    await loadSessions();
  } else {
    authEls.forEach(id=>el(id).style.display="flex");
    appEls.forEach(id=>el(id).style.display="none");
  }
}

async function login() {
  const u = val("login-username"), p = val("login-password");
  const res = await fetch("/login", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({username:u,password:p})
  });
  if (!res.ok) return alert("Login failed");
  await fetchMe();
}

async function signup() {
  const u = val("signup-username"), p = val("signup-password");
  const res = await fetch("/signup", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({username:u,password:p})
  });
  if (!res.ok) return alert("Sign-up failed");
  await fetchMe();
}

async function logout() {
  await fetch("/logout",{method:"POST"});
  currentSession = null;
  el("session-select").innerHTML = "";
  el("chat-box").innerHTML       = "";
  await fetchMe();
}

async function loadSessions() {
  const sessions = await fetch("/sessions").then(r=>r.json());
  const sel      = el("session-select");
  sel.innerHTML  = sessions.map(s=>
    `<option value="${s.id}">${s.title || "New Chat"}</option>`
  ).join("");
  sel.style.display = sessions.length ? "inline-block" : "none";
  if (sessions.length) {
    await loadMessages(sessions[0].id);
  } else {
    await createNewSession();
  }
}

async function createNewSession() {
  const {id} = await fetch("/sessions", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({title:null})
  }).then(r=>r.json());
  currentSession = id;
  await loadSessions();
}

async function renameSession() {
  const title = prompt("New name:");
  if (!title) return;
  await fetch(`/sessions/${currentSession}`, {
    method:"PUT", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({title})
  });
  await loadSessions();
  selectOption(currentSession);
}

async function deleteCurrentSession() {
  if (!confirm("Really delete this chat?")) return;
  await fetch(`/sessions/${currentSession}`, {method:"DELETE"});
  currentSession = null;
  await loadSessions();
}

async function loadMessages(sessionId) {
  currentSession = sessionId;
  const msgs = await fetch(`/messages?session_id=${sessionId}`).then(r=>r.json());
  const box  = el("chat-box");
  box.innerHTML = "";
  showSystemMessage("Your mirror awaits—let's begin.");
  msgs.forEach(m=>{
    const d = document.createElement("div");
    d.className = m.role;
    d.textContent = `${m.role==="user"?"You":"AI"}: ${m.content}`;
    box.appendChild(d);
  });
  box.scrollTop = box.scrollHeight;
  // show rename / delete / clear
  ["rename-btn","delete-btn","clear-btn"].forEach(id=>el(id).style.display="inline-block");
}

async function clearChat(sessionId) {
  await fetch(`/sessions/${sessionId}/messages`, {method:"DELETE"});
  el("chat-box").innerHTML = "";
  showSystemMessage("Chat cleared—speak again.");
}

async function sendPrompt() {
  const txt = el("prompt").value.trim();
  if (!txt || !currentSession) return;
  const box = el("chat-box");
  appendLine(box, "user", `You: ${txt}`);
  el("prompt").value = "";
  box.scrollTop = box.scrollHeight;

  const res = await fetch("/reflect", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({session_id:currentSession,prompt:txt})
  });
  if (!res.ok) return showSystemMessage("Error sending message.");
  const {messages} = await res.json();
  messages.forEach(m=>appendLine(box, "ai", `AI: ${m.content}`));
  box.scrollTop = box.scrollHeight;
}

function showSystemMessage(text) {
  appendLine(el("chat-box"), "system", text);
}

function appendLine(container, cls, text) {
  const d = document.createElement("div");
  d.className = cls;
  d.textContent = text;
  container.appendChild(d);
}

function el(id){return document.getElementById(id)}
function val(id){return el(id).value}
function selectOption(val){
  const sel = el("session-select");
  sel.value = val;
}
