import { get, del } from '/static/js/lib/api.js';

const app = document.getElementById('app');

const statusLabels = {
  chatting: 'Chatting',
  outline_ready: 'Outline Ready',
  generating: 'Generating',
  active: 'Active',
  completed: 'Completed',
};

const statusColors = {
  chatting: 'bg-blue-500/20 text-blue-300',
  outline_ready: 'bg-amber-500/20 text-amber-300',
  generating: 'bg-purple-500/20 text-purple-300',
  active: 'bg-emerald-500/20 text-emerald-300',
  completed: 'bg-slate-500/20 text-slate-300',
};

function statusBadge(status) {
  const span = document.createElement('span');
  span.className = `text-xs px-2 py-0.5 rounded-full ${statusColors[status] || statusColors.active}`;
  span.textContent = statusLabels[status] || status;
  return span;
}

function courseLink(course) {
  const a = document.createElement('a');
  a.className = 'text-sm text-blue-400 hover:text-blue-300 transition-colors';
  if (course.status === 'chatting' || course.status === 'outline_ready') {
    a.href = `/static/pages/chat.html?id=${course.id}`;
    a.textContent = course.status === 'chatting' ? 'Continue chat' : 'Review outline';
  } else if (course.status === 'generating') {
    a.href = `/static/pages/chat.html?id=${course.id}`;
    a.textContent = 'View progress';
  } else if (course.status === 'completed') {
    a.href = `/static/pages/study.html?id=${course.id}&chapter=${course.current_chapter}`;
    a.textContent = 'View course';
  } else {
    a.href = `/static/pages/study.html?id=${course.id}&chapter=${course.current_chapter}`;
    a.textContent = 'Continue studying';
  }
  return a;
}

function menuButton(courseId) {
  const wrap = document.createElement('div');
  wrap.className = 'relative';

  const trigger = document.createElement('button');
  trigger.className = 'w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-base leading-none';
  trigger.textContent = '⋯';
  trigger.setAttribute('aria-label', 'Course options');

  const dropdown = document.createElement('div');
  dropdown.className = 'absolute right-0 top-8 bg-[#0d1323] border border-white/10 rounded-lg shadow-xl z-10 min-w-[120px] hidden';

  const deleteItem = document.createElement('button');
  deleteItem.className = 'w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 hover:text-red-300 transition-colors rounded-lg';
  deleteItem.textContent = 'Delete';
  deleteItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    dropdown.classList.add('hidden');
    if (!confirm('Delete this course? This cannot be undone.')) return;
    const res = await del(`/api/courses/${courseId}`);
    if (res.ok) loadCourses();
  });

  dropdown.appendChild(deleteItem);
  wrap.append(trigger, dropdown);

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = dropdown.classList.contains('hidden');
    document.querySelectorAll('.course-dropdown').forEach(d => d.classList.add('hidden'));
    if (isHidden) dropdown.classList.remove('hidden');
  });

  dropdown.classList.add('course-dropdown');

  return wrap;
}

document.addEventListener('click', () => {
  document.querySelectorAll('.course-dropdown').forEach(d => d.classList.add('hidden'));
});

function chapterProgress(course) {
  if (course.status !== 'active' && course.status !== 'completed') return null;
  let outline = [];
  let testResults = {};
  try { outline = JSON.parse(course.outline || '[]'); } catch (e) {}
  try { testResults = JSON.parse(course.test_results || '{}'); } catch (e) {}

  const total = outline.length;
  if (total === 0) return null;

  const done = outline.filter((_, i) => !!testResults[String(i)]).length;
  return { done, total };
}

function courseCard(course) {
  const div = document.createElement('div');
  div.className = 'bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors flex flex-col gap-3';

  // Header row: title + badge + delete
  const header = document.createElement('div');
  header.className = 'flex items-start justify-between gap-3';

  const title = document.createElement('h3');
  title.className = 'font-medium text-white text-sm leading-snug';
  title.textContent = course.title;

  const actions = document.createElement('div');
  actions.className = 'flex items-center gap-2 flex-shrink-0';
  if (course.status !== 'active') actions.appendChild(statusBadge(course.status));
  actions.appendChild(menuButton(course.id));

  header.append(title, actions);
  div.appendChild(header);

  // Chapter progress (only for courses that have an outline)
  const progress = chapterProgress(course);
  if (progress) {
    const progressWrap = document.createElement('div');
    progressWrap.className = 'space-y-1';

    const bar = document.createElement('div');
    bar.className = 'w-full bg-white/10 rounded-full h-1';
    const fill = document.createElement('div');
    const pct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;
    fill.className = 'h-1 rounded-full transition-all duration-500 bg-emerald-500';
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);

    const label = document.createElement('p');
    label.className = 'text-xs text-slate-400';
    label.textContent = `${progress.done} / ${progress.total} chapters completed`;

    progressWrap.append(bar, label);
    div.appendChild(progressWrap);
  }

  // Footer: action link
  div.appendChild(courseLink(course));

  return div;
}

function groupByStatus(courses) {
  const groups = {};
  const order = ['chatting', 'outline_ready', 'active', 'completed', 'generating'];
  courses.forEach(c => {
    const s = c.status || 'active';
    if (!groups[s]) groups[s] = [];
    groups[s].push(c);
  });
  const result = [];
  order.forEach(s => {
    if (groups[s] && groups[s].length > 0) result.push({ status: s, courses: groups[s] });
  });
  return result;
}

function renderDashboard(courses) {
  app.replaceChildren();

  if (courses.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-center py-20';
    const h2 = document.createElement('h2');
    h2.className = 'text-xl font-semibold text-white mb-2';
    h2.textContent = 'No courses yet';
    const p = document.createElement('p');
    p.className = 'text-slate-400 mb-6';
    p.textContent = 'Start by creating your first learning course.';
    const a = document.createElement('a');
    a.href = '/static/pages/new_course.html';
    a.className = 'inline-block bg-white/10 hover:bg-white/20 transition-colors px-6 py-3 rounded-lg text-sm text-white font-medium';
    a.textContent = 'Create a Course';
    empty.append(h2, p, a);
    app.appendChild(empty);
    return;
  }

  const groups = groupByStatus(courses);
  groups.forEach(g => {
    const section = document.createElement('section');
    section.className = 'mb-8';

    const h2 = document.createElement('h2');
    h2.className = 'text-xs font-bold text-slate-400 uppercase tracking-wider mb-3';
    h2.textContent = statusLabels[g.status] || g.status;

    const grid = document.createElement('div');
    grid.className = 'grid gap-3 sm:grid-cols-2';
    g.courses.forEach(c => grid.appendChild(courseCard(c)));

    section.append(h2, grid);
    app.appendChild(section);
  });
}

async function loadCourses() {
  const res = await get('/api/courses');
  if (!res.ok) {
    app.textContent = 'Failed to load courses.';
    return;
  }
  renderDashboard(res.data ?? []);
}

loadCourses();
