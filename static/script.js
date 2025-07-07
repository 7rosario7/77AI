document.addEventListener("DOMContentLoaded", init);

let currentSession = null;

async function init() {
  await fetchMe();
  await loadSessions();
  document.getElementById("new-chat").onclick = createNewSession;
  document.getElementById("logout-btn").onclick = logout;
  document.getElementById("clear-btn").onclick = () => clearChat(currentSession);
  const input = document.getElementById("prompt");
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  });
  document.getElementById("send-btn").onclick = sendPrompt;
}

async function fetchMe() {
  const me = await fetch("/me", { credentials: "include" });
  if (me.status === 401) {
    document.getElementById("auth-container").style.display = "block";
    document.getElementById("chat-container").style.display = "none";
  } else {
    document.getElementById("auth-container").style.display = "none";
    document.getElementById("chat-container").style.display = "block";
  }
}

async function loadSessions() {
  const resp = await fetch("/sessions", { credentials: "include" });
  const sessions = await resp.json();
  const list = document.getElementById("sessions-list");
  list.innerHTML = "";
  sessions.forEach(s => {
    const item = document.createElement("div");
    item.className = "session-item";
    item.textContent = s.title;
    item.onclick = () => selectSession(s.id);
    const del = document.createElement("span");
    del.textContent = "×";
    del.className = "delete-session";
    del.onclick = e => {
      e.stopPropagation();
      deleteSession(s.id);
    };
    item.appendChild(del);
    list.appendChild(item);
    if (!currentSession) currentSession = s.id;
  });
  if (currentSession) selectSession(currentSession);
}

async function createNewSession() {
  const { id } = await fetch("/sessions", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "New Chat" })
  }).then(r => r.json());
  currentSession = id;
  await loadSessions();
}

async function deleteSession(id) {
  await fetch(`/sessions/${id}`, {
    method: "DELETE",
    credentials: "include"
  });
  if (currentSession === id) currentSession = null;
  await loadSessions();
}

async function selectSession(id) {
  currentSession = id;
  const msgs = await fetch(`/messages?session_id=${id}`, {
    credentials: "include"
  }).then(r => r.json());
  const box = document.getElementById("chat-box");
  box.innerHTML = "";
  msgs.forEach(m => {
    const div = document.createElement("div");
    div.className = m.role;
    div.textContent = m.content;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

async function sendPrompt() {
  const prompt = document.getElementById("prompt").value.trim();
  if (!prompt) return;
  const box = document.getElementById("chat-box");
  const userDiv = document.createElement("div");
  userDiv.className = "user";
  userDiv.textContent = prompt;
  box.appendChild(userDiv);
  box.scrollTop = box.scrollHeight;
  document.getElementById("prompt").value = "";
  const resp = await fetch("/chat", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: currentSession, prompt })
  }).then(r => r.json());
  resp.messages.forEach(m => {
    const aiDiv = document.createElement("div");
    aiDiv.className = m.role;
    aiDiv.textContent = m.content;
    box.appendChild(aiDiv);
  });
  box.scrollTop = box.scrollHeight;
}
