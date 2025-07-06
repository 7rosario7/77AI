document.addEventListener("DOMContentLoaded", init);

let isSignup = false;

function init() {
  // UI refs
  const overlay    = document.getElementById("auth-screen");
  const form       = document.getElementById("auth-form");
  const title      = document.getElementById("auth-title");
  const submitBtn  = document.getElementById("auth-submit");
  const toggleText = document.getElementById("alt-action");
  const toggleBtn  = document.getElementById("toggle-btn");
  const loginBtn   = document.getElementById("login-btn");
  const signupBtn  = document.getElementById("signup-btn");
  const logoutBtn  = document.getElementById("logout-btn");
  const newChatBtn = document.getElementById("new-chat");

  // Chat refs
  const chatScreen   = document.getElementById("chat-screen");
  const messagesList = document.getElementById("messages");
  const msgForm      = document.getElementById("message-form");
  const msgInput     = document.getElementById("message-input");

  // show login form
  function showAuth() {
    overlay.style.display = "flex";
    title.textContent     = isSignup ? "Sign Up" : "Log In";
    submitBtn.textContent = isSignup ? "Create Account" : "Log In";
    toggleText.textContent= isSignup
      ? "Already have an account?"
      : "Don't have an account?";
    toggleBtn.textContent = isSignup ? "Log In" : "Sign Up";
  }

  // fetch /me
  async function fetchMe() {
    const resp = await fetch("/me", { credentials: "include" });
    if (resp.status === 401) {
      overlay.style.display = "flex";
      chatScreen.style.display = "none";
    } else {
      overlay.style.display = "none";
      chatScreen.style.display = "flex";
      loadHistory();
    }
  }

  // toggle login/signup mode
  toggleBtn.addEventListener("click", () => {
    isSignup = !isSignup;
    showAuth();
  });

  // form submit (login or signup)
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const u = form.username.value;
    const p = form.password.value;
    const url = isSignup ? "/signup" : "/login";
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p })
    });
    if (res.ok) {
      fetchMe();
    } else {
      alert("Authentication failed.");
    }
  });

  loginBtn.addEventListener("click", () => { isSignup = false; showAuth(); });
  signupBtn.addEventListener("click", () => { isSignup = true;  showAuth(); });
  logoutBtn.addEventListener("click", async () => {
    await fetch("/logout", { method: "POST", credentials: "include" });
    window.location.reload();
  });
  newChatBtn.addEventListener("click", () => {
    messagesList.innerHTML = "";
  });

  // send a new message
  msgForm.addEventListener("submit", async e => {
    e.preventDefault();
    const text = msgInput.value.trim();
    if (!text) return;
    appendMessage("user", text);
    msgInput.value = "";
    // call your chat endpoint…
    const resp = await fetch("/chat", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: text })
    });
    if (resp.ok) {
      const { reply } = await resp.json();
      appendMessage("bot", reply);
    } else {
      appendMessage("system", "❗ Error talking to server");
    }
  });

  // load previous session history
  async function loadHistory() {
    const resp = await fetch("/sessions", { credentials: "include" });
    if (resp.ok) {
      const sessions = await resp.json();
      // pick latest
      const last = sessions.slice(-1)[0]?.messages || [];
      messagesList.innerHTML = "";
      last.forEach(({ role, text }) => appendMessage(role, text));
    }
  }

  function appendMessage(role, text) {
    const li = document.createElement("li");
    li.className = role;
    li.textContent = text;
    messagesList.appendChild(li);
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  // kick things off
  fetchMe();
}
