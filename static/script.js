document.addEventListener("DOMContentLoaded", init);

let currentSession = null;

async function init() {
  await fetchMe();
  await loadSessions();

  document.getElementById("new-chat").onclick = createNewSession;
  document.getElementById("logout-btn").onclick  = logout;
  document.getElementById("clear-btn").onclick   = () => clearChat(currentSession);

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

async function fetchMe() {
  const resp = await fetch("/me", { credentials: "include" });
  if (resp.status === 401) {
    // show login UI...
  } else {
    // show chat UI...
  }
}

async function loadSessions() {
  const resp = await fetch("/sessions", { credentials: "include" });
  const sessions = await resp.json();
  const list = document.getElementById("session-list");
  list.innerHTML = "";
  sessions.forEach(s => {
    const li = document.createElement("li");
    li.textContent = s.title;
    li.dataset.id = s.id;
    li.onclick = () => selectSession(s.id);

    const del = document.createElement("span");
    del.textContent = "❌";
    del.className = "del";
    del.onclick = e => {
      e.stopPropagation();
      deleteSession(s.id);
    };
    li.appendChild(del);
    list.appendChild(li);
  });
}

async function createNewSession() {
  const resp = await fetch("/sessions", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    credentials: "include",
    body: JSON.stringify({ title: "New Chat" })
  });
  const { id } = await resp.json();
  currentSession = id;
  await loadSessions();

  const box = document.getElementById("chat-box");
  box.innerHTML = "";
  showSystemMessage("Your mirror awaits—let's begin.");
}

function showSystemMessage(text) {
  const box = document.getElementById("chat-box");
  const sys = document.createElement("div");
  sys.className = "system";
  sys.textContent = text;
  box.appendChild(sys);
  box.scrollTop = box.scrollHeight;
}

async function selectSession(id) {
  currentSession = id;
  document.getElementById("session-list").classList.remove("visible");
  const resp = await fetch(`/messages?session_id=${id}`, { credentials: "include" });
  const history = await resp.json();
  const box = document.getElementById("chat-box");
  box.innerHTML = "";
  history.forEach(m => {
    const p = document.createElement("p");
    p.innerHTML = `<strong>${m.role === "assistant" ? "AI:" : "You:"}</strong> ${m.content}`;
    box.appendChild(p);
  });
  box.scrollTop = box.scrollHeight;
}

async function deleteSession(id) {
  await fetch(`/sessions/${id}`, {
    method: "DELETE",
    credentials: "include"
  });
  if (currentSession === id) {
    currentSession = null;
    document.getElementById("chat-box").innerHTML = "";
  }
  await loadSessions();
}

async function clearChat(id) {
  if (!id) return;
  await fetch(`/sessions/${id}/messages`, {
    method: "DELETE",
    credentials: "include"
  });
  document.getElementById("chat-box").innerHTML = "";
}

async function sendPrompt() {
  if (!currentSession) {
    await createNewSession();
  }
  const input = document.getElementById("prompt");
  const prompt = input.value.trim();
  if (!prompt) return;
  appendLine("You:", prompt);
  input.value = "";

  const resp = await fetch("/chat", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    credentials: "include",
    body: JSON.stringify({
      session_id: currentSession,
      prompt: prompt
    })
  });
  if (!resp.ok) {
    appendLine("Error:", "Could not send message.");
    return;
  }
  const { messages } = await resp.json();
  const ai = messages.find(m => m.role === "assistant")?.content;
  appendLine("AI:", ai);
}

function appendLine(label, text) {
  const box = document.getElementById("chat-box");
  const p = document.createElement("p");
  p.innerHTML = `<strong>${label}</strong> ${text}`;
  box.appendChild(p);
  box.scrollTop = box.scrollHeight;
}

async function logout() {
  await fetch("/logout", { method: "POST", credentials: "include" });
  // reload or show login...
}
