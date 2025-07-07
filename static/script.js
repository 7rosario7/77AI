document.addEventListener("DOMContentLoaded", init);
let currentSession = null;

async function init() {
  // tabs
  document.getElementById("show-login").onclick  = ()=>toggleTab("login");
  document.getElementById("show-signup").onclick = ()=>toggleTab("signup");
  // auth
  document.getElementById("login-btn").onclick  = login;
  document.getElementById("signup-btn").onclick = signup;
  // app
  document.getElementById("new-chat").onclick   = createNewSession;
  document.getElementById("logout-btn").onclick = logout;
  document.getElementById("clear-btn").onclick  = ()=>clearChat(currentSession);
  document.getElementById("rename-btn").onclick = renameSession;
  document.getElementById("send-btn").onclick   = sendPrompt;
  // placeholder & Enter
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
  // check auth
  await fetchMe();
}

function toggleTab(tab) {
  document.getElementById("show-login").classList.toggle("active", tab==="login");
  document.getElementById("show-signup").classList.toggle("active", tab==="signup");
  document.getElementById("login-form").style.display  = tab==="login"? "flex":"none";
  document.getElementById("signup-form").style.display = tab==="signup"? "flex":"none";
}

async function fetchMe() {
  const ok = (await fetch("/me")).ok;
  if (ok) {
    document.getElementById("auth-container").style.display="none";
    ["session-select","rename-btn","clear-btn","logout-btn","new-chat","app-container"]
      .forEach(id=>document.getElementById(id).style.display="inline-block");
    // show app-container as flex
    document.getElementById("app-container").style.display="flex";
    await loadSessions();
  } else {
    document.getElementById("auth-container").style.display="flex";
    ["session-select","rename-btn","clear-btn","logout-btn","new-chat","app-container"]
      .forEach(id=>document.getElementById(id).style.display="none");
  }
}

async function login() {
  const u=document.getElementById("login-username").value;
  const p=document.getElementById("login-password").value;
  const res=await fetch("/login", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({username:u,password:p})
  });
  if (!res.ok) return alert("Login failed");
  await fetchMe();
}

async function signup() {
  const u=document.getElementById("signup-username").value;
  const p=document.getElementById("signup-password").value;
  const res=await fetch("/signup", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({username:u,password:p})
  });
  if (!res.ok) return alert("Sign-up failed");
  await fetchMe();
}

async function logout() {
  await fetch("/logout",{method:"POST"});
  currentSession = null;
  document.getElementById("session-select").innerHTML="";
  document.getElementById("chat-box").innerHTML="";
  await fetchMe();
}

async function loadSessions() {
  const sessions = await fetch("/sessions").then(r=>r.json());
  const sel = document.getElementById("session-select");
  sel.innerHTML = sessions.map(s=>
    `<option value="${s.id}">${s.title||"New Chat"} ×</option>`
  ).join("");
  // delete on ×
  sel.querySelectorAll("option").forEach(opt=>{
    opt.addEventListener("click", async e=>{
      if (e.target.textContent.endsWith("×")) {
        e.preventDefault();
        await fetch(`/sessions/${opt.value}`, {method:"DELETE"});
        return loadSessions();
      }
    });
  });
  sel.onchange = ()=>loadMessages(sel.value);
  if (sessions.length) {
    sel.value = sessions[0].id;
    await loadMessages(sessions[0].id);
  } else {
    await createNewSession();
  }
}

async function createNewSession() {
  const {id} = await fetch("/sessions", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({title:null})
  }).then(r=>r.json());
  currentSession = id;
  await loadSessions();
}

async function renameSession() {
  const newTitle = prompt("New chat name:");
  if (!newTitle) return;
  await fetch(`/sessions/${currentSession}`, {
    method:"PUT", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({title: newTitle})
  });
  await loadSessions();
}

async function loadMessages(sessionId) {
  currentSession = sessionId;
  const msgs = await fetch(`/messages?session_id=${sessionId}`).then(r=>r.json());
  const box = document.getElementById("chat-box");
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
  document.getElementById("chat-box").innerHTML="";
  showSystemMessage("Chat cleared — speak again.");
}

async function sendPrompt() {
  const txt = document.getElementById("prompt").value.trim();
  if (!txt||!currentSession) return;
  const box = document.getElementById("chat-box");
  // user
  const ue = document.createElement("div");
  ue.className="user";
  ue.textContent=`You: ${txt}`;
  box.appendChild(ue);
  document.getElementById("prompt").value="";
  box.scrollTop = box.scrollHeight;
  // AI
  const res = await fetch("/reflect", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({session_id: currentSession, prompt: txt})
  });
  if (!res.ok) {
    showSystemMessage("Error: could not send message.");
    return;
  }
  const {messages} = await res.json();
  messages.forEach(m=>{
    const ae = document.createElement("div");
    ae.className="ai";
    ae.textContent=`AI: ${m.content}`;
    box.appendChild(ae);
  });
  box.scrollTop = box.scrollHeight;
}

function showSystemMessage(text) {
  const d = document.createElement("div");
  d.className = "system";
  d.textContent = text;
  document.getElementById("chat-box").appendChild(d);
}
