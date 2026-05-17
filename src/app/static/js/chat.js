import { get, post } from '/static/js/lib/api.js';

const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');
const outlineSection = document.getElementById('outline-section');

const params = new URLSearchParams(window.location.search);
const courseId = params.get('id');

if (!courseId) {
  chatMessages.textContent = 'No course selected.';
  chatForm.style.display = 'none';
}

let outlineGenerated = false;

function showTyping(show) {
  typingIndicator.classList.toggle('hidden', !show);
}

function createMessageBubble(role, content) {
  const div = document.createElement('div');
  div.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;

  const bubble = document.createElement('div');
  bubble.className = `max-w-[80%] rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
    role === 'user'
      ? 'bg-blue-600 text-white'
      : 'bg-white/5 text-slate-200 border border-white/10'
  }`;

  // Safe text rendering — never innerHTML
  bubble.textContent = content;

  div.appendChild(bubble);
  return div;
}

function renderMessages(messages) {
  chatMessages.replaceChildren();
  if (!messages || messages.length === 0) return;
  messages.forEach(m => {
    if (m.role && m.content) {
      chatMessages.appendChild(createMessageBubble(m.role, m.content));
    }
  });
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderOutline(outline) {
  outlineSection.replaceChildren();
  outlineSection.classList.remove('hidden');

  const h2 = document.createElement('h2');
  h2.className = 'text-lg font-semibold text-white mb-3';
  h2.textContent = 'Course Outline';

  const list = document.createElement('ol');
  list.className = 'space-y-2 mb-4';
  outline.forEach((title, i) => {
    const li = document.createElement('li');
    li.className = 'flex items-start gap-3 bg-white/5 border border-white/10 rounded-lg px-4 py-3';
    const num = document.createElement('span');
    num.className = 'flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-medium';
    num.textContent = String(i + 1);
    const text = document.createElement('span');
    text.className = 'text-sm text-slate-200';
    text.textContent = title;
    li.append(num, text);
    list.appendChild(li);
  });

  const btn = document.createElement('button');
  btn.id = 'generate-course-btn';
  btn.className = 'w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50';
  btn.textContent = 'Generate Course';
  btn.addEventListener('click', generateCourse);

  outlineSection.append(h2, list, btn);
}

async function loadChat() {
  const res = await get(`/api/courses/${courseId}`);
  if (!res.ok) {
    chatMessages.textContent = 'Failed to load course.';
    return;
  }
  const course = res.data;
  let messages = [];
  try {
    messages = JSON.parse(course.chat_history || '[]');
  } catch (e) {
    // ignore parse errors
  }
  renderMessages(messages);

  // If outline already exists, show it
  if (course.outline && course.outline !== '[]') {
    try {
      const outline = JSON.parse(course.outline);
      if (outline.length > 0) {
        outlineGenerated = true;
        chatForm.style.display = 'none';
        renderOutline(outline);
        // If chapters already generated, redirect to study
        if (course.chapters && course.chapters !== '[]') {
          const chapters = JSON.parse(course.chapters);
          if (chapters.length > 0) {
            window.location.href = `/static/pages/study.html?id=${courseId}&chapter=0`;
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';
  chatMessages.appendChild(createMessageBubble('user', text));

  showTyping(true);
  sendBtn.disabled = true;

  const res = await post(`/api/courses/${courseId}/chat`, { message: text });

  showTyping(false);
  sendBtn.disabled = false;

  if (res.ok && res.data) {
    const aiResponse = res.data.response || '';
    chatMessages.appendChild(createMessageBubble('assistant', aiResponse));

    // Check if AI wants to generate outline
    if (aiResponse.includes('GENERATE_OUTLINE')) {
      outlineGenerated = true;
      chatForm.style.display = 'none';
      const genBtn = document.createElement('button');
      genBtn.id = 'generate-outline-btn';
      genBtn.className = 'mx-auto block px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors mt-4';
      genBtn.textContent = 'Generate Outline →';
      genBtn.addEventListener('click', generateOutline);

      const container = document.createElement('div');
      container.appendChild(genBtn);
      chatMessages.appendChild(container);
    }
  } else {
    const errEl = document.createElement('div');
    errEl.className = 'flex justify-start';
    const errBubble = document.createElement('div');
    errBubble.className = 'bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300';
    errBubble.textContent = res.error || 'Failed to get response.';
    errEl.appendChild(errBubble);
    chatMessages.appendChild(errEl);
  }

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function generateOutline() {
  const btn = document.getElementById('generate-outline-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Generating...';
  }
  showTyping(true);

  const res = await post(`/api/courses/${courseId}/generate_outline`, {});

  showTyping(false);

  if (res.ok && res.data && res.data.outline) {
    renderOutline(res.data.outline);
  } else {
    const errEl = document.createElement('p');
    errEl.className = 'text-sm text-red-400 mt-2';
    errEl.textContent = res.error || 'Failed to generate outline.';
    chatMessages.appendChild(errEl);
  }
}

async function generateCourse() {
  const btn = document.getElementById('generate-course-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Generating Course...';
  }

  const res = await post(`/api/courses/${courseId}/generate_all`, {});

  if (res.ok) {
    window.location.href = `/static/pages/study.html?id=${courseId}&chapter=0`;
  } else {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Generate Course';
    }
    const errEl = document.createElement('p');
    errEl.className = 'text-sm text-red-400 mt-2';
    errEl.textContent = res.error || 'Failed to generate course.';
    outlineSection.appendChild(errEl);
  }
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage();
});

// Auto-resize textarea
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});

if (courseId) loadChat();
