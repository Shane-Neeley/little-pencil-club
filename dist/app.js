'use strict';

const iconPaths = {
  pencil: '<path d="m4 16-1 5 5-1L20 8l-4-4Z"/><path d="m13 7 4 4m-13 5 4 4m8-16 1-1a2 2 0 0 1 3 0l1 1a2 2 0 0 1 0 3l-1 1"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.3"/><rect x="14" y="14" width="7" height="7" rx="1.3"/>',
  book: '<path d="M6 3h13a1 1 0 0 1 1 1v16H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Z"/><path d="M4 17a2 2 0 0 1 2-2h14M8 7h7m-7 4h4"/>',
  paw: '<path d="M8 13c2-3 6-3 8 0l3 3c2 3-1 5-4 4-2-1-4-1-6 0-3 1-6-1-4-4z"/><ellipse cx="5" cy="9" rx="2" ry="2.5"/><ellipse cx="10" cy="5" rx="2" ry="2.5"/><ellipse cx="15" cy="5" rx="2" ry="2.5"/><ellipse cx="20" cy="9" rx="2" ry="2.5"/>',
  berry: '<path d="M12 8c7-4 11 1 7 7-2 3-5 6-7 6s-5-3-7-6C1 9 5 4 12 8Zm0 0c0-3-2-4-4-5m4 5c0-3 2-4 4-5m-7 9h.01m6 0h.01m-3 4h.01"/>',
  shirt: '<path d="m8 4-5 3 2 5 3-1v9h8v-9l3 1 2-5-5-3a4 4 0 0 1-8 0Z"/>',
  leaf: '<path d="M5 19C1 12 6 5 19 4c0 11-5 16-12 13M3 21 15 9"/>',
  box: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16m-10 4h4"/>',
  sparkle: '<path d="M12 2c.3 6.4 3.5 9.7 10 10-6.5.3-9.7 3.6-10 10-.3-6.4-3.5-9.7-10-10 6.5-.3 9.7-3.6 10-10Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  eraser: '<path d="m3 14 8-9a2 2 0 0 1 3 0l6 6a2 2 0 0 1 0 3l-6 6H8l-5-4a1.5 1.5 0 0 1 0-2Zm4-4 9 8m-3 2h8"/>',
  undo: '<path d="m8 5-5 5 5 5m-5-5h11a5 5 0 0 1 0 10"/>',
  redo: '<path d="m16 5 5 5-5 5m5-5H10a5 5 0 0 0 0 10"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>',
  play: '<path d="M8 4v16l13-8Z"/>',
  save: '<path d="M12 3v12m-5-5 5 5 5-5m-13 7v4h16v-4"/>',
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
}

const main = document.querySelector('#main');
const notice = document.querySelector('#notice');
const lessonById = new Map(lessons.map(lesson => [lesson.id, lesson]));
const drawings = new Map();
const drawingModes = [
  ['paper', 'Paper'],
  ['trace', 'Trace on screen'],
  ['copy', 'Blank canvas'],
];
const difficultyLabels = ['Easy', 'Medium', 'Challenge'];
const width = 1000;
const height = 690;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const storagePrefix = 'little-pencil-club/';
let filter = 'All';
let session;
let observer;
let noticeTimeout;
let pencilOnly = readStorage('pencil-only', false);

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(storagePrefix + key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(storagePrefix + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function dataFor(lesson) {
  if (!drawings.has(lesson.id)) {
    const saved = readStorage(lesson.id, {});
    const strokes = Array.isArray(saved?.strokes) ? saved.strokes : [];
    // Earlier versions stored Trace by default, even when the learner only advanced steps.
    const legacyMode = saved?.mode === 'copy' || strokes.length ? saved?.mode : 'paper';
    const mode = saved?.drawingMode ?? legacyMode;
    drawings.set(lesson.id, {
      step: Math.min(Math.max(0, Number(saved?.step) || 0), lesson.steps.length - 1),
      strokes,
      completed: Number(saved?.completed) || 0,
      drawingMode: drawingModes.some(([id]) => id === mode) ? mode : 'paper',
    });
  }
  return drawings.get(lesson.id);
}

function persist() {
  if (!saveStorage(session.lesson.id, session.data)) {
    showNotice('This browser could not save your changes. Download your drawing to keep it.');
  }
}

function showNotice(message) {
  clearTimeout(noticeTimeout);
  notice.textContent = message;
  notice.hidden = false;
  noticeTimeout = setTimeout(() => { notice.hidden = true; }, 4200);
}

function render() {
  if (session?.stroke) endStroke();
  if (session) cancelAnimationFrame(session.animation);
  session = null;
  observer?.disconnect();
  observer = new ResizeObserver(entries => {
    entries.forEach(({ target }) => {
      if (target.classList.contains('surface')) {
        repaintInk();
        redrawReferences();
      }
      if (target.matches('.picture-canvas')) paintCard(target);
      if (target.id === 'step-example') redrawDemo();
    });
  });

  const [page, id] = location.hash.slice(1).split('/');
  const lesson = lessonById.get(id);
  const studio = lesson && (page === 'draw' || page === 'done');
  const book = page === 'sketchbook';
  document.querySelector('#nav-lessons').toggleAttribute('aria-current', !book);
  document.querySelector('#nav-sketchbook').toggleAttribute('aria-current', book);
  (book ? document.querySelector('#nav-sketchbook') : document.querySelector('#nav-lessons')).setAttribute('aria-current', 'page');

  if (studio) {
    renderStudio(lesson, page === 'done' && Boolean(dataFor(lesson).completed));
  } else if (book) {
    renderBook();
  } else {
    renderLibrary();
  }
  window.scrollTo(0, 0);
}

function watchCards() {
  main.querySelectorAll('.picture-canvas').forEach(canvas => {
    paintCard(canvas);
    observer.observe(canvas);
  });
}

function paintCard(canvas) {
  const lesson = lessonById.get(canvas.dataset.lesson);
  if (canvas.dataset.ink && dataFor(lesson).strokes.some(stroke => stroke.tool === 'pencil')) {
    paintThumbnail(canvas, dataFor(lesson).strokes);
  } else {
    drawExample(canvas, lesson, undefined, {
      decorative: true,
      hero: canvas.dataset.hero === 'true',
      scale: canvas.dataset.hero === 'true' ? 1.06 : 1,
    });
  }
}

function categoryStyle(name) {
  const category = categories[name];
  return category ? `style="--tint:${category.tint};--accent:${category.accent}"` : '';
}

function previewCard(lesson, book = false) {
  const data = dataFor(lesson);
  const detail = book ? (data.completed ? 'Finished drawing' : 'In progress') : `
    <span>${lesson.minutes} min</span>
    <span class="difficulty" role="img" aria-label="${difficultyLabels[lesson.level - 1]} difficulty" title="${difficultyLabels[lesson.level - 1]} · ${lesson.skill}">
      ${Array.from({ length: 3 }, (_, index) => `<span class="${index < lesson.level ? 'filled' : ''}">${icon('pencil')}</span>`).join('')}
    </span>`;
  return `<a class="lesson-card" ${categoryStyle(lesson.category)} href="#${book && data.completed ? 'done' : 'draw'}/${lesson.id}">
    <div class="card-picture">
      <canvas class="picture-canvas" data-lesson="${lesson.id}" ${book ? 'data-ink="true"' : ''} aria-hidden="true"></canvas>
      ${data.completed ? `<span class="completion-mark" title="Lesson finished">${icon('check')}</span>` : ''}
    </div>
    <div class="card-body"><span class="card-title">${lesson.title}</span><p class="card-detail">${detail}</p></div>
  </a>`;
}

function renderLibrary() {
  main.className = 'wrap';
  const fox = lessons[0];
  main.innerHTML = `
    <section class="hero" aria-labelledby="home-title">
      <div class="hero-copy">
        <h1 id="home-title">Let’s <em>draw!</em></h1>
        <p>Grab a pencil and paper.</p>
        <a class="primary" href="#draw/${fox.id}">${icon('pencil')} ${dataFor(fox).step && !dataFor(fox).completed ? 'Continue little fox' : 'Draw the little fox'}</a>
      </div>
      <div class="hero-art">
        <figure class="hero-sheet">
          <canvas class="picture-canvas" data-lesson="${fox.id}" data-hero="true" role="img" aria-label="Pencil sketch of a little fox with a curled tail"></canvas>
        </figure>
        <span class="hero-pencil" aria-hidden="true"></span>
        <span class="hero-star hero-star-a">${icon('sparkle')}</span>
        <span class="hero-star hero-star-b">${icon('sparkle')}</span>
      </div>
    </section>
    <section class="library" aria-labelledby="library-title">
      <div class="section-heading"><h2 id="library-title">What will you draw?</h2><span id="lesson-count" class="count" aria-live="polite"></span></div>
      <div class="filters" aria-label="Filter lessons">
        ${['All', ...Object.keys(categories)].map(category => `<button type="button" class="filter" ${categoryStyle(category)} data-filter="${category}" aria-pressed="${category === filter}">${icon(categories[category]?.glyph || 'grid')}${category}</button>`).join('')}
      </div>
      <div class="card-grid" id="lesson-cards"></div>
    </section>`;
  main.querySelector('.filters').addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button || filter === button.dataset.filter) return;
    filter = button.dataset.filter;
    main.querySelectorAll('[data-filter]').forEach(choice => {
      choice.setAttribute('aria-pressed', String(choice === button));
    });
    renderLessonCards();
  });
  renderLessonCards();
  const hero = main.querySelector('.hero-sheet canvas');
  paintCard(hero);
  observer.observe(hero);
}

function renderLessonCards() {
  const cards = document.querySelector('#lesson-cards');
  cards.querySelectorAll('canvas').forEach(canvas => observer.unobserve(canvas));
  const visible = filter === 'All' ? lessons : lessons.filter(lesson => lesson.category === filter);
  document.querySelector('#lesson-count').textContent = `${visible.length} lessons`;
  cards.innerHTML = visible.map(lesson => previewCard(lesson)).join('');
  cards.querySelectorAll('canvas').forEach(canvas => {
    paintCard(canvas);
    observer.observe(canvas);
  });
}

function renderBook() {
  main.className = 'wrap';
  const started = lessons.filter(lesson => {
    const data = dataFor(lesson);
    return data.completed || data.strokes.length || data.step;
  });
  started.sort((a, b) => dataFor(b).completed - dataFor(a).completed);
  const completed = started.filter(lesson => dataFor(lesson).completed).length;
  main.innerHTML = `
    <h1 class="book-heading">Your sketchbook</h1>
    <p class="book-description">${completed} of ${lessons.length} lessons finished. Your drawings stay in this browser.</p>
    ${started.length ? `<div class="card-grid">${started.map(lesson => previewCard(lesson, true)).join('')}</div>` : `
      <section class="empty-book">${icon('book')}<h2>A fresh page</h2>
        <p>Start any lesson. Your drawing will be here when you come back.</p>
        <a class="primary" href="#draw/${lessons[0].id}">Draw the little fox</a>
      </section>`}`;
  watchCards();
}

function toolButton(name, label, action, text = '', pressed = '') {
  const state = pressed === '' ? '' : `aria-pressed="${pressed}"`;
  return `<button type="button" class="tool" data-action="${action}" title="${label}" aria-label="${label}" ${state}>${icon(name)}${text ? `<span class="tool-text ${text === 'Save' ? 'optional' : ''}">${text}</span>` : ''}</button>`;
}

function renderStudio(lesson, finished) {
  const data = dataFor(lesson);
  session = { lesson, data, finished, tool: 'pencil', redo: [], duration: 980, remix: 0 };
  main.className = 'wrap studio';
  main.innerHTML = `
    <div class="lesson-heading">
      <h1>${lesson.title}</h1>
      <div class="mode-control">
        <label class="sr-only" for="drawing-mode">Drawing mode</label>
        <select id="drawing-mode">
          ${drawingModes.map(([mode, label]) => `<option value="${mode}" ${mode === data.drawingMode ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="studio-grid">
      <div class="board">
        <div class="board-head">
          <div class="tool-group" aria-label="Drawing tools">
            ${toolButton('pencil', 'Pencil', 'pencil', '', true)}
            ${toolButton('eraser', 'Eraser', 'eraser', '', false)}
            <span class="board-separator" aria-hidden="true"></span>
            ${toolButton('undo', 'Undo', 'undo')}
            ${toolButton('redo', 'Redo', 'redo')}
            ${toolButton('trash', 'Clear drawing', 'clear')}
          </div>
          ${toolButton('save', 'Save drawing as PNG', 'save', 'Save')}
        </div>
        <div class="surface">
          <canvas id="guide" aria-hidden="true"></canvas>
          <canvas id="ink" aria-label="Drawing area. Draw with an Apple Pencil, finger, or mouse."></canvas>
        </div>
        <button class="board-replay secondary" type="button" data-action="replay" hidden>${icon('play')}Replay</button>
        <div class="board-foot">
          <label><input type="checkbox" id="pencil-only" ${pencilOnly ? 'checked' : ''}>Pencil only</label>
        </div>
      </div>
      <section class="lesson-panel" aria-label="Drawing instructions"></section>
    </div>
    <dialog class="app-dialog" aria-labelledby="clear-heading">
      <form method="dialog">
        <h2 id="clear-heading">Clear this drawing?</h2>
        <p>This removes the marks you made on this page.</p>
        <div class="dialog-actions">
          <button class="secondary" value="cancel" autofocus>Cancel</button>
          <button class="primary" value="clear">Clear drawing</button>
        </div>
      </form>
    </dialog>`;
  session.canvas = document.querySelector('#ink');
  session.guide = document.querySelector('#guide');
  main.querySelector('#drawing-mode').addEventListener('change', event => {
    if (session.stroke) endStroke();
    session.data.drawingMode = event.target.value;
    updateTools();
    repaintInk();
    redrawReferences();
    persist();
  });
  session.canvas.addEventListener('pointerdown', startStroke);
  session.canvas.addEventListener('pointermove', moveStroke);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => session.canvas.addEventListener(name, endStroke));
  session.canvas.addEventListener('contextmenu', event => event.preventDefault());
  document.querySelector('#pencil-only').addEventListener('change', event => {
    pencilOnly = event.target.checked;
    saveStorage('pencil-only', pencilOnly);
    updateTools();
  });
  main.querySelector('dialog').addEventListener('close', event => {
    if (!session || event.target.returnValue !== 'clear') return;
    session.data.strokes = [];
    session.redo = [];
    repaintInk();
    updateTools();
    persist();
  });
  renderPanel();
  updateTools();
  repaintInk();
  redrawReferences();
  observer.observe(main.querySelector('.surface'));
  playDemo();
}

function renderPanel() {
  const { lesson, data, finished } = session;
  const panel = main.querySelector('.lesson-panel');
  const previousCanvas = panel.querySelector('canvas');
  if (previousCanvas) observer.unobserve(previousCanvas);
  panel.classList.toggle('finish-sheet', finished);
  if (finished) {
    const next = lessons[(lessons.indexOf(lesson) + 1) % lessons.length];
    panel.innerHTML = `
      <div class="finish-icon">${icon('sparkle')}</div>
      <h2 class="finish-title" tabindex="-1">You drew it!</h2>
      <p>${lesson.title} is in your sketchbook.</p>
      <div class="coach-box">
        <strong>Give it a twist</strong>
        <p id="remix" aria-live="polite">${coachLessonIdeas[lesson.id]}</p>
        <button class="quiet" data-action="remix">${icon('sparkle')} Another idea</button>
      </div>
      <div class="finish-actions">
        <a class="primary" href="#draw/${next.id}">Draw ${next.title.toLowerCase()}</a>
        <button class="secondary" data-action="keep-drawing">Keep drawing</button>
        <a class="quiet" href="#sketchbook">Sketchbook</a>
      </div>`;
    return;
  }
  const [title, instruction, guidance, hint] = lesson.steps[data.step];
  panel.innerHTML = `
    <div class="step-progress">
      <span class="step-count">Step ${data.step + 1} of ${lesson.steps.length}</span>
      <div class="step-tabs" aria-label="Lesson steps">
        ${lesson.steps.map(([name], index) => `<button type="button" class="${index < data.step ? 'is-past' : ''}" data-action="step-${index}" aria-label="Step ${index + 1}, ${name}" ${index === data.step ? 'aria-current="step"' : ''}>${index + 1}</button>`).join('')}
      </div>
    </div>
    <button class="demo" type="button" data-action="replay" aria-label="Replay stroke" title="Replay stroke" ${data.drawingMode === 'paper' ? 'hidden' : ''}>
      <canvas id="step-example" aria-hidden="true"></canvas>
      <span class="replay" aria-hidden="true">${icon('play')}</span>
    </button>
    <h2 class="step-heading" tabindex="-1">${title}</h2>
    <p class="step-text">${instruction}</p>
    <details class="hint"><summary>Pencil tip</summary><p>${guidance}</p><p>${hint}</p></details>
    <div class="step-actions">
      <button type="button" class="secondary" data-action="back" ${data.step === 0 ? 'disabled' : ''}>Back</button>
      <button type="button" class="primary" data-action="next">${data.step === lesson.steps.length - 1 ? 'Finish drawing' : 'Next step'}</button>
    </div>`;
  observer.observe(document.querySelector('#step-example'));
}

function redrawDemo() {
  if (!session) return;
  const { data, lesson, finished, guide, progress } = session;
  if (data.drawingMode === 'paper') {
    const step = finished ? lesson.steps.length - 1 : data.step;
    drawExample(guide, lesson, step, { teaching: !finished, progress, scale: 1.1 });
    return;
  }
  const canvas = document.querySelector('#step-example');
  if (canvas) drawExample(canvas, lesson, data.step, { teaching: true, progress });
}

function redrawReferences() {
  if (!session) return;
  const { lesson, data, finished, guide } = session;
  if (data.drawingMode !== 'paper') {
    drawExample(guide, lesson, data.drawingMode === 'trace' && !finished ? data.step : -1, { guide: true });
  }
  redrawDemo();
}

function playDemo() {
  cancelAnimationFrame(session.animation);
  session.progress = 1;
  if (session.finished || reducedMotion.matches) {
    redrawDemo();
    return;
  }
  const active = session;
  const start = performance.now();
  function frame(now) {
    if (session !== active || active.finished) return;
    active.progress = Math.min(1, Math.max(0, (now - start) / active.duration));
    redrawDemo();
    if (active.progress < 1) active.animation = requestAnimationFrame(frame);
  }
  active.progress = 0;
  redrawDemo();
  active.animation = requestAnimationFrame(frame);
}

function updateTools() {
  const { data, tool, redo } = session;
  const paper = data.drawingMode === 'paper';
  const setPressed = (action, pressed) => main.querySelector(`[data-action="${action}"]`).setAttribute('aria-pressed', String(pressed));
  main.querySelector('.studio-grid').classList.toggle('is-paper', paper);
  const demo = main.querySelector('.demo');
  if (demo) demo.hidden = paper;
  main.querySelector('.board-replay').hidden = !paper || session.finished;
  setPressed('pencil', tool === 'pencil');
  setPressed('eraser', tool === 'eraser');
  main.querySelector('[data-action="undo"]').disabled = !data.strokes.length;
  main.querySelector('[data-action="redo"]').disabled = !redo.length;
  main.querySelector('[data-action="clear"]').disabled = !data.strokes.length;
  main.querySelector('[data-action="save"]').disabled = paper || !data.strokes.some(stroke => stroke.tool === 'pencil');
  session.canvas.hidden = paper;
  session.canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
  main.querySelector('.board-head').hidden = paper;
  main.querySelector('.board-foot').hidden = paper;
}

function setStep(index) {
  if (index < 0 || index >= session.lesson.steps.length || index === session.data.step) return;
  session.data.step = index;
  persist();
  renderPanel();
  redrawReferences();
  playDemo();
  main.querySelector('.step-heading').focus({ preventScroll: true });
}

function finishLesson() {
  session.data.completed = Date.now();
  persist();
  session.finished = true;
  history.replaceState(null, '', `#done/${session.lesson.id}`);
  cancelAnimationFrame(session.animation);
  renderPanel();
  updateTools();
  redrawReferences();
  main.querySelector('.finish-title').focus({ preventScroll: true });
}

function keepDrawing() {
  session.finished = false;
  history.replaceState(null, '', `#draw/${session.lesson.id}`);
  renderPanel();
  updateTools();
  redrawReferences();
  playDemo();
  main.querySelector('.step-heading').focus({ preventScroll: true });
}

function studioClick(event) {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!session || !action) return;
  if (action.startsWith('step-')) {
    setStep(Number(action.slice(5)));
  } else {
    const actions = {
      pencil: () => { session.tool = 'pencil'; updateTools(); },
      eraser: () => { session.tool = 'eraser'; updateTools(); },
      undo: () => undoOrRedo(false),
      redo: () => undoOrRedo(true),
      clear: () => {
        const dialog = main.querySelector('dialog');
        dialog.returnValue = 'cancel';
        dialog.showModal();
      },
      save: savePng,
      replay: playDemo,
      back: () => setStep(session.data.step - 1),
      next: () => {
        const next = session.data.step + 1;
        if (next === session.lesson.steps.length) finishLesson();
        else setStep(next);
      },
      remix: () => {
        const ideas = coachIdeas[session.lesson.category];
        document.querySelector('#remix').textContent = ideas[session.remix++ % ideas.length];
      },
      'keep-drawing': keepDrawing,
    };
    actions[action]?.();
  }
}

function penPoint(event, bounds) {
  const x = Math.round((event.clientX - bounds.left) * width / bounds.width);
  const y = Math.round((event.clientY - bounds.top) * height / bounds.height);
  const pressure = event.pointerType === 'pen' && event.pressure > 0 ? event.pressure : 0.48;
  return [x, y, Math.round(pressure * 100)];
}

function startStroke(event) {
  if (!session || event.button !== 0 || (pencilOnly && event.pointerType !== 'pen')) return;
  if (session.stroke) {
    if (event.pointerType !== 'pen' || session.pointerType !== 'touch') return;
    // A Pencil that arrives while a palm is resting on the canvas takes over.
    discardStroke();
  }
  event.preventDefault();
  const { canvas } = session;
  const bounds = canvas.getBoundingClientRect();
  session.pointer = event.pointerId;
  session.pointerType = event.pointerType;
  session.stroke = { tool: session.tool, points: [penPoint(event, bounds)] };
  canvas.setPointerCapture(event.pointerId);
  drawStroke(canvas.getContext('2d'), session.stroke);
}

function moveStroke(event) {
  if (!session?.stroke || event.pointerId !== session.pointer) return;
  event.preventDefault();
  const { canvas, stroke } = session;
  const ctx = canvas.getContext('2d');
  const bounds = canvas.getBoundingClientRect();
  const coalesced = event.getCoalescedEvents?.();
  const events = coalesced?.length ? coalesced : [event];
  for (const move of events) {
    const previous = stroke.points.at(-1);
    const point = penPoint(move, bounds);
    if (Math.hypot(point[0] - previous[0], point[1] - previous[1]) < 1.6) continue;
    stroke.points.push(point);
    paintSegment(ctx, stroke.tool, previous, point);
  }
}

function endStroke(event) {
  if (!session?.stroke || (event && event.pointerId !== session.pointer)) return;
  if (event?.type === 'pointercancel' && session.pointerType === 'touch') {
    discardStroke();
    return;
  }
  session.data.strokes.push(session.stroke);
  session.stroke = null;
  session.pointer = null;
  session.redo = [];
  updateTools();
  persist();
}

function discardStroke() {
  session.stroke = null;
  session.pointer = null;
  repaintInk();
}

function paintSegment(ctx, tool, from, to) {
  const erasing = tool === 'eraser';
  const pressure = (from[2] + to[2]) / 200;
  const thickness = erasing ? 27 : 1.6 + 5.5 * pressure;
  ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
  const tone = Math.round(128 - 82 * pressure);
  ctx.strokeStyle = erasing ? '#000' : `rgb(${tone}, ${tone}, ${tone - 5})`;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineCap = 'round';
  ctx.lineWidth = thickness;
  ctx.beginPath();
  if (from === to) {
    ctx.arc(to[0], to[1], thickness / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawStroke(ctx, stroke) {
  const [first] = stroke.points;
  if (!first) return;
  paintSegment(ctx, stroke.tool, first, first);
  for (let index = 1; index < stroke.points.length; index += 1) {
    paintSegment(ctx, stroke.tool, stroke.points[index - 1], stroke.points[index]);
  }
}

function repaintInk() {
  if (!session || session.data.drawingMode === 'paper') return;
  const { canvas, data, stroke } = session;
  const ratio = Math.min(2.5, devicePixelRatio || 1);
  const newWidth = Math.round(canvas.clientWidth * ratio);
  const newHeight = Math.round(canvas.clientHeight * ratio);
  if (!newWidth || !newHeight) return;
  if (canvas.width !== newWidth) canvas.width = newWidth;
  if (canvas.height !== newHeight) canvas.height = newHeight;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(newWidth / width, 0, 0, newHeight / height, 0, 0);
  ctx.clearRect(0, 0, width, height);
  data.strokes.forEach(mark => drawStroke(ctx, mark));
  if (stroke) drawStroke(ctx, stroke);
}

function paintThumbnail(canvas, strokes) {
  const ratio = Math.min(2.5, devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
  canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  const ctx = canvas.getContext('2d');
  const scale = Math.min(canvas.width / width, canvas.height / height);
  ctx.setTransform(scale, 0, 0, scale, (canvas.width - width * scale) / 2, (canvas.height - height * scale) / 2);
  strokes.forEach(stroke => drawStroke(ctx, stroke));
}

function undoOrRedo(redo) {
  if (!session || session.data.drawingMode === 'paper' || session.stroke) return;
  const { data } = session;
  const from = redo ? session.redo : data.strokes;
  const to = redo ? data.strokes : session.redo;
  if (!from.length) return;
  to.push(from.pop());
  repaintInk();
  updateTools();
  persist();
}

function savePng() {
  const drawing = document.createElement('canvas');
  drawing.width = 1600;
  drawing.height = 1104;
  const ink = document.createElement('canvas');
  ink.width = drawing.width;
  ink.height = drawing.height;
  const inkContext = ink.getContext('2d');
  inkContext.scale(1.6, 1.6);
  session.data.strokes.forEach(stroke => drawStroke(inkContext, stroke));
  const ctx = drawing.getContext('2d');
  ctx.fillStyle = '#fffdf7';
  ctx.fillRect(0, 0, drawing.width, drawing.height);
  ctx.drawImage(ink, 0, 0);
  const name = `${session.lesson.id}-sketch.png`;
  drawing.toBlob(blob => {
    if (!blob) { showNotice('Could not create a PNG. Try Save again.'); return; }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }, 'image/png');
}

document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
document.querySelectorAll('[data-icon-label]').forEach(element => { element.insertAdjacentHTML('afterbegin', icon(element.dataset.iconLabel)); });
main.addEventListener('click', studioClick);
window.addEventListener('hashchange', render);
window.addEventListener('pagehide', () => { if (session?.stroke) endStroke(); });
window.addEventListener('keydown', event => {
  if (!session || event.key.toLowerCase() !== 'z' || !(event.metaKey || event.ctrlKey)) return;
  event.preventDefault();
  undoOrRedo(event.shiftKey);
});
render();
