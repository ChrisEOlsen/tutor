import { get, post } from '/static/js/lib/api.js';
import { renderSection } from '/static/js/lib/sections.js';

const chapterNav = document.getElementById('chapter-nav');
const chapterContent = document.getElementById('chapter-content');
const testSection = document.getElementById('test-section');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const askBtn = document.getElementById('ask-btn');
const askPanel = document.getElementById('ask-panel');

const params = new URLSearchParams(window.location.search);
const courseId = params.get('id');
let chapterIndex = parseInt(params.get('chapter') || '0', 10);

let course = null;
let chapters = [];
let outline = [];
let testResults = {};

if (!courseId) {
  chapterContent.textContent = 'No course selected.';
}

async function loadCourse() {
  const res = await get(`/api/courses/${courseId}`);
  if (!res.ok) {
    chapterContent.textContent = 'Failed to load course.';
    return;
  }
  course = res.data;
  try { chapters = JSON.parse(course.chapters || '[]'); } catch (e) { chapters = []; }
  try { outline = JSON.parse(course.outline || '[]'); } catch (e) { outline = []; }
  try { testResults = JSON.parse(course.test_results || '{}'); } catch (e) { testResults = {}; }

  renderNav();
  renderChapter();
}

function renderNav() {
  chapterNav.replaceChildren();

  // Progress summary
  const completedCount = outline.filter((_, i) => testResults[String(i)]).length;
  const totalCount = outline.length;

  const progressDiv = document.createElement('div');
  progressDiv.className = 'mb-4';

  const h2 = document.createElement('h2');
  h2.className = 'text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2';
  h2.textContent = 'Chapters';

  const progressText = document.createElement('p');
  progressText.className = 'text-xs text-slate-500';
  progressText.textContent = `${completedCount}/${totalCount} completed`;
  progressDiv.append(h2, progressText);

  // Progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'w-full h-1 bg-white/5 rounded-full overflow-hidden mt-2';
  const progressFill = document.createElement('div');
  progressFill.className = 'h-full bg-emerald-500/60 rounded-full transition-all';
  progressFill.style.width = totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%';
  progressBar.appendChild(progressFill);
  progressDiv.appendChild(progressBar);

  const ul = document.createElement('ul');
  ul.className = 'space-y-1 mt-4';

  outline.forEach((title, i) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `/static/pages/study.html?id=${courseId}&chapter=${i}`;

    const isCompleted = !!testResults[String(i)];
    const isActive = i === chapterIndex;

    const innerDiv = document.createElement('div');
    innerDiv.className = 'flex items-center gap-2';

    // Status indicator
    const indicator = document.createElement('span');
    indicator.className = 'flex-shrink-0 w-4 h-4 flex items-center justify-center';
    if (isCompleted) {
      indicator.className += ' text-emerald-400';
      indicator.textContent = '✓';
    } else {
      indicator.className += ' text-slate-600';
      indicator.textContent = '○';
    }

    const textSpan = document.createElement('span');
    textSpan.className = 'block text-sm';
    textSpan.textContent = `${i + 1}. ${title}`;

    innerDiv.append(indicator, textSpan);

    // Score badge if completed
    if (isCompleted) {
      const result = testResults[String(i)];
      const score = result.score;
      if (score !== undefined && score !== null) {
        const badge = document.createElement('span');
        badge.className = 'flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium';
        if (score >= 70) {
          badge.className += ' bg-emerald-500/15 text-emerald-400';
        } else {
          badge.className += ' bg-amber-500/15 text-amber-400';
        }
        badge.textContent = `${score}%`;
        innerDiv.appendChild(badge);
      }
    }

    a.className = `block px-3 py-2 rounded transition-colors ${
      isActive
        ? isCompleted
          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
          : 'bg-white/10 text-white'
        : isCompleted
          ? 'text-emerald-300/80 hover:text-emerald-300 hover:bg-white/5'
          : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`;
    a.appendChild(innerDiv);
    li.appendChild(a);
    ul.appendChild(li);
  });

  chapterNav.append(progressDiv, ul);
}

function renderChapter() {
  chapterContent.replaceChildren();
  testSection.classList.add('hidden');

  if (chapterIndex >= chapters.length || !chapters[chapterIndex]) {
    chapterContent.textContent = 'Chapter not available.';
    updateNavButtons();
    return;
  }

  const chapter = chapters[chapterIndex];
  const saved = testResults[String(chapterIndex)];

  // Completion banner
  if (saved && saved.score !== undefined) {
    const banner = document.createElement('div');
    banner.className = 'rounded-lg px-4 py-3 mb-6 flex items-center gap-3';
    if (saved.score >= 70) {
      banner.className += ' bg-emerald-500/10 border border-emerald-500/20';
    } else {
      banner.className += ' bg-amber-500/10 border border-amber-500/20';
    }
    const bannerIcon = document.createElement('span');
    bannerIcon.className = 'text-lg';
    bannerIcon.textContent = saved.score >= 70 ? '✓' : '⚠';
    const bannerText = document.createElement('div');
    const bannerTitle = document.createElement('p');
    bannerTitle.className = 'text-sm font-medium text-white';
    bannerTitle.textContent = saved.score >= 70 ? 'Chapter Complete' : 'Chapter Test Submitted';
    const bannerScore = document.createElement('p');
    bannerScore.className = 'text-xs text-[#c9d1d9] mt-0.5';
    bannerScore.textContent = `Score: ${saved.score}/100${saved.feedback ? ' — ' + saved.feedback : ''}`;
    bannerText.append(bannerTitle, bannerScore);
    banner.append(bannerIcon, bannerText);
    chapterContent.appendChild(banner);
  }

  // Chapter title
  const h1 = document.createElement('h1');
  h1.className = 'text-xl font-semibold text-white mb-6';
  h1.textContent = chapter.title || outline[chapterIndex] || `Chapter ${chapterIndex + 1}`;
  chapterContent.appendChild(h1);

  // Sections
  const sections = chapter.sections || [];
  sections.forEach(s => {
    chapterContent.appendChild(renderSection(s));
  });

  // Test section
  if (chapter.test && chapter.test.questions && chapter.test.questions.length > 0) {
    renderTest(chapter.test);
  }

  updateNavButtons();
}

function updateNavButtons() {
  prevBtn.disabled = chapterIndex <= 0;
  nextBtn.disabled = chapterIndex >= chapters.length - 1;
}

function renderTest(test) {
  testSection.classList.remove('hidden');
  testSection.replaceChildren();

  const h2 = document.createElement('h2');
  h2.className = 'text-lg font-semibold text-white mb-4';
  h2.textContent = 'Chapter Test';

  // Show existing results if available
  const saved = testResults[String(chapterIndex)];
  const savedQuestions = saved && saved.questions ? saved.questions : [];
  const hasResults = savedQuestions.length > 0;

  if (hasResults) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'bg-white/5 border border-white/10 rounded-lg p-4 mb-4';
    const score = document.createElement('p');
    score.className = 'text-sm text-white font-medium';
    score.textContent = `Score: ${saved.score}/100`;
    const feedback = document.createElement('p');
    feedback.className = 'text-sm text-[#c9d1d9] mt-1';
    feedback.textContent = saved.feedback || '';
    resultDiv.append(score, feedback);
    testSection.appendChild(resultDiv);
  }

  const questions = test.questions || [];
  questions.forEach((q, i) => {
    const div = document.createElement('div');
    div.className = 'bg-white/5 border border-white/10 rounded-lg p-4 mb-3';
    div.id = `test-q-${i}`;

    const qNum = document.createElement('p');
    qNum.className = 'text-xs text-slate-400 mb-1';
    qNum.textContent = `Question ${i + 1} (${q.type.replace('_', ' ')})`;

    const qText = document.createElement('p');
    qText.className = 'text-sm font-medium text-white mb-3';
    qText.textContent = q.question;

    // Restore saved answer and result for this question
    const savedQ = savedQuestions[i];
    const savedAnswer = savedQ ? savedQ.answer : '';
    const savedScore = savedQ ? savedQ.score : null;
    const savedFeedback = savedQ ? savedQ.feedback : '';

    if (q.type === 'multiple_choice') {
      div.append(qNum, qText);
      q.options.forEach((opt, j) => {
        const label = document.createElement('label');
        label.className = 'flex items-center gap-2 text-sm text-[#c9d1d9] cursor-pointer hover:text-white transition-colors mb-1';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `test-answer-${i}`;
        radio.value = String(j);
        radio.className = 'accent-blue-500';
        if (hasResults && String(j) === savedAnswer) {
          radio.checked = true;
        }
        radio.disabled = hasResults;
        const span = document.createElement('span');
        span.textContent = opt;
        label.append(radio, span);
        div.appendChild(label);
      });
    } else if (q.type === 'written') {
      const ta = document.createElement('textarea');
      ta.name = `test-answer-${i}`;
      ta.rows = 4;
      ta.className = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none';
      ta.placeholder = 'Write your answer...';
      ta.value = savedAnswer;
      ta.disabled = hasResults;
      div.append(qNum, qText, ta);
    } else if (q.type === 'code') {
      const ta = document.createElement('textarea');
      ta.name = `test-answer-${i}`;
      ta.rows = 6;
      ta.className = 'w-full bg-[#161b22] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono resize-none';
      ta.placeholder = 'Write your code...';
      ta.value = savedAnswer;
      ta.disabled = hasResults;
      div.append(qNum, qText, ta);
    }

    // Show per-question result if available
    if (savedScore !== null) {
      const resultDiv = document.createElement('div');
      resultDiv.className = 'mt-3 pt-3 border-t border-white/5';
      const scoreP = document.createElement('p');
      scoreP.className = 'text-sm font-medium text-white';
      scoreP.textContent = `Score: ${savedScore}/100`;
      const feedbackP = document.createElement('p');
      feedbackP.className = 'text-sm text-[#c9d1d9] mt-1';
      feedbackP.textContent = savedFeedback || '';
      resultDiv.append(scoreP, feedbackP);
      div.appendChild(resultDiv);
    }

    testSection.appendChild(div);
  });

  // Only show submit button if test hasn't been graded yet
  if (!hasResults) {
    const submitBtn = document.createElement('button');
    submitBtn.id = 'submit-test-btn';
    submitBtn.className = 'w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 mt-4';
    submitBtn.textContent = 'Submit Test';
    submitBtn.addEventListener('click', submitTest);
    testSection.appendChild(submitBtn);
  }
}

async function submitTest() {
  const btn = document.getElementById('submit-test-btn');
  btn.disabled = true;
  btn.textContent = 'Grading...';

  const test = chapters[chapterIndex].test;
  const questions = test.questions || [];
  const answers = [];

  questions.forEach((q, i) => {
    if (q.type === 'multiple_choice') {
      const selected = document.querySelector(`input[name="test-answer-${i}"]:checked`);
      answers.push({ questionIndex: i, type: q.type, answer: selected ? selected.value : '' });
    } else {
      const ta = document.querySelector(`[name="test-answer-${i}"]`);
      answers.push({ questionIndex: i, type: q.type, answer: ta ? ta.value : '' });
    }
  });

  const res = await post(`/api/courses/${courseId}/test/${chapterIndex}`, { answers });

  if (res.ok && res.data) {
    const results = res.data.results || [];
    testSection.replaceChildren();

    const h2 = document.createElement('h2');
    h2.className = 'text-lg font-semibold text-white mb-4';
    h2.textContent = 'Test Results';

    results.forEach(r => {
      const div = document.createElement('div');
      div.className = 'bg-white/5 border border-white/10 rounded-lg p-4 mb-3';

      const score = document.createElement('p');
      score.className = 'text-sm font-medium text-white';
      score.textContent = `Score: ${r.score}/100`;

      const feedback = document.createElement('p');
      feedback.className = 'text-sm text-[#c9d1d9] mt-1';
      feedback.textContent = r.feedback || '';

      div.append(score, feedback);
      testSection.appendChild(div);
    });

    testSection.insertBefore(h2, testSection.firstChild);
  } else {
    btn.disabled = false;
    btn.textContent = 'Submit Test';
    const errEl = document.createElement('p');
    errEl.className = 'text-sm text-red-400 mt-2';
    errEl.textContent = res.error || 'Failed to grade test.';
    testSection.appendChild(errEl);
  }
}

// Navigation
prevBtn.addEventListener('click', () => {
  if (chapterIndex > 0) {
    chapterIndex--;
    window.history.replaceState(null, '', `?id=${courseId}&chapter=${chapterIndex}`);
    renderNav();
    renderChapter();
    window.scrollTo(0, 0);
  }
});

nextBtn.addEventListener('click', () => {
  if (chapterIndex < chapters.length - 1) {
    chapterIndex++;
    window.history.replaceState(null, '', `?id=${courseId}&chapter=${chapterIndex}`);
    renderNav();
    renderChapter();
    window.scrollTo(0, 0);
  }
});

// Ask AI panel
let askOpen = false;
askBtn.addEventListener('click', () => {
  askOpen = !askOpen;
  askPanel.classList.toggle('hidden', !askOpen);
  if (askOpen && !askPanel.hasChildNodes()) {
    initAskPanel();
  }
});

function initAskPanel() {
  const header = document.createElement('div');
  header.className = 'border-b border-white/10 px-4 py-3 flex items-center justify-between';
  const h3 = document.createElement('h3');
  h3.className = 'text-sm font-semibold text-white';
  h3.textContent = 'Ask AI';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'text-slate-400 hover:text-white transition-colors text-sm';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => {
    askOpen = false;
    askPanel.classList.add('hidden');
  });
  header.append(h3, closeBtn);

  const messages = document.createElement('div');
  messages.id = 'ask-messages';
  messages.className = 'flex-1 overflow-y-auto p-4 space-y-3';

  const form = document.createElement('form');
  form.className = 'border-t border-white/10 p-3 flex gap-2';
  const input = document.createElement('input');
  input.id = 'ask-input';
  input.className = 'flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
  input.placeholder = 'Ask about the course...';
  const send = document.createElement('button');
  send.type = 'submit';
  send.className = 'px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors';
  send.textContent = 'Send';
  form.append(input, send);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    const bubble = document.createElement('div');
    bubble.className = 'text-sm text-white bg-blue-600 rounded-lg px-3 py-2 max-w-[85%] ml-auto';
    bubble.textContent = text;
    messages.appendChild(bubble);

    const res = await post(`/api/courses/${courseId}/ask`, { question: text });
    const aiBubble = document.createElement('div');
    aiBubble.className = 'text-sm text-[#c9d1d9] bg-white/5 border border-white/10 rounded-lg px-3 py-2 max-w-[85%]';
    aiBubble.textContent = res.ok && res.data ? res.data.response : res.error || 'Failed to get response.';
    messages.appendChild(aiBubble);
    messages.scrollTop = messages.scrollHeight;
  });

  askPanel.append(header, messages, form);
}

if (courseId) loadCourse();
