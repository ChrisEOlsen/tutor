// HTML escape utility
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function renderSection(section) {
  if (!section || !section.type) return document.createElement('div');

  switch (section.type) {
    case 'text': return renderText(section);
    case 'code-block': return renderCodeBlock(section);
    case 'step-list': return renderStepList(section);
    case 'callout': return renderCallout(section);
    case 'concept-card': return renderConceptCard(section);
    case 'memory-diagram': return renderMemoryDiagram(section);
    case 'flow-diagram': return renderFlowDiagram(section);
    case 'comparison-table': return renderComparisonTable(section);
    case 'key-value-grid': return renderKeyValueGrid(section);
    case 'bar-chart': return renderBarChart(section);
    case 'resource-links': return renderResourceLinks(section);
    case 'quiz': return renderQuiz(section);
    default: return renderText(section);
  }
}

function renderText(section) {
  const div = document.createElement('div');
  div.className = 'space-y-2 mb-6';

  if (section.heading) {
    const h = document.createElement('h3');
    h.className = 'text-lg font-semibold text-white mb-2';
    h.textContent = section.heading;
    div.appendChild(h);
  }

  const p = document.createElement('p');
  p.className = 'text-sm leading-relaxed text-[#c9d1d9]';
  p.textContent = section.content || '';
  div.appendChild(p);
  return div;
}

function renderCodeBlock(section) {
  const div = document.createElement('div');
  div.className = 'mb-6';

  if (section.language) {
    const label = document.createElement('div');
    label.className = 'text-xs text-slate-500 px-4 py-1.5 bg-[#161b22] border border-white/5 border-b-0 font-mono';
    label.textContent = section.language;
    div.appendChild(label);
  }

  const pre = document.createElement('pre');
  pre.className = 'bg-[#161b22] border border-white/5 rounded-lg p-4 overflow-x-auto text-sm font-mono text-[#c9d1d9]';
  const code = document.createElement('code');
  code.textContent = section.content || '';
  pre.appendChild(code);
  div.appendChild(pre);
  return div;
}

function renderStepList(section) {
  const ol = document.createElement('ol');
  ol.className = 'space-y-3 mb-6';

  const steps = section.steps || [];
  steps.forEach((step, i) => {
    const li = document.createElement('li');
    li.className = 'flex gap-3';

    const num = document.createElement('span');
    num.className = 'flex-shrink-0 w-6 h-6 rounded bg-white/5 border border-white/10 text-xs text-slate-400 flex items-center justify-center mt-0.5';
    num.textContent = String(i + 1);

    const content = document.createElement('div');
    content.className = 'flex-1';

    if (step.title) {
      const strong = document.createElement('strong');
      strong.className = 'text-sm text-white';
      strong.textContent = step.title;
      content.appendChild(strong);
    }
    if (step.body) {
      const p = document.createElement('p');
      p.className = 'text-sm text-[#c9d1d9] mt-0.5';
      p.textContent = step.body;
      content.appendChild(p);
    }

    li.append(num, content);
    ol.appendChild(li);
  });

  return ol;
}

function renderCallout(section) {
  const div = document.createElement('div');
  const variant = (section.variant || 'info').toLowerCase();

  const colors = {
    info: 'border-blue-500/30 bg-blue-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
    tip: 'border-emerald-500/30 bg-emerald-500/5',
  };
  const labels = { info: 'Note', warning: 'Warning', tip: 'Tip' };

  div.className = `border-l-2 ${colors[variant] || colors.info} rounded-r-lg px-4 py-3 mb-6`;

  const header = document.createElement('div');
  header.className = 'flex items-center gap-2 mb-1';
  const label = document.createElement('span');
  label.className = 'text-xs font-semibold text-slate-400 uppercase tracking-wide';
  label.textContent = labels[variant] || 'Note';
  header.appendChild(label);

  const p = document.createElement('p');
  p.className = 'text-sm text-[#c9d1d9]';
  p.textContent = section.content || '';

  div.append(header, p);
  return div;
}

function renderConceptCard(section) {
  const div = document.createElement('div');
  div.className = 'bg-white/5 border border-white/10 rounded-lg p-4 mb-6';

  const term = document.createElement('h4');
  term.className = 'text-sm font-semibold text-white mb-1';
  term.textContent = section.term || '';

  const def = document.createElement('p');
  def.className = 'text-sm text-[#c9d1d9] mb-2';
  def.textContent = section.definition || '';

  if (section.example) {
    const ex = document.createElement('p');
    ex.className = 'text-sm text-slate-400 italic';
    ex.textContent = section.example;
    div.append(term, def, ex);
  } else {
    div.append(term, def);
  }

  return div;
}

function renderMemoryDiagram(section) {
  const table = document.createElement('table');
  table.className = 'w-full text-sm border-collapse mb-6';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Address', 'Label', 'Value'].forEach(h => {
    const th = document.createElement('th');
    th.className = 'text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-3 py-2 border-b border-white/10';
    th.textContent = h;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const rows = section.rows || [];
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-white/5';
    row.forEach(cell => {
      const td = document.createElement('td');
      td.className = 'px-3 py-2 font-mono text-sm text-[#c9d1d9]';
      td.textContent = String(cell);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  return table;
}

function renderFlowDiagram(section) {
  const div = document.createElement('div');
  div.className = 'flex flex-col gap-0 mb-6';

  const steps = section.steps || [];
  steps.forEach((step, i) => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-3';

    const box = document.createElement('div');
    box.className = 'bg-white/5 border border-white/10 rounded px-4 py-2.5 text-sm text-[#c9d1d9] flex-1';
    box.textContent = step.label || step.title || String(step);

    row.appendChild(box);
    div.appendChild(row);

    if (i < steps.length - 1) {
      const arrow = document.createElement('div');
      arrow.className = 'flex justify-center py-1';
      const arrowSpan = document.createElement('span');
      arrowSpan.className = 'text-slate-600 text-xs';
      arrowSpan.textContent = '↓';
      arrow.appendChild(arrowSpan);
      div.appendChild(arrow);
    }
  });

  return div;
}

function renderComparisonTable(section) {
  const table = document.createElement('table');
  table.className = 'w-full text-sm border-collapse mb-6';

  const columns = section.columns || ['A', 'B'];
  const rows = section.rows || [];

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  columns.forEach(col => {
    const th = document.createElement('th');
    th.className = 'text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-3 py-2 border-b border-white/10';
    th.textContent = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-white/5';
    row.forEach(cell => {
      const td = document.createElement('td');
      td.className = 'px-3 py-2 text-sm text-[#c9d1d9]';
      td.textContent = String(cell);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  return table;
}

function renderKeyValueGrid(section) {
  const div = document.createElement('div');
  div.className = 'grid grid-cols-2 gap-2 mb-6';

  const pairs = section.pairs || [];
  pairs.forEach(pair => {
    const card = document.createElement('div');
    card.className = 'bg-white/5 border border-white/10 rounded-lg p-3';

    const k = document.createElement('div');
    k.className = 'text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1';
    k.textContent = String(pair[0] || '');

    const v = document.createElement('div');
    v.className = 'text-sm text-[#c9d1d9]';
    v.textContent = String(pair[1] || '');

    card.append(k, v);
    div.appendChild(card);
  });

  return div;
}

function renderBarChart(section) {
  const div = document.createElement('div');
  div.className = 'space-y-3 mb-6';

  const data = section.data || [];
  const maxVal = Math.max(...data.map(d => Number(d.value) || 0), 1);

  data.forEach(item => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-3';

    const label = document.createElement('span');
    label.className = 'text-xs text-slate-400 w-24 text-right flex-shrink-0';
    label.textContent = item.label || '';

    const barContainer = document.createElement('div');
    barContainer.className = 'flex-1 bg-white/5 rounded h-5 overflow-hidden';

    const pct = Math.round((Number(item.value) || 0) / maxVal * 100);
    const bar = document.createElement('div');
    bar.className = 'h-full bg-blue-500/60 rounded transition-all';
    bar.style.width = pct + '%';

    const val = document.createElement('span');
    val.className = 'text-xs text-slate-400 w-12 flex-shrink-0';
    val.textContent = String(item.value || 0);

    barContainer.appendChild(bar);
    row.append(label, barContainer, val);
    div.appendChild(row);
  });

  return div;
}

function renderResourceLinks(section) {
  const div = document.createElement('div');
  div.className = 'bg-white/5 border border-white/10 rounded-lg p-4 mb-6';

  const h4 = document.createElement('h4');
  h4.className = 'text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3';
  h4.textContent = 'Resources';

  const ul = document.createElement('ul');
  ul.className = 'space-y-2';

  const links = section.links || [];
  links.forEach(link => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = link.url || '#';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'block group';

    const title = document.createElement('span');
    title.className = 'text-sm text-blue-400 group-hover:text-blue-300 transition-colors';
    title.textContent = link.title || '';

    const desc = document.createElement('span');
    desc.className = 'text-xs text-slate-500 ml-2';
    desc.textContent = link.description || '';

    a.append(title, desc);
    li.appendChild(a);
    ul.appendChild(li);
  });

  div.append(h4, ul);
  return div;
}

function renderQuiz(section) {
  const container = document.createElement('div');
  container.className = 'bg-white/5 border border-white/10 rounded-lg p-4 mb-6';

  const q = document.createElement('p');
  q.className = 'text-sm font-medium text-white mb-4';
  q.textContent = section.question || '';

  const options = section.options || [];
  const correct = Number(section.correct) || 0;
  const quizId = section.quizId || Math.random().toString(36).slice(2, 8);
  const ol = document.createElement('ol');
  ol.className = 'space-y-2 list-none';

  // Collect all option items for direct reference — no getElementById needed
  const optionItems = [];

  // Feedback element (hidden until answered)
  const feedback = document.createElement('div');
  feedback.className = 'mt-3 pt-3 border-t border-white/5 text-sm';
  feedback.style.display = 'none';

  options.forEach((opt, i) => {
    const li = document.createElement('li');
    li.className = 'flex items-center gap-2 rounded-lg px-3 py-2.5 transition-colors border border-transparent';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'quiz-' + quizId;
    radio.value = String(i);
    radio.className = 'mt-0.5 accent-blue-500 flex-shrink-0';

    // Indicator icon (hidden until answered)
    const icon = document.createElement('span');
    icon.className = 'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs border border-white/10 text-transparent';
    icon.style.display = 'none';

    const label = document.createElement('label');
    label.htmlFor = radio.id || ('quiz-opt-' + i + '-' + quizId);
    radio.id = label.htmlFor;
    label.className = 'text-sm text-[#c9d1d9] cursor-pointer hover:text-white transition-colors leading-relaxed flex-1';
    label.textContent = opt;

    radio.addEventListener('change', () => {
      const isCorrect = i === correct;

      // Update all options using direct references
      optionItems.forEach((item, j) => {
        const isCorrectOption = j === correct;
        const isSelected = j === i;

        // Reset base classes
        item.li.className = 'flex items-center gap-2 rounded-lg px-3 py-2.5 transition-colors border';
        item.icon.style.display = 'flex';
        item.icon.className = 'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs';
        item.radio.disabled = true;

        if (isCorrectOption) {
          // Correct answer — always green
          item.li.className += ' bg-emerald-500/10 border-emerald-500/30';
          item.icon.className += ' bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
          item.icon.textContent = '✓';
        } else if (isSelected && !isCorrect) {
          // Selected wrong answer — red
          item.li.className += ' bg-red-500/10 border-red-500/30';
          item.icon.className += ' bg-red-500/20 border-red-500/40 text-red-400';
          item.icon.textContent = '✕';
        } else {
          // Unselected, non-correct — dim
          item.li.className += ' border-transparent opacity-50';
          item.icon.className += ' border-white/5 text-transparent';
        }
      });

      // Show feedback with direct reference
      feedback.style.display = 'block';
      feedback.replaceChildren();
      const fbText = document.createElement('p');
      fbText.className = isCorrect ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium';
      fbText.textContent = isCorrect
        ? '✓ Correct!'
        : '✕ Incorrect — the answer is: ' + options[correct];
      feedback.appendChild(fbText);
    });

    li.append(radio, icon, label);
    ol.appendChild(li);
    optionItems.push({ li, radio, icon });
  });

  container.append(q, ol, feedback);
  return container;
}
