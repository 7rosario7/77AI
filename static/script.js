document.addEventListener("DOMContentLoaded", init);

let currentSession = null;

async function init() {
  await fetchMe();
  await loadSessions();

  document.getElementById("new-chat").onclick  = createNewSession;
  document.getElementById("logout-btn").onclick = logout;
  document.getElementById("clear-btn").onclick  = () => clearChat(currentSession);
  document.getElementById("rename-chat").onclick = renameSession;
  
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
  document.getElementById("send-btn").onclick = sendPrompt;
}

async function fetchMe() {
  const res = await fetch("/me");
  if (res.status === 401) window.location.reload();
}

async function loadSessions() {
  const sessions = await fetch("/sessions").then(r => r.json());
  const sel = document.getElementById("session-select");

  sel.innerHTML = sessions.map(s =>
    `<option value="${s.id}">${s.title||"New Chat"} ×</option>`
  ).join("");
  sel.style.display = sessions.length ? "inline-block" : "none";
  document.getElementById("rename-chat").style.display = sessions.length ? "inline-block" : "none";

  // delete on click of the “×”
  sel.querySelectorAll("option").forEach(opt => {
    opt.addEventListener("click", async e => {
      if (e.target.textContent.endsWith("×")) {
        e.preventDefault();
        await fetch(`/sessions/${opt.value}`, { method: "DELETE" });
        return loadSessions();
      }
    });
  });

  sel.onchange = () => loadMessages(sel.value);

  if (sessions.length) {
    currentSession = sessions[0].id;
    sel.value = currentSession;
    await loadMessages(currentSession);
  } else {
    await createNewSession();
  }
}

async function createNewSession() {
  const { id } = await fetch("/sessions", { method: "POST" }).then(r => r.json());
  currentSession = id;
  await loadSessions();

  const box = document.getElementById("chat-box");
  box.innerHTML = "";
  showSystemMessage("Your mirror awaits—let's begin.");
}

async function renameSession() {
  const sel = document.getElementById("session-select");
  const id  = sel.value;
  const old = sel.options[sel.selectedIndex].text.replace(/ ×$/, "");
  const title = prompt("Rename chat:", old);
  if (!title?.trim()) return;
  await fetch(`/sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title.trim() })
  });
  await loadSessions();
}

async function loadMessages(sid) {
  currentSession = sid;
  const msgs = await fetch(`/messages?session_id=${sid}`).then(r => r.json());
  const box  = document.getElementById("chat-box");
  box.innerHTML = "";
  msgs.forEach(m => {
    const d = document.createElement("div");
    d.className = m.role;
    d.textContent = (m.role === "user" ? "You: " : "AI: ") + m.content;
    box.appendChild(d);
  });
  box.scrollTop = box.scrollHeight;
}

function showSystemMessage(text) {
  const box = document.getElementById("chat-box");
  const sys = document.createElement("div");
  sys.className = "system";
  sys.textContent = text;
  box.appendChild(sys);
  box.scrollTop = box.scrollHeight;
}

async function clearChat(sid) {
  await fetch(`/sessions/${sid}/messages`, { method: "DELETE" });
  document.getElementById("chat-box").innerHTML = "";
  showSystemMessage("Chat cleared.");
}

async function logout() {
  await fetch("/logout", { method: "POST" });
  window.location.reload();
}

async function sendPrompt() {
  const input = document.getElementById("prompt");
  const text  = input.value.trim();
  if (!text) return;
  input.value = "";

  // append immediately
  const box = document.getElementById("chat-box");
  const u   = document.createElement("div");
  u.className = "user";
  u.textContent = "You: " + text;
  box.appendChild(u);
  box.scrollTop = box.scrollHeight;

  // send to server
  const res = await fetch("/reflect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: currentSession, prompt: text })
  });
  if (!res.ok) {
    showSystemMessage("Error: could not send message.");
    return;
  }
  const { messages } = await res.json();
  messages.slice(-1).forEach(m => {
    const a = document.createElement("div");
    a.className = "ai";
    a.textContent = "AI: " + m.content;
    box.appendChild(a);
  });
  box.scrollTop = box.scrollHeight;
}
