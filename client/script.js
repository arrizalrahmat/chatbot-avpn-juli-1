const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const sessionList = document.getElementById('session-list');
const newChatBtn = document.getElementById('new-chat-btn');

const API_URL = 'http://localhost:3000/api/chat';
const SESSIONS_KEY = 'gemini-chat-sessions';
const ACTIVE_KEY = 'gemini-active-session';

// A session: { id, title, conversation: [{ role: 'user' | 'model', text }] }
// All sessions live in localStorage; `activeId` points at the open one.
let sessions = loadSessions();
let activeId = localStorage.getItem(ACTIVE_KEY);

// Make sure there's always a valid active session to render.
if (!sessions.length) {
  createSession();
} else if (!sessions.some((s) => s.id === activeId)) {
  activeId = sessions[0].id;
}

renderSessionList();
renderActiveConversation();

newChatBtn.addEventListener('click', () => {
  createSession();
  renderSessionList();
  renderActiveConversation();
  input.focus();
});

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  const session = getActiveSession();

  // Add the user's message to the context + UI, then persist.
  session.conversation.push({role: 'user', text: userMessage});
  appendMessage('user', userMessage);

  // Title a fresh session from its first message.
  if (session.conversation.filter((m) => m.role === 'user').length === 1) {
    session.title = deriveTitle(userMessage);
    renderSessionList();
  }
  saveSessions();

  input.value = '';
  input.focus();

  // Temporary "thinking" bubble while we wait for the API.
  const thinkingEl = appendMessage('bot', 'Gemini is thinking...');

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({conversation: session.conversation}),
    });

    if (!response.ok) throw new Error(`Request failed: ${response.status}`);

    const data = await response.json();
    const botText = data.output ?? 'Sorry, I could not generate a response.';

    thinkingEl.innerHTML = DOMPurify.sanitize(marked.parse(botText));
    session.conversation.push({role: 'model', text: botText});
    saveSessions();
  } catch (error) {
    console.error(error);
    thinkingEl.textContent = 'Oops! Something went wrong. Please try again.';
  } finally {
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});

// --- Session management -----------------------------------------------------

function createSession() {
  const session = {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: 'New Chat',
    conversation: [],
  };
  // Newest sessions sit at the top of the list.
  sessions.unshift(session);
  activeId = session.id;
  saveSessions();
}

function switchSession(id) {
  if (id === activeId) return;
  activeId = id;
  localStorage.setItem(ACTIVE_KEY, activeId);
  renderSessionList();
  renderActiveConversation();
}

function deleteSession(id) {
  sessions = sessions.filter((s) => s.id !== id);
  if (!sessions.length) {
    createSession();
  } else if (id === activeId) {
    activeId = sessions[0].id;
  }
  saveSessions();
  renderSessionList();
  renderActiveConversation();
}

function getActiveSession() {
  return sessions.find((s) => s.id === activeId);
}

function deriveTitle(text) {
  const trimmed = text.trim();
  return trimmed.length > 30 ? `${trimmed.slice(0, 30)}…` : trimmed;
}

// --- Rendering --------------------------------------------------------------

function renderSessionList() {
  sessionList.innerHTML = '';

  sessions.forEach((session) => {
    const item = document.createElement('div');
    item.className = 'session-item' + (session.id === activeId ? ' active' : '');

    const title = document.createElement('span');
    title.className = 'session-title';
    title.textContent = session.title;
    title.addEventListener('click', () => switchSession(session.id));

    const del = document.createElement('button');
    del.className = 'session-delete';
    del.textContent = '×';
    del.title = 'Delete chat';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSession(session.id);
    });

    item.appendChild(title);
    item.appendChild(del);
    sessionList.appendChild(item);
  });
}

function renderActiveConversation() {
  chatBox.innerHTML = '';
  const session = getActiveSession();
  session.conversation.forEach(({role, text}) => appendMessage(role, text));
}

function appendMessage(sender, text) {
  // 'model' is the Gemini role; render it with the bot styling.
  const cssRole = sender === 'model' ? 'bot' : sender;

  // Row wrapper keeps each bubble on its own line.
  const row = document.createElement('div');
  row.classList.add('message-row', cssRole);

  const msg = document.createElement('div');
  msg.classList.add('message', cssRole);

  if (cssRole === 'bot') {
    // Gemini replies in markdown — render it, sanitized to prevent XSS.
    msg.innerHTML = DOMPurify.sanitize(marked.parse(text));
  } else {
    // Keep user input as plain text so it can never inject HTML.
    msg.textContent = text;
  }

  row.appendChild(msg);
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;

  return msg;
}

// --- Persistence ------------------------------------------------------------

function loadSessions() {
  try {
    const stored = localStorage.getItem(SESSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load sessions from storage', error);
    return [];
  }
}

function saveSessions() {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  localStorage.setItem(ACTIVE_KEY, activeId);
}
