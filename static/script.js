document.addEventListener("DOMContentLoaded", init);

const loginForm    = document.getElementById("login-form");
const signupForm   = document.getElementById("signup-form");
const authContainer = document.getElementById("auth-container");
const chatContainer = document.getElementById("chat-container");
const topNav        = document.getElementById("top-nav");
const inputBar      = document.getElementById("input-bar");
const chatWindow    = document.getElementById("chat-window");
const statusEl      = document.getElementById("status");
const userInput     = document.getElementById("user-input");

async function init() {
  // toggle between login/signup forms
  document.getElementById("show-signup").onclick = (e)=>{
    e.preventDefault();
    loginForm.classList.add("hidden");
    signupForm.classList.remove("hidden");
  };
  document.getElementById("show-login").onclick = (e)=>{
    e.preventDefault();
    signupForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
  };

  // form handlers
  loginForm.onsubmit = async e => {
    e.preventDefault();
    let u = document.getElementById("login-username").value,
        p = document.getElementById("login-password").value;
    let resp = await fetch("/login", {
      method: "POST",
      credentials: "include",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ username:u, password:p })
    });
    if (resp.ok) return afterAuth();
    alert("Invalid credentials");
  };

  signupForm.onsubmit = async e => {
    e.preventDefault();
    let u = document.getElementById("signup-username").value,
        p = document.getElementById("signup-password").value;
    let resp = await fetch("/signup", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ username:u, password:p })
    });
    if (resp.ok) return afterAuth();
    alert("Signup failed (username taken?)");
  };

  // nav buttons
  document.getElementById("logout-btn").onclick = async ()=> {
    await fetch("/logout", { method:"POST", credentials:"include" });
    window.location.reload();
  };
  document.getElementById("clear-btn").onclick = ()=>{
    chatWindow.innerHTML = "";
    statusEl.textContent = "New chat started.";
  };
  document.getElementById("new-chat-btn").onclick = ()=> {
    chatWindow.innerHTML = "";
    statusEl.textContent = "New chat started.";
  };

  // send message
  document.getElementById("send-btn").onclick = async ()=>{
    let txt = userInput.value.trim();
    if (!txt) return;
    appendMessage("You", txt);
    userInput.value = "";
    try {
      let res = await fetch("/reflect", {
        method:"POST",
        credentials:"include",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ prompt: txt, session_id: null })
      });
      let data = await res.json();
      for(let m of data.messages) {
        appendMessage("AI", m.content);
      }
    } catch {
      appendMessage("Error", "Could not send message.");
    }
  };

  // initial auth check
  let me = await fetch("/me", { credentials:"include" });
  if (me.status === 200) {
    afterAuth();
  } else {
    showAuth();
  }
}

function showAuth(){
  authContainer.classList.remove("hidden");
  topNav.classList.add("hidden");
  chatContainer.classList.add("hidden");
  inputBar.classList.add("hidden");
}

function afterAuth(){
  authContainer.classList.add("hidden");
  topNav.classList.remove("hidden");
  chatContainer.classList.remove("hidden");
  inputBar.classList.remove("hidden");
}

function appendMessage(who, text){
  let p = document.createElement("p");
  p.innerHTML = `<strong>${who}:</strong> ${text}`;
  chatWindow.append(p);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}
