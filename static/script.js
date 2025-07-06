document.addEventListener("DOMContentLoaded", init);

let isSignup = false;

function init() {
  // Header buttons
  const newChatBtn = document.getElementById("new-chat");
  const loginBtn   = document.getElementById("login-btn");
  const signupBtn  = document.getElementById("signup-btn");
  const logoutBtn  = document.getElementById("logout-btn");

  // Overlay auth
  const overlay    = document.getElementById("auth-screen");
  const form       = document.getElementById("auth-form");
  const title      = document.getElementById("auth-title");
  const submitBtn  = document.getElementById("auth-submit");
  const toggleText = document.getElementById("alt-action");
  const toggleBtn  = document.getElementById("toggle-btn");

  // Chat screen
  const chatScreen   = document.getElementById("chat-screen");
  const messagesList = document.getElementById("messages");
  const msgForm      = document.getElementById("message-form");
  const msgInput     = document.getElementById("message-input");

  // Show/hide header controls based on auth
  function updateHeader(isLoggedIn) {
    loginBtn.style.display   = isLoggedIn ? "none" : "inline-block";
    signupBtn.style.display  = isLoggedIn ? "none" : "inline-block";
    newChatBtn.style.display = isLoggedIn ? "inline-block" : "none";
    logoutBtn.style.display  = isLoggedIn ? "inline-block" : "none";
  }

  // Toggle between login / signup in overlay
  function showAuth() {
    overlay.style.display = "flex";
    title.textContent     = isSignup ? "Sign Up" : "Log In";
    submitBtn.textContent = isSignup ? "Create Account" : "Log In";
    toggleText.textContent= isSignup
      ? "Already have an account?"
      : "Don't have an account?";
    toggleBtn.textContent = isSignup ? "Log In" : "Sign Up";
  }

  // Fetch /me to see if we’re already logged in
  async function fetchMe() {
    const resp = await fetch("/me", { credentials: "include" });
    if (resp.status === 401) {
      // not logged in
      updateHeader(false);
      overlay.style.display = "flex";
      chatScreen.style.display = "none";
    } else {
      // got user
      updateHeader(true);
      overlay.style.display = "none";
      chatScreen.style.display = "flex";
      loadHistory();
    }
  }

  // Toggle button in overlay
  toggleBtn.addEventListener("click", () => {
    isSignup = !isSignup;
    showAuth();
  });

  // Login/signup form submit
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
      await fetchMe();
    } else {
      alert("Authentication failed");
    }
  });

  loginBtn.addEventListener("click", () => {
    isSignup = false;
    showAuth();
  });
  signupBtn.addEventListener("click", () => {
    isSignup = true;
    showAuth();
  });
  logoutBtn.addEventListener("click", async () => {
    await fetch("/logout", { method: "POST", credentials: "include" });
    window.location.reload();
  });
  newChatBtn.addEventListener("click", () => {
    messagesList.innerHTML = "";
  });

  // Send chat message
  msgForm.addEventListener("submit", async e => {
    e.preventDefault();
    const text = msgInput.value.trim();
    if (!text) return;
    appendMessage("user", text);
    msgInput.value = "";
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
      appendMessage("system", "❗ Server error");
    }
  });

  // Load your last session
  async function loadHistory() {
    const resp = await fetch("/sessions", { credentials: "include" });
    if (resp.ok) {
      const sessions = await resp.json();
      const last = sessions.slice(-1)[0]?.messages || [];
      messagesList.innerHTML = "";
      last.forEach(({ role, text }) => appendMessage(role, text));
    }
  }

  // Utility to append
  function appendMessage(role, text) {
    const li = document.createElement("li");
    li.className   = role;
    li.textContent = text;
    messagesList.appendChild(li);
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  // Kick it off
  fetchMe();
}
