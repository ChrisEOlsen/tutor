/**
 * Lightweight safe markdown → DOM renderer.
 * No innerHTML with user-supplied text. All text is set via textContent.
 * Supports: headings, bold, italic, inline code, fenced code blocks,
 *           unordered/ordered lists, blockquotes, horizontal rules, paragraphs.
 *
 * Usage:
 *   import { renderMarkdown } from '/static/js/lib/markdown.js';
 *   const el = renderMarkdown(markdownString);
 *   container.appendChild(el);
 */

/**
 * Parse inline markdown within a single line of text and return a
 * DocumentFragment with safe DOM nodes (spans, codes, strongs, ems).
 * Never sets innerHTML — builds nodes with createElement/textContent.
 */
function parseInline(text) {
  const frag = document.createDocumentFragment();
  // Tokens: **bold**, *italic*, `code`, bare text
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    }
    const token = m[0];
    if (token.startsWith('`')) {
      const code = document.createElement('code');
      code.className = 'bg-white/10 rounded px-1 py-0.5 font-mono text-[0.85em] text-slate-200';
      code.textContent = token.slice(1, -1);
      frag.appendChild(code);
    } else if (token.startsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = token.slice(2, -2);
      frag.appendChild(strong);
    } else if (token.startsWith('*')) {
      const em = document.createElement('em');
      em.textContent = token.slice(1, -1);
      frag.appendChild(em);
    }
    last = m.index + token.length;
  }
  if (last < text.length) {
    frag.appendChild(document.createTextNode(text.slice(last)));
  }
  return frag;
}

/**
 * Render a markdown string into a <div> containing safe DOM nodes.
 * @param {string} md
 * @returns {HTMLElement}
 */
export function renderMarkdown(md) {
  const root = document.createElement('div');
  root.className = 'prose-chat';

  const lines = md.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block ──────────────────────────────────────────
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const pre = document.createElement('pre');
      pre.className = 'bg-white/5 border border-white/10 rounded-lg px-4 py-3 overflow-x-auto my-2';
      const code = document.createElement('code');
      code.className = `font-mono text-xs text-slate-200 block${lang ? ' language-' + lang : ''}`;
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      code.textContent = codeLines.join('\n');
      pre.appendChild(code);
      root.appendChild(pre);
      i++; // skip closing ```
      continue;
    }

    // ── Headings ───────────────────────────────────────────────────
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const tag = `h${level + 2}`; // h1→h3, h2→h4, h3→h5 (keep visual hierarchy subtle)
      const el = document.createElement(tag);
      el.className = level === 1
        ? 'text-base font-semibold text-white mt-4 mb-1'
        : level === 2
          ? 'text-sm font-semibold text-slate-200 mt-3 mb-1'
          : 'text-sm font-medium text-slate-300 mt-2 mb-0.5';
      el.appendChild(parseInline(headingMatch[2]));
      root.appendChild(el);
      i++;
      continue;
    }

    // ── Horizontal rule ────────────────────────────────────────────
    if (/^[-*_]{3,}$/.test(line.trim())) {
      const hr = document.createElement('hr');
      hr.className = 'border-white/10 my-3';
      root.appendChild(hr);
      i++;
      continue;
    }

    // ── Blockquote ─────────────────────────────────────────────────
    if (line.startsWith('> ')) {
      const bq = document.createElement('blockquote');
      bq.className = 'border-l-2 border-blue-500/50 pl-3 text-slate-400 italic my-1';
      bq.appendChild(parseInline(line.slice(2)));
      root.appendChild(bq);
      i++;
      continue;
    }

    // ── Unordered list ─────────────────────────────────────────────
    if (/^[-*+]\s/.test(line)) {
      const ul = document.createElement('ul');
      ul.className = 'list-disc list-inside space-y-0.5 my-1 text-slate-200';
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        const li = document.createElement('li');
        li.className = 'text-sm';
        li.appendChild(parseInline(lines[i].replace(/^[-*+]\s/, '')));
        ul.appendChild(li);
        i++;
      }
      root.appendChild(ul);
      continue;
    }

    // ── Ordered list ───────────────────────────────────────────────
    if (/^\d+\.\s/.test(line)) {
      const ol = document.createElement('ol');
      ol.className = 'list-decimal list-inside space-y-0.5 my-1 text-slate-200';
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const li = document.createElement('li');
        li.className = 'text-sm';
        li.appendChild(parseInline(lines[i].replace(/^\d+\.\s/, '')));
        ol.appendChild(li);
        i++;
      }
      root.appendChild(ol);
      continue;
    }

    // ── Blank line ─────────────────────────────────────────────────
    if (line.trim() === '') {
      i++;
      continue;
    }

    // ── Paragraph ──────────────────────────────────────────────────
    const p = document.createElement('p');
    p.className = 'text-sm leading-relaxed text-slate-200 my-1';
    p.appendChild(parseInline(line));
    root.appendChild(p);
    i++;
  }

  return root;
}
