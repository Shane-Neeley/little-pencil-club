'use strict';

const lab = document.querySelector('[data-motion-lab]');
const labStatus = lab.querySelector('[data-lab-status]');
const gifImage = lab.querySelector('[data-gif-image]');
const gifActions = lab.querySelector('[data-gif-actions]');
const playGif = lab.querySelector('[data-gif-play]');
const stopGif = lab.querySelector('[data-gif-stop]');
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const localMessage = 'Use Wiggle or Bounce in the local player.';
let preparedGif;
let pending;
let timer;
let gifUrl;

function stopGifPlayback() {
  clearTimeout(timer);
  if (document.activeElement === stopGif) playGif.focus();
  gifImage.hidden = true;
  gifImage.removeAttribute('src');
  if (gifUrl) {
    URL.revokeObjectURL(gifUrl);
    gifUrl = undefined;
  }
  stopGif.disabled = true;
}

lab.querySelectorAll('[data-preview]').forEach(button => {
  button.addEventListener('click', async () => {
    pending?.abort();
    stopGifPlayback();
    gifActions.hidden = true;
    playGif.textContent = 'Play GIF';
    preparedGif = undefined;
    if (preference.matches) {
      labStatus.textContent = `Reduced motion is on. ${localMessage}`;
      return;
    }

    const controller = new AbortController();
    pending = controller;
    labStatus.textContent = 'Preparing the mock preview.';
    try {
      const response = await fetch(`/preview/${button.dataset.preview}`, {
        method: 'POST',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(1800)]),
      });
      if (!response.ok) throw new Error('No preview');
      const result = await response.json();
      if (pending !== controller || preference.matches) return;

      if (button.dataset.preview === 'preset' && result.kind === 'preset' && ['wiggle', 'bounce'].includes(result.preset)) {
        const option = document.querySelector(`[data-motion-effect][value="${result.preset}"]`);
        option.checked = true;
        option.dispatchEvent(new Event('change', { bubbles: true }));
        labStatus.textContent = 'Move selected. Tap Play in the local player.';
      } else if (button.dataset.preview === 'gif' && result.kind === 'gif' && typeof result.gif === 'string') {
        const decoded = Uint8Array.from(atob(result.gif), byte => byte.charCodeAt(0));
        preparedGif = new Blob([decoded], { type: 'image/gif' });
        gifActions.hidden = false;
        labStatus.textContent = 'Mock GIF ready.';
      } else {
        labStatus.textContent = `Preview unavailable. ${localMessage}`;
      }
    } catch {
      if (pending === controller) labStatus.textContent = `Preview unavailable. ${localMessage}`;
    } finally {
      if (pending === controller) pending = undefined;
    }
  });
});

playGif.addEventListener('click', () => {
  if (!preparedGif || preference.matches) return;
  stopGifPlayback();
  gifUrl = URL.createObjectURL(preparedGif);
  gifImage.src = gifUrl;
  gifImage.hidden = false;
  stopGif.disabled = false;
  playGif.textContent = 'Replay GIF';
  labStatus.textContent = 'Playing mock GIF.';
  timer = setTimeout(() => {
    stopGifPlayback();
    labStatus.textContent = 'Mock GIF ready.';
  }, 1440);
});

stopGif.addEventListener('click', () => {
  stopGifPlayback();
  labStatus.textContent = 'Mock GIF stopped.';
});

gifImage.addEventListener('error', () => {
  stopGifPlayback();
  gifActions.hidden = true;
  preparedGif = undefined;
  labStatus.textContent = `Preview unavailable. ${localMessage}`;
});

preference.addEventListener('change', () => {
  if (!preference.matches) return;
  pending?.abort();
  pending = undefined;
  stopGifPlayback();
  gifActions.hidden = true;
  preparedGif = undefined;
  labStatus.textContent = `Reduced motion is on. ${localMessage}`;
});
