// The demo runs the app's real highlight model: a discrete "which word is being
// sung now", with timings synthesized from line timing by the same floor-then-
// weight split the app uses. It is not a mock of the effect, it is the effect.

const LINES = [
  { t: 0, text: 'I have been here before' },
  { t: 2600, text: 'but always as a stranger' },
  { t: 5900, text: 'the same room, a different light' },
  { t: 9600, text: 'and nothing in it holds still' },
  { t: 13800, text: 'long enough to name' },
];

const LOOP_MS = 17600;
const MIN_WORD_MS = 90;
const MAX_LINE_MS = 8000;

/**
 * Give every word the floor first, then share the surplus by character weight.
 * Weighting first and clamping afterwards overruns the line end on any line
 * mixing very long and very short words -- the app learned this the hard way.
 */
function splitWords(text, startMs, endMs) {
  const tokens = text.split(' ');
  const duration = Math.max(endMs - startMs, MIN_WORD_MS * tokens.length);
  const surplus = duration - MIN_WORD_MS * tokens.length;
  const weights = tokens.map((t) => t.length + 1);
  const total = weights.reduce((a, b) => a + b, 0);

  let cursor = startMs;
  return tokens.map((token, i) => {
    const slice = MIN_WORD_MS + (weights[i] / total) * surplus;
    const start = cursor;
    const end = i === tokens.length - 1 ? startMs + duration : cursor + slice;
    cursor = end;
    return { token, start, end };
  });
}

const model = LINES.map((line, i) => {
  const nextStart = i + 1 < LINES.length ? LINES[i + 1].t : LOOP_MS;
  const end = Math.min(nextStart, line.t + MAX_LINE_MS);
  return { ...line, end, words: splitWords(line.text, line.t, end) };
});

const stage = document.getElementById('stage');
if (stage) {
  const rendered = model.map((line) => {
    const p = document.createElement('p');
    p.className = 'line';
    const spans = line.words.map((w, i) => {
      const s = document.createElement('span');
      s.className = 'word';
      s.textContent = i === line.words.length - 1 ? w.token : `${w.token} `;
      p.appendChild(s);
      return s;
    });
    stage.appendChild(p);
    return { line, el: p, spans };
  });

  let mode = 'word';
  const buttons = document.querySelectorAll('.modes button');
  for (const button of buttons) {
    button.addEventListener('click', () => {
      mode = button.dataset.mode;
      for (const other of buttons) {
        other.setAttribute('aria-pressed', String(other === button));
      }
    });
  }

  const started = performance.now();
  let activeIndex = -1;
  let currentWord = -1;

  const frame = (now) => {
    const t = (now - started) % LOOP_MS;

    let active = 0;
    for (let i = 0; i < model.length; i += 1) if (model[i].t <= t) active = i;

    // Only touch the DOM when something actually changes -- a few times a
    // second, not sixty. Same rule the overlay follows.
    if (active !== activeIndex) {
      if (activeIndex >= 0) rendered[activeIndex].el.removeAttribute('data-state');
      rendered[active].el.dataset.state = 'active';
      if (currentWord >= 0 && activeIndex >= 0) {
        rendered[activeIndex].spans[currentWord]?.removeAttribute('data-current');
      }
      activeIndex = active;
      currentWord = -1;
    }

    for (const { el } of rendered) el.dataset.mode = mode;

    if (mode === 'word') {
      const { words } = model[active];
      let index = -1;
      for (let i = 0; i < words.length; i += 1) {
        if (t >= words[i].start && t < words[i].end) {
          index = i;
          break;
        }
      }
      if (index !== currentWord) {
        if (currentWord >= 0) rendered[active].spans[currentWord]?.removeAttribute('data-current');
        if (index >= 0) rendered[active].spans[index].dataset.current = 'true';
        currentWord = index;
      }
    } else if (currentWord >= 0) {
      rendered[active].spans[currentWord]?.removeAttribute('data-current');
      currentWord = -1;
    }

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}
