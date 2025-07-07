document.addEventListener('DOMContentLoaded', init);

let currentSession = null;

async function init() {
  // DOM refs
  const loginTop = document.getElementById('login-top');
  const signupTop = document.getElementById('signup-top');
  const newChatBtn = document.getElementById('new-chat-btn');
  const clearBtn = document.getElementById('clear-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const authButtons = document.getElementById('auth-buttons');
  const sessionControls = document.getElementById('session-controls');
  const chatContainer = document.getElementById('chat-container');
  const authContainer = document.getElementById('auth-container');
  const loginBox = document.getElementById('login-box');
  const signupBox = document.getElementById('signup-box');
  const showSignup = document.getElementById('show-signup');
  const showLogin = document.getElementById('show-login');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const messageForm = document.getElementById('message-form');
  const messageInput = document.getElementById('message-input');

  // click handlers
  loginTop.onclick = () => showForm('login');
  signupTop.onclick = () => showForm('signup');
  showSignup.onclick = e => { e.preventDefault(); showForm('signup'); };
  showLogin.onclick = e => { e.preventDefault(); showForm('login'); };
  newChatBtn.onclick = () => startNewSession();
  clearBtn.onclick = () => clearCurrentSession();
  logoutBtn.onclick = () => logout();

  loginForm.onsubmit = async e => {
    e.preventDefault();
    await auth('/login', {
      username: document.getElementById('login-user').value,
      password: document.getElementById('login-pass').value
    });
  };
  signupForm.onsubmit = async e => {
    e.preventDefault();
    await auth('/signup', {
      username: document.getElementById('signup-user').value,
      password: document.getElementById('signup-pass').value
    });
  };
  messageForm.onsubmit = async e => {
    e.preventDefault();
    const prompt = messageInput.value.trim();
    if (!prompt || !currentSession) return;
    appendMessage('user', prompt);
    messageInput.value = '';
    try {
      const resp = await fetch('/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSession, prompt })
      });
      const data = await resp.json();
      data.messages.forEach(m => appendMessage(m.role, m.content));
    } catch {
      appendMessage('assistant', 'Error sending message');
    }
  };

  // initial check
  const me = await fetch('/me', { credentials: 'include' });
  if (me.status === 200) {
    afterAuth();
  } else {
    showForm('login');
  }

  // --- helper fns ---
  function showForm(which) {
    loginBox.classList.toggle('hidden', which !== 'login');
    signupBox.classList.toggle('hidden', which !== 'signup');
    chatContainer.classList.add('hidden');
    sessionControls.classList.add('hidden');
    newChatBtn.classList.add('hidden');
    authButtons.classList.remove('hidden');
    authContainer.classList.remove('hidden');
  }

  async function auth(url, body) {
    const resp = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (resp.ok) {
      afterAuth();
    } else {
      alert('Auth failed');
    }
  }

  async function afterAuth() {
    authButtons.classList.add('hidden');
    authContainer.classList.add('hidden');
    sessionControls.classList.remove('hidden');
    newChatBtn.classList.remove('hidden');
    chatContainer.classList.remove('hidden');
    await startNewSession();
  }

  async function logout() {
    await fetch('/logout', { method: 'POST', credentials: 'include' });
    window.location.reload();
  }

  async function startNewSession() {
    const resp = await fetch('/sessions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const sess = await resp.json();
    currentSession = sess.id;
    document.getElementById('chat-window').innerHTML = '<p class="message assistant">New chat started.</p>';
  }

  async function clearCurrentSession() {
    if (!currentSession) return;
    await fetch(`/sessions/${currentSession}/messages`, {
      method: 'DELETE',
      credentials: 'include'
    });
    document.getElementById('chat-window').innerHTML = '';
  }

  function appendMessage(role, text) {
    const win = document.getElementById('chat-window');
    const p = document.createElement('p');
    p.className = `message ${role}`;
    p.textContent = (role === 'user' ? 'You: ' : '') + text;
    win.appendChild(p);
    win.scrollTop = win.scrollHeight;
  }
}
