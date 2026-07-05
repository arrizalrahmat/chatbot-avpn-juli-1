// Floating e-legal chatbot widget — styled to match the landing page.
(function () {
  const toggleBtn = document.getElementById('chat-toggle');
  const toggleIcon = document.getElementById('chat-toggle-icon');
  const panel = document.getElementById('chat-panel');
  const closeBtn = document.getElementById('chat-close-btn');
  const newBtn = document.getElementById('chat-new-btn');
  const sessionsBtn = document.getElementById('chat-sessions-btn');
  const sessionsView = document.getElementById('chat-sessions');
  const sessionList = document.getElementById('session-list');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('user-input');
  const chatBox = document.getElementById('chat-box');

  const API_URL = 'http://localhost:3000/api/chat';
  const SESSIONS_KEY = 'gemini-chat-sessions';
  const ACTIVE_KEY = 'gemini-active-session';
  const WELCOME =
    "Hi! I'm the e-legal AI assistant. Ask me about our AI law consultation, corporate, IP, or litigation services.";

  // A session: { id, title, conversation: [{ role: 'user' | 'model', text }] }
  let sessions = loadSessions();
  let activeId = localStorage.getItem(ACTIVE_KEY);

  if (!sessions.length) {
    createSession();
  } else if (!sessions.some((s) => s.id === activeId)) {
    activeId = sessions[0].id;
  }

  renderSessionList();
  renderActiveConversation();

  // --- Panel open/close -----------------------------------------------------

  function openPanel() {
    panel.classList.remove('hidden');
    toggleIcon.className = 'ph-fill ph-x text-3xl';
    showMessages();
    input.focus();
  }

  function closePanel() {
    panel.classList.add('hidden');
    toggleIcon.className = 'ph-fill ph-chat-teardrop-dots text-3xl';
  }

  toggleBtn.addEventListener('click', () => {
    if (panel.classList.contains('hidden')) openPanel();
    else closePanel();
  });
  closeBtn.addEventListener('click', closePanel);

  function showMessages() {
    sessionsView.classList.add('hidden');
  }
  function showSessions() {
    renderSessionList();
    sessionsView.classList.remove('hidden');
  }
  sessionsBtn.addEventListener('click', () => {
    if (sessionsView.classList.contains('hidden')) showSessions();
    else showMessages();
  });

  newBtn.addEventListener('click', () => {
    createSession();
    renderSessionList();
    renderActiveConversation();
    showMessages();
    input.focus();
  });

  // --- Send message ---------------------------------------------------------

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const userMessage = input.value.trim();
    if (!userMessage) return;

    const session = getActiveSession();

    session.conversation.push({role: 'user', text: userMessage});
    appendMessage('user', userMessage);

    // Title a fresh session from its first message.
    if (session.conversation.filter((m) => m.role === 'user').length === 1) {
      session.title = deriveTitle(userMessage);
    }
    saveSessions();

    input.value = '';
    input.focus();

    const thinkingEl = appendMessage('bot', '');
    thinkingEl.innerHTML =
      '<span class="inline-flex gap-1 items-center text-gray-400"><i class="ph ph-circle-notch animate-spin"></i> Thinking...</span>';

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
      thinkingEl.textContent =
        'Oops! Something went wrong. Please make sure the server is running and try again.';
    } finally {
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  });

  // --- Session management ----------------------------------------------------

  function createSession() {
    const session = {
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: 'New Chat',
      conversation: [],
    };
    sessions.unshift(session);
    activeId = session.id;
    saveSessions();
  }

  function switchSession(id) {
    if (id === activeId) return;
    activeId = id;
    localStorage.setItem(ACTIVE_KEY, activeId);
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

  // --- Rendering -------------------------------------------------------------

  function renderSessionList() {
    sessionList.innerHTML = '';

    sessions.forEach((session) => {
      const item = document.createElement('div');
      item.className =
        'group flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ' +
        (session.id === activeId
          ? 'bg-brand-primary/30 border border-brand-secondary/30'
          : 'hover:bg-white/5 border border-transparent');

      const title = document.createElement('span');
      title.className = 'flex-1 truncate text-sm text-gray-200';
      title.textContent = session.title;
      title.addEventListener('click', () => {
        switchSession(session.id);
        renderSessionList();
        showMessages();
      });

      const del = document.createElement('button');
      del.className =
        'text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0';
      del.title = 'Delete chat';
      del.innerHTML = '<i class="ph ph-trash text-base"></i>';
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

    if (!session.conversation.length) {
      appendMessage('bot', WELCOME);
      return;
    }
    session.conversation.forEach(({role, text}) => appendMessage(role, text));
  }

  function appendMessage(sender, text) {
    const cssRole = sender === 'model' ? 'bot' : sender;

    const row = document.createElement('div');
    row.className =
      'flex ' + (cssRole === 'user' ? 'justify-end' : 'justify-start');

    const msg = document.createElement('div');

    if (cssRole === 'bot') {
      msg.className =
        'chat-markdown max-w-[85%] rounded-2xl rounded-tl-sm bg-brand-card border border-white/10 text-gray-200 px-4 py-2.5 text-sm leading-relaxed';
      // Gemini replies in markdown — render it, sanitized to prevent XSS.
      msg.innerHTML = DOMPurify.sanitize(marked.parse(text));
    } else {
      msg.className =
        'max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-secondary text-brand-dark px-4 py-2.5 text-sm leading-relaxed font-medium whitespace-pre-wrap break-words';
      // Keep user input as plain text so it can never inject HTML.
      msg.textContent = text;
    }

    row.appendChild(msg);
    chatBox.appendChild(row);
    chatBox.scrollTop = chatBox.scrollHeight;

    return msg;
  }

  // --- Persistence -----------------------------------------------------------

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
})();
