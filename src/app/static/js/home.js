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
  } else if (course.status === 'completed') {
    a.href = `/static/pages/study.html?id=${course.id}&chapter=${course.current_chapter}`;
    a.textContent = 'View course';
  } else {
    a.href = `/static/pages/study.html?id=${course.id}&chapter=${course.current_chapter}`;
    a.textContent = 'Continue studying';
  }
  return a;
}

function deleteButton(courseId) {
  const btn = document.createElement('button');
  btn.className = 'text-xs text-red-400 hover:text-red-300 transition-colors ml-3';
  btn.textContent = 'Delete';
  btn.addEventListener('click', async () => {
    if (!confirm('Delete this course? This cannot be undone.')) return;
    const res = await del(`/api/courses/${courseId}`);
    if (res.ok) loadCourses();
  });
  return btn;
}

function courseCard(course) {
  const div = document.createElement('div');
  div.className = 'bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors';

  const header = document.createElement('div');
  header.className = 'flex items-start justify-between gap-3';

  const title = document.createElement('h3');
  title.className = 'font-medium text-white text-sm leading-snug';
  title.textContent = course.title;

  const actions = document.createElement('div');
  actions.className = 'flex items-center gap-2 flex-shrink-0';
  actions.append(statusBadge(course.status), deleteButton(course.id));

  header.append(title, actions);

  const link = courseLink(course);
  div.append(header, link);

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
