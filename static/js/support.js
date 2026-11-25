const support = document.querySelector('[data-support]');
const form = support.querySelector('#medusa-form');
const input = support.querySelector('#medusa-input');
const send = support.querySelector('#medusa-send');
const messages = support.querySelector('#medusa-messages');
const thread = support.querySelector('#medusa-thread');
const suggestions = support.querySelector('#medusa-suggestions');
const loading = support.querySelector('#medusa-loading');
const announcement = support.querySelector('#medusa-announcement');
const availability = support.querySelector('#medusa-availability');
const human = support.querySelector('#medusa-human');
const handoff = support.querySelector('#medusa-handoff');
const error = support.querySelector('#medusa-error');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const csrf = form.elements.csrf_token.value;
const greeting = messages.firstElementChild;
let history = [];
let pending;
let conversation = 0;
let statusRevision = 0;

function scrollToLatest() {
  thread.scrollTop = thread.scrollHeight;
}

function addMessage(speaker, text) {
  const message = document.createElement('div');
  message.className = 'support-message';
  message.dataset.speaker = speaker;
  const name = document.createElement('strong');
  name.textContent = speaker === 'user' ? 'Você' : 'MEDUSA AI';
  const content = document.createElement('p');
  content.textContent = text;
  message.append(name, content);
  messages.append(message);
  scrollToLatest();
  return content;
}

function showMode(mode) {
  if (!['checking', 'online', 'offline'].includes(mode)) return;
  availability.parentElement.dataset.availability = mode;
  availability.textContent = {
    checking: 'Verificando disponibilidade',
    online: 'Assistente online',
    offline: 'Modo offline · perguntas frequentes',
  }[mode];
}

async function refreshStatus() {
  if (document.hidden || pending) return;
  const revision = ++statusRevision;
  try {
    const response = await fetch(support.dataset.status, { signal: AbortSignal.timeout(12000) });
    const data = await response.json();
    if (response.ok && revision === statusRevision) showMode(data.mode);
  } catch {
    if (revision === statusRevision) showMode('offline');
  }
}

function showError(text = '') {
  error.textContent = text;
  error.hidden = !text;
}

async function post(url, fields, signal) {
  const response = await fetch(url, {
    method: 'POST',
    body: new URLSearchParams([['csrf_token', csrf], ...fields]),
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (response.status === 400 && !response.headers.get('Content-Type')?.includes('application/json')) {
    throw new Error('A sessão da página expirou. Recarregue a página e tente novamente.');
  }
  if (!response.headers.get('Content-Type')?.includes('application/json')) {
    throw new Error('O suporte está temporariamente indisponível. Tente novamente.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a solicitação.');
  return data;
}

async function revealAnswer(answer, active) {
  const content = addMessage('assistant', '');
  const step = Math.max(4, Math.ceil(answer.length / 40));
  if (!reducedMotion.matches) {
    for (let end = step; end < answer.length; end += step) {
      if (active !== conversation) return;
      content.textContent = answer.slice(0, end);
      scrollToLatest();
      await new Promise((resolve) => setTimeout(resolve, 17));
    }
  }
  if (active !== conversation) return;
  content.textContent = answer;
  announcement.textContent = answer;
  scrollToLatest();
}

async function sendMessage(text) {
  if (pending || !text) return;
  const active = conversation;
  const controller = new AbortController();
  pending = controller;
  ++statusRevision;
  showError();
  suggestions.hidden = true;
  loading.hidden = false;
  announcement.textContent = 'MEDUSA AI está preparando a resposta.';
  send.disabled = true;
  addMessage('user', text);
  input.value = '';
  try {
    const data = await post(form.action, [['message', text], ...history.map((past) => ['history', past])], controller.signal);
    if (active !== conversation) return;
    showMode(data.mode);
    loading.hidden = true;
    if (data.mode !== 'local') history = [...history, text].slice(-3);
    await revealAnswer(data.answer, active);
  } catch (failure) {
    if (active !== conversation) return;
    input.value ||= text;
    showError(failure.name === 'TimeoutError' ? 'O suporte demorou para responder. Tente novamente.' : failure.message);
  } finally {
    if (active === conversation) {
      pending = null;
      loading.hidden = true;
      send.disabled = false;
    }
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  sendMessage(input.value.trim());
});
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    form.requestSubmit();
  }
});
suggestions.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (button) sendMessage(button.textContent.trim());
});
support.querySelector('#medusa-reset').addEventListener('click', () => {
  ++conversation;
  pending?.abort();
  pending = null;
  history = [];
  messages.replaceChildren(greeting);
  input.value = '';
  announcement.textContent = 'Nova conversa iniciada.';
  suggestions.hidden = false;
  loading.hidden = true;
  send.disabled = false;
  handoff.hidden = true;
  human.disabled = false;
  showError();
  thread.scrollTop = 0;
  input.focus();
  refreshStatus();
});
human.addEventListener('click', async () => {
  const active = conversation;
  human.disabled = true;
  showError();
  try {
    const data = await post(support.dataset.human, [], new AbortController().signal);
    if (active === conversation) handoff.hidden = data.state !== 'waiting';
  } catch {
    if (active !== conversation) return;
    human.disabled = false;
    showError('Não foi possível registrar a solicitação nesta conversa. Tente novamente.');
  }
});
refreshStatus();
setInterval(refreshStatus, 60000);
document.addEventListener('visibilitychange', refreshStatus);
