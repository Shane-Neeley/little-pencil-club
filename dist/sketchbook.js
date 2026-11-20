'use strict';

function sketchbookCard(lesson) {
  const card = previewCard(lesson, true);
  if (!dataFor(lesson).strokes.some(stroke => stroke.tool === 'pencil')) return card;
  return `<div class="ink-card">
    ${card}
    <div class="ink-actions" role="group" aria-label="${lesson.title} drawing">
      <button type="button" class="quiet" data-book-wiggle aria-label="Wiggle your ${lesson.title} drawing">Wiggle</button>
      <button type="button" class="quiet" data-book-png="${lesson.id}" aria-label="Save your ${lesson.title} drawing as a PNG">Save PNG</button>
    </div>
  </div>`;
}

function progressFileControls(hasProgress) {
  return `<details class="progress-files">
    <summary>Move lesson progress</summary>
    <p>Take your finished-lesson checkmarks to another device. Save the file, then open it in the other Sketchbook. Drawings stay here.</p>
    <div class="progress-file-actions">
      <button type="button" class="secondary" data-export-progress ${hasProgress ? '' : 'disabled'}>Save progress file</button>
      <button type="button" class="secondary" data-import-progress>Open progress file</button>
      <input type="file" accept=".json,application/json" hidden>
    </div>
    <p class="import-status" role="status"></p>
  </details>`;
}

function restoreSketchbookFocus(previous) {
  if (!previous || previous.isConnected) return;
  if (previous.matches('.lesson-card')) {
    const lesson = CSS.escape(previous.querySelector('canvas').dataset.lesson);
    main.querySelector(`canvas[data-lesson="${lesson}"]`)?.closest('a')?.focus({ preventScroll: true });
    return;
  }
  if (previous.matches('[data-book-wiggle], [data-book-png]')) {
    const label = CSS.escape(previous.getAttribute('aria-label'));
    main.querySelector(`button[aria-label="${label}"]`)?.focus({ preventScroll: true });
    return;
  }
  const control = ['.progress-files summary', '[data-import-progress]', '[data-export-progress]', '.empty-book a']
    .find(selector => previous.matches(selector));
  if (control) main.querySelector(control)?.focus({ preventScroll: true });
}

function setupSketchbook() {
  const grid = main.querySelector('.card-grid');
  grid?.addEventListener('click', event => {
    if (event.target.closest('[data-book-wiggle]')) {
      wiggleDrawing(event.target.closest('.ink-card').querySelector('canvas'));
    }
    const exportButton = event.target.closest('[data-book-png]');
    if (exportButton) {
      const lesson = lessonById.get(exportButton.dataset.bookPng);
      savePng(lesson, dataFor(lesson).strokes);
    }
  });

  const panel = main.querySelector('.progress-files');
  const picker = panel.querySelector('input');
  panel.querySelector('[data-export-progress]').addEventListener('click', () => {
    const completed = lessons.filter(lesson => dataFor(lesson).completed).map(lesson => lesson.id);
    const file = { format: 'little-pencil-club-progress', version: 1, completed };
    downloadBlob(new Blob([JSON.stringify(file)], { type: 'application/json' }), 'little-pencil-progress.json');
  });
  panel.querySelector('[data-import-progress]').addEventListener('click', () => picker.click());
  picker.addEventListener('change', async () => {
    const file = picker.files[0];
    picker.value = '';
    if (!file) return;
    let saved = 0;
    let unknown = 0;
    try {
      if (file.size > 128 * 1024) throw new Error();
      const backup = JSON.parse(await file.text());
      if (backup?.format !== 'little-pencil-club-progress' || backup.version !== 1 ||
          !Array.isArray(backup.completed) || !backup.completed.every(id => typeof id === 'string')) throw new Error();
      let writeFailed = false;
      for (const id of new Set(backup.completed)) {
        const lesson = lessonById.get(id);
        if (!lesson) { unknown++; continue; }
        const data = dataFor(lesson);
        if (data.completed) continue;
        // A separate marker preserves drawings, active steps, and creative choices across tabs.
        if (!saveStorage('finished/' + id, true)) { writeFailed = true; break; }
        data.completed = 1;
        saved++;
      }
      if (location.hash.split('/')[0] !== '#sketchbook') return;
      const current = main.querySelector('.progress-files');
      if (!current || (current !== panel && !saved)) return;
      const isOriginalPanel = current === panel;
      const lastView = isOriginalPanel ? null : {
        focus: document.activeElement,
        open: current.open,
        status: current.querySelector('.import-status').textContent,
        top: window.scrollY,
        left: window.scrollX,
      };
      render();
      const updated = main.querySelector('.progress-files');
      if (lastView) {
        updated.open = lastView.open;
        updated.querySelector('.import-status').textContent = lastView.status;
        restoreSketchbookFocus(lastView.focus);
        window.scrollTo({ top: lastView.top, left: lastView.left, behavior: 'instant' });
        return;
      }
      updated.open = true;
      const status = updated.querySelector('.import-status');
      const restored = saved === 1 ? '1 checkmark added.' : `${saved} checkmarks added.`;
      status.textContent = writeFailed ? `${restored} This browser could not save the rest. Try opening the file again.`
        : `${restored}${unknown ? ' Some lessons in this file aren’t available here.' : ''}`;
      updated.querySelector('[data-import-progress]').focus();
    } catch {
      panel.querySelector('.import-status').textContent = 'Choose a progress file saved from Little Pencil Club.';
    }
  });
}
