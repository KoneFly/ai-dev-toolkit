const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const tick = () => new Promise(resolve => setImmediate(resolve));
const question = title => '<<<QSTART>>>' + JSON.stringify({ title, question: title, answer: '答案' }) + '<<<QEND>>>';

function load(context, file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

function environment() {
  const elements = new Map();
  const toasts = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', innerHTML: '', value: '', dataset: {}, disabled: false,
      style: {}, children: [], classList: { toggle() {} },
      appendChild(child) { this.children.push(child); },
      querySelector() { return null; },
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    AbortController, TextDecoder, console,
    localStorage: { getItem: () => JSON.stringify({ apiKey: 'test', baseURL: 'https://example.invalid', model: 'test' }) },
    document: {
      getElementById: id => elements.get(id) || null,
      querySelectorAll: () => [], createElement: () => element(Symbol()),
    },
    App: { state: { chapters: { '01': { id: '01', name: '第一章', keypoints: [{ title: '知识点', body: '材料' }] } } },
      showToast: message => toasts.push(message) },
    AppStorage: { save() {} },
    QuizView: { getCurrentChId: () => '01', getMode: () => 'self', render() {} },
  });
  context.window = context;
  load(context, 'ai-client.js');
  return { context, element, toasts };
}

test('caller can abort while response headers are pending', async () => {
  const { context } = environment();
  let signal;
  context.fetch = (_, options) => new Promise((resolve, reject) => {
    signal = options.signal;
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  const controller = new AbortController();
  let done = false;
  let error;
  const task = context.AIClient.streamChat([], () => {}, () => { done = true; }, e => { error = e; }, controller);
  controller.abort();
  await task;
  assert.equal(signal.aborted, true);
  assert.equal(done, false);
  assert.equal(error.name, 'AbortError');
});

test('late body data after abort is not delivered or completed', async () => {
  const { context } = environment();
  let release;
  context.fetch = async () => ({ ok: true, body: { getReader: () => ({
    read: () => new Promise(resolve => { release = resolve; }),
  }) } });
  const controller = new AbortController();
  const deltas = [];
  let done = false;
  let error;
  const task = context.AIClient.streamChat([], d => deltas.push(d), () => { done = true; }, e => { error = e; }, controller);
  await tick();
  controller.abort();
  release({ done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"late"}}]}\n\n') });
  await task;
  assert.deepEqual(deltas, []);
  assert.equal(done, false);
  assert.equal(error.name, 'AbortError');
});

test('an already cancelled request never calls fetch', async () => {
  const { context } = environment();
  context.fetch = () => { throw new Error('fetch must not run'); };
  const controller = new AbortController();
  controller.abort();
  let error;
  await context.AIClient.streamChat([], () => {}, () => assert.fail('completed'), e => { error = e; }, controller);
  assert.equal(error.name, 'AbortError');
});

test('existing four-argument callers still await complete streamed text', async () => {
  const { context } = environment();
  const encoded = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"正常输出"}}]}\n\ndata: [DONE]\n\n');
  const chunks = [encoded.slice(0, 54), encoded.slice(54)];
  context.fetch = async () => ({ ok: true, body: { getReader: () => ({
    read: async () => chunks.length ? { value: chunks.shift(), done: false } : { done: true },
  }) } });
  let done;
  const controller = await context.AIClient.streamChat([], () => {}, text => { done = text; }, assert.fail);
  assert.equal(done, '正常输出');
  assert.equal(controller.signal.aborted, false);
});

function deferredStreams(context) {
  const requests = [];
  context.AIClient.streamChat = (messages, delta, done, error, controller) => new Promise(resolve => {
    // 模拟取消后仍迟到的回调，用来验证页面自身的轮次隔离。
    requests.push({ delta, done, error, controller, finish: resolve });
  });
  return requests;
}

function practice() {
  const env = environment();
  for (const id of ['quiz-ai-run', 'quiz-ai-progress', 'quiz-mode-ai']) env.element(id);
  load(env.context, 'views/practice.js');
  env.context.PracticeView.bind();
  env.requests = deferredStreams(env.context);
  env.click = () => env.element('quiz-ai-run').onclick();
  env.questions = () => env.context.App.state.aiQuestionBank?.['01']?.questions || [];
  return env;
}

test('practice stop preserves complete questions and discards unfinished or late questions', async () => {
  const env = practice();
  const task = env.click();
  const req = env.requests[0];
  req.delta(question('保留'));
  req.delta('<<<QSTART>>>{"title":"半题","question":"不要保存"}');
  await env.click();
  assert.equal(req.controller.signal.aborted, true);
  req.delta(question('迟到'));
  req.done();
  req.finish();
  await task;
  assert.deepEqual(Array.from(env.questions(), q => q.title), ['保留']);
  assert.match(env.element('quiz-ai-progress').textContent, /已停止/);
  assert.equal(env.element('quiz-mode-ai').textContent, '✨ AI 题 (1)');
});

test('old success and error callbacks cannot overwrite a new practice run', async () => {
  const env = practice();
  const oldTask = env.click();
  await env.click();
  const newTask = env.click();
  env.requests[0].delta(question('旧题'));
  env.requests[0].error(new Error('old failure'));
  env.requests[0].done();
  env.requests[0].finish();
  await oldTask;
  assert.equal(env.questions().length, 0);
  assert.equal(env.element('quiz-ai-run').textContent, '⏸ 停止生成');
  env.requests[1].delta(question('新题'));
  env.requests[1].done();
  env.requests[1].finish();
  await newTask;
  assert.deepEqual(Array.from(env.questions(), q => q.title), ['新题']);
  assert.equal(env.element('quiz-ai-run').textContent, '生成并加入练习');
});

test('practice errors reset the button and allow retry', async () => {
  const env = practice();
  const first = env.click();
  env.requests[0].error(new Error('API 429'));
  env.requests[0].finish();
  await first;
  assert.match(env.element('quiz-ai-progress').textContent, /API 429/);
  assert.equal(env.element('quiz-ai-run').textContent, '生成并加入练习');
  const second = env.click();
  assert.equal(env.requests.length, 2);
  env.requests[1].done();
  env.requests[1].finish();
  await second;
});

test('legacy parallel batches share cancellation and cannot reset the next run', async () => {
  const env = environment();
  for (const id of ['ai-generate-btn', 'ai-result-list', 'ai-count', 'ai-ch-all', 'ai-progress-banner']) env.element(id);
  load(env.context, 'views/ai.js');
  env.context.AIView.bind();
  env.element('ai-ch-all').onclick();
  env.element('ai-count').onchange({ target: { value: '8' } });
  const requests = deferredStreams(env.context);
  const click = () => env.element('ai-generate-btn').onclick();
  click();
  assert.equal(requests.length, 2);
  click();
  assert.ok(requests.every(r => r.controller.signal.aborted));
  click();
  assert.equal(requests.length, 4);
  for (const req of requests.slice(0, 2)) {
    req.delta(question('旧题'));
    req.error(new Error('old error'));
    req.done();
    req.finish();
  }
  await tick();
  assert.equal(env.element('ai-generate-btn').dataset.state, 'streaming');
  assert.equal(env.toasts.some(t => t.includes('已生成')), false);
  for (const req of requests.slice(2)) { req.done(); req.finish(); }
  await tick();
  assert.equal(env.element('ai-generate-btn').dataset.state, 'idle');
});
