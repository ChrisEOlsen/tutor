import { get, post } from '/static/js/lib/api.js';
import { renderMarkdown } from '/static/js/lib/markdown.js';

const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');
const outlineSection = document.getElementById('outline-section');
const outlinePanel = document.getElementById('outline-panel');

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
  bubble.className = `max-w-[80%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
    role === 'user'
      ? 'bg-blue-600 text-white'
      : 'bg-white/5 text-slate-200 border border-white/10'
  }`;

  if (role === 'user') {
    // User messages are plain text — safe textContent
    bubble.textContent = content;
  } else {
    // Assistant messages rendered as markdown — safe DOM nodes, no innerHTML with user data
    bubble.appendChild(renderMarkdown(content));
  }

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
  outlinePanel.classList.remove('hidden');
  outlinePanel.classList.add('flex');

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

  // Auto-start conversation if chat history is empty
  if (messages.length === 0 && course.title) {
    chatInput.value = course.title;
    sendMessage();
    return;
  }

  // If outline already exists, show it
  if (course.outline && course.outline !== '[]') {
    try {
      const outline = JSON.parse(course.outline);
      if (outline.length > 0) {
        outlineGenerated = true;
        chatForm.style.display = 'none';
        renderOutline(outline);

        // If course is actively generating, show progress and resume polling
        if (course.status === 'generating') {
          const genBtn = document.getElementById('generate-course-btn');
          if (genBtn) {
            genBtn.disabled = true;
            genBtn.textContent = 'Generating...';
          }
          renderProgressUI(outline);
          startPolling();
          return;
        }

        // If chapters already generated, redirect to study (only if all chapters exist)
        if (course.chapters && course.chapters !== '[]') {
          const chapters = JSON.parse(course.chapters);
          const allComplete = chapters.length === outline.length && chapters.every(ch => ch !== null);
          if (allComplete) {
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

let pollInterval = null;

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(pollGenerationStatus, 2500);
  pollGenerationStatus(); // immediate first poll
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function pollGenerationStatus() {
  const res = await get(`/api/courses/${courseId}/generation_status`);
  if (!res.ok) return;
  updateProgressUI(res.data);

  if (res.data.status === 'active') {
    stopPolling();
    const progressLabel = document.getElementById('progress-label');
    if (progressLabel) {
      progressLabel.textContent = 'Course generated! Redirecting...';
      progressLabel.className = 'text-xs text-emerald-400 mt-2';
    }
    setTimeout(() => {
      window.location.href = `/static/pages/study.html?id=${courseId}&chapter=0`;
    }, 800);
  } else if (res.data.generation_error) {
    stopPolling();
    const progressLabel = document.getElementById('progress-label');
    if (progressLabel) {
      progressLabel.textContent = `Failed: ${res.data.generation_error}`;
      progressLabel.className = 'text-xs text-red-400 mt-2';
    }
    const btn = document.getElementById('generate-course-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Retry'; }
  }
}

function renderProgressUI(outline) {
  // Remove existing progress UI if present
  const existing = document.getElementById('progress-timeline');
  if (existing) existing.remove();

  const progressContainer = document.createElement('div');
  progressContainer.id = 'progress-timeline';
  progressContainer.className = 'space-y-2 mt-4';

  const progressBarOuter = document.createElement('div');
  progressBarOuter.className = 'w-full bg-white/10 rounded-full h-1.5';
  const progressBarInner = document.createElement('div');
  progressBarInner.id = 'progress-bar';
  progressBarInner.className = 'bg-blue-500 h-1.5 rounded-full transition-all duration-500';
  progressBarInner.style.width = '0%';
  progressBarOuter.appendChild(progressBarInner);

  const progressLabel = document.createElement('p');
  progressLabel.id = 'progress-label';
  progressLabel.className = 'text-xs text-slate-400 mt-2';
  progressLabel.textContent = `Resuming generation progress... (${outline.length} chapters)`;

  progressContainer.append(progressBarOuter, progressLabel);
  outlineSection.appendChild(progressContainer);
}

function updateProgressUI(data) {
  // Ensure progress UI exists
  let progressBar = document.getElementById('progress-bar');
  let progressLabel = document.getElementById('progress-label');
  let progressContainer = document.getElementById('progress-timeline');

  if (!progressBar || !progressLabel || !progressContainer) return;

  const pct = data.total_chapters > 0 ? (data.completed_chapters / data.total_chapters) * 100 : 0;
  progressBar.style.width = `${pct}%`;

  if (data.generation_error) {
    progressLabel.textContent = `Failed: ${data.generation_error}`;
    progressLabel.className = 'text-xs text-red-400 mt-2';
  } else {
    progressLabel.textContent = `Generating chapter ${data.completed_chapters + 1}/${data.total_chapters}...`;
    progressLabel.className = 'text-xs text-slate-400 mt-2';
  }
}

async function generateCourse() {
  const btn = document.getElementById('generate-course-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Starting...';
  }

  // Fire-and-forget: start background generation
  const res = await post(`/api/courses/${courseId}/generate_all`, {});
  if (!res.ok) {
    if (btn) { btn.disabled = false; btn.textContent = 'Generate Course'; }
    return;
  }

  // Fetch outline for progress UI
  const courseRes = await get(`/api/courses/${courseId}`);
  let outline = [];
  if (courseRes.ok) {
    try { outline = JSON.parse(courseRes.data.outline || '[]'); } catch (e) {}
  }

  if (btn) {
    btn.textContent = 'Generating...';
  }

  // Build progress timeline
  const progressContainer = document.createElement('div');
  progressContainer.id = 'progress-timeline';
  progressContainer.className = 'space-y-2 mt-4';

  const progressBarOuter = document.createElement('div');
  progressBarOuter.className = 'w-full bg-white/10 rounded-full h-1.5';
  const progressBarInner = document.createElement('div');
  progressBarInner.id = 'progress-bar';
  progressBarInner.className = 'bg-blue-500 h-1.5 rounded-full transition-all duration-500';
  progressBarInner.style.width = '0%';
  progressBarOuter.appendChild(progressBarInner);

  const progressLabel = document.createElement('p');
  progressLabel.id = 'progress-label';
  progressLabel.className = 'text-xs text-slate-400 mt-2';
  progressLabel.textContent = `Starting generation...`;

  progressContainer.append(progressBarOuter, progressLabel);
  outlineSection.appendChild(progressContainer);

  // Start polling
  startPolling();
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
