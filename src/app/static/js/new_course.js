import { post } from '/static/js/lib/api.js';

const container = document.getElementById('forms-container');

function setupForm() {
  const wrapper = document.createElement('div');
  wrapper.className = 'bg-white/5 border border-white/10 rounded-lg p-6 space-y-4';

  const h3 = document.createElement('h3');
  h3.className = 'text-sm font-semibold text-slate-300';
  h3.textContent = 'What do you want to build?';
  wrapper.appendChild(h3);

  const form = document.createElement('form');
  form.className = 'space-y-4';

  const label = document.createElement('label');
  label.className = 'block text-sm font-medium text-slate-300';
  label.textContent = 'Describe your project';
  const input = document.createElement('textarea');
  input.name = 'title';
  input.rows = 3;
  input.className = 'mt-1 block w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500';
  input.placeholder = 'e.g., write a memory allocator in C using an explicit free list';
  input.required = true;
  form.appendChild(label);
  form.appendChild(input);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50';
  submitBtn.textContent = 'Start Course';
  form.appendChild(submitBtn);

  const errEl = document.createElement('p');
  errEl.className = 'text-sm text-red-400 hidden';
  form.appendChild(errEl);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';
    errEl.classList.add('hidden');

    const res = await post('/api/courses', { title: input.value });
    submitBtn.disabled = false;
    submitBtn.textContent = 'Start Course';

    if (res.ok && res.data && res.data.id) {
      window.location.href = `/static/pages/chat.html?id=${res.data.id}`;
    } else {
      errEl.textContent = res.error ?? 'Something went wrong.';
      errEl.classList.remove('hidden');
    }
  });

  wrapper.appendChild(form);
  container.appendChild(wrapper);
}

setupForm();
