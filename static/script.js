let currentSession = null;

async function api(path, opts={}) {
  let res = await fetch(path, { credentials: 'include', ...opts });
  if (res.status === 401) throw new Error('unauth');
  return res.json();
}

async function showLogin() {
  // fallback to your existing login/signup UI if you want...
  alert('Please log in first.');
}

async function loadSessions() {
  let list = document.getElementById('sessionList');
  list.innerHTML = '';
  let sessions = await api('/sessions');
  sessions.forEach(s => {
    let li = document.createElement('li');
    li.textContent = s.title;
    li.dataset.id = s.id;
    // delete icon
    let del = document.createElement('span');
    del.textContent = '🗑';
    del.style.cursor = 'pointer';
    del.onclick = async e => {
      e.stopPropagation();
      await api(`/sessions/${s.id}`, { method:'DELETE' });
      if (s.id === currentSession) currentSession = null;
      await loadSessions();
      if (!currentSession && sessions.length) selectSession(sessions[0].id);
    };
    li.appendChild(del);
    li.onclick = () => {
      selectSession(s.id);
      toggleDropdown();
    };
    list.appendChild(li);
  });
  // “+ New Chat…”
  let plus = document.createElement('li');
  plus.innerHTML = '<em>+ New Chat…</em>';
  plus.onclick = async () => {
    let title = prompt('Chat title?', 'New Chat');
    if (!title) return;
    let { id } = await api('/sessions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ title })
    });
    await loadSessions();
    selectSession(id);
    toggleDropdown();
  };
  list.appendChild(plus);
}

function toggleDropdown(){
  document.getElementById('sessionList').classList.toggle('hidden');
}

async function selectSession(id) {
  currentSession = id;
  document.getElementById('sessionBtn').textContent = 'Chat ▼';
  let msgs = await api(`/messages?session_id=${encodeURIComponent(id)}`);
  let container = document.getElementById('chatContainer');
  container.innerHTML = '';
  msgs.forEach(m => appendBubble(m.role, m.content));
  container.scrollTop = container.scrollHeight;
}

function appendBubble(role, text) {
  let div = document.createElement('div');
  div.className = 'bubble ' + (role==='assistant' ? 'ai' : 'you');
  div.textContent = text;
  document.getElementById('chatContainer').appendChild(div);
}

document.getElementById('sessionBtn').onclick = toggleDropdown;
document.getElementById('logoutBtn').onclick = async () => {
  await api('/logout',{method:'POST'});
  location.reload();
};
document.getElementById('clearBtn').onclick = async () => {
  if (!currentSession) return;
  await api(`/sessions/${currentSession}/messages`, { method:'DELETE' });
  document.getElementById('chatContainer').innerHTML = '';
};

document.getElementById('inputForm').onsubmit = async e => {
  e.preventDefault();
  let inp = document.getElementById('userInput');
  let txt = inp.value.trim();
  if (!txt || !currentSession) return;
  inp.value = '';
  appendBubble('you', txt);
  document.getElementById('chatContainer').scrollTop = document.getElementById('chatContainer').scrollHeight;
  let res = await api('/reflect', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ session_id: currentSession, prompt: txt })
  });
  res.messages.forEach(m => {
    appendBubble(m.role, m.content);
    document.getElementById('chatContainer').scrollTop = document.getElementById('chatContainer').scrollHeight;
  });
};

window.addEventListener('load', async () => {
  try {
    await api('/me');
  } catch {
    return showLogin();
  }
  await loadSessions();
  let sess = await api('/sessions');
  if (sess.length) selectSession(sess[0].id);
});
