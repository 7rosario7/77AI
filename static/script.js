document.addEventListener("DOMContentLoaded", init);

let currentSession = null;

async function init() {
  // 1) Force auth-only view at startup:
  document.getElementById("auth-panel").hidden = false;
  document.getElementById("chat-panel").hidden = true;

  // 2) Wire up buttons & inputs:
  document.getElementById("login-btn").onclick = doLogin;
  document.getElementById("signup-btn").onclick = doSignup;
  document.getElementById("to-signup").onclick = e => {
    e.preventDefault();
    toggleAuth("signup");
  };
  document.getElementById("to-login").onclick = e => {
    e.preventDefault();
    toggleAuth("login");
  };
  document.getElementById("new-chat").onclick = createNewSession;
  document.getElementById("logout-btn").onclick = doLogout;
  document.getElementById("clear-btn").onclick = () => clearChat(currentSession);

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

  // 3) Check auth:
  await fetchMe();
}

// toggles between login and signup boxes
function toggleAuth(mode) {
  document.getElementById("login-box").hidden = (mode === "signup");
  document.getElementById("signup-box").hidden = (mode === "login");
}

// --- implement doLogin, doSignup, doLogout, fetchMe, loadSessions, selectSession,
//     createNewSession, clearChat, sendPrompt exactly as before, hitting /login,
//     /signup, /me, /sessions, /messages, /reflect, etc. (unchanged)
