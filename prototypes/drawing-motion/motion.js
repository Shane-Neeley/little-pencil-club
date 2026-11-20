'use strict';

function attachDrawingMotion(root) {
  const image = root.querySelector('[data-motion-image]');
  const play = root.querySelector('[data-motion-play]');
  const playLabel = root.querySelector('[data-motion-play-label]');
  const stop = root.querySelector('[data-motion-stop]');
  const status = root.querySelector('[data-motion-status]');
  const frames = root.querySelector('[data-motion-frames]');
  const effects = {
    wiggle: {
      name: 'Wiggle',
      poses: [
        ['Tilt left', 'rotate(-7deg)'],
        ['Center', 'rotate(0deg)'],
        ['Tilt right', 'rotate(7deg)'],
      ],
      sequence: [1, 0, 2, 0, 2, 1],
    },
    bounce: {
      name: 'Bounce',
      poses: [
        ['Start', 'translateY(0)'],
        ['Up', 'translateY(-9%)'],
        ['Land', 'translateY(0)'],
      ],
      sequence: [0, 1, 2, 1, 2],
    },
  };
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new AbortController();
  const { signal } = listeners;
  let animation;

  function selectedEffect() {
    return effects[root.querySelector('[data-motion-effect]:checked').value];
  }

  function cancelAnimation() {
    const current = animation;
    animation = undefined;
    current?.cancel();
    if (document.activeElement === stop) play.focus();
    stop.disabled = true;
  }

  function clearFrames() {
    frames.hidden = true;
    frames.replaceChildren();
  }

  function showStillFrames(effect) {
    const tiles = effect.poses.map(([label, transform]) => {
      const tile = document.createElement('figure');
      tile.className = 'pose';
      const view = document.createElement('img');
      view.src = image.src;
      view.alt = '';
      view.style.transform = transform;
      const caption = document.createElement('figcaption');
      caption.textContent = label;
      tile.append(view, caption);
      return tile;
    });
    frames.replaceChildren(...tiles);
    frames.setAttribute('aria-label', `${effect.name} still frames`);
    frames.hidden = false;
    status.textContent = `${effect.name} shown in still frames.`;
  }

  play.addEventListener('click', () => {
    cancelAnimation();
    clearFrames();
    const effect = selectedEffect();
    playLabel.textContent = 'Replay';
    if (motionPreference.matches || !image.animate) {
      showStillFrames(effect);
      return;
    }

    const keyframes = effect.sequence.map(index => ({ transform: effect.poses[index][1] }));
    const current = image.animate(keyframes, {
      duration: 1440,
      easing: 'ease-in-out',
      iterations: 1,
    });
    animation = current;
    stop.disabled = false;
    status.textContent = `Playing ${effect.name.toLowerCase()}.`;
    current.finished.then(() => {
      if (animation !== current) return;
      cancelAnimation();
      status.textContent = 'Ready to replay.';
    }, () => {
      // A newer playback or Stop canceled this run.
    });
  }, { signal });

  stop.addEventListener('click', () => {
    cancelAnimation();
    status.textContent = 'Stopped.';
  }, { signal });

  root.addEventListener('change', event => {
    if (!event.target.matches('[data-motion-effect]')) return;
    cancelAnimation();
    clearFrames();
    playLabel.textContent = 'Play';
    status.textContent = `${selectedEffect().name} selected.`;
  }, { signal });

  motionPreference.addEventListener('change', () => {
    if (motionPreference.matches && animation) {
      cancelAnimation();
      showStillFrames(selectedEffect());
    }
  }, { signal });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && animation) {
      cancelAnimation();
      status.textContent = 'Ready to replay.';
    }
  }, { signal });

  return () => {
    listeners.abort();
    cancelAnimation();
    clearFrames();
    playLabel.textContent = 'Play';
    status.textContent = 'Ready to play.';
  };
}

document.querySelectorAll('[data-motion-demo]').forEach(attachDrawingMotion);
