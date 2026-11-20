'use strict';

function wiggleDrawing(image) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !image.animate) {
    image.classList.toggle('still-tilt');
    return;
  }
  image.classList.remove('still-tilt');
  image.getAnimations().forEach(animation => animation.cancel());
  const animation = image.animate([0, -5, 4, -2, 1, 0].map(angle => ({
    transform: `rotate(${angle}deg)`
  })), { duration: 850, easing: 'ease-in-out' });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const stop = () => animation.cancel();
  reduced.addEventListener('change', stop);
  animation.finished.catch(() => {}).finally(() => reduced.removeEventListener('change', stop));
}
