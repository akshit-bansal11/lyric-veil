# Lyric Veil — design brief

## Product
A transparent, click-through Windows overlay showing word-synced Spotify lyrics
on the desktop. Free, MIT, no telemetry. The microsite exists to explain it and
hand over a download.

## Identity
The product's own aesthetic is the design system: near-black ground, one text
colour at three strengths, and meaning carried entirely by the contrast between
a lit word and a dim one. The site reuses that, so the page and the app look
like the same thing.

- Ground `#0a0a0b`, ink `#f5f5f6`, accent amber `#f0b429`.
- Amber, not Spotify green: green is the category reflex for anything touching
  Spotify, and it would also imply an affiliation that does not exist.
- Type is the system font stack the app itself renders in — no web font, which
  also keeps the CSP at `'self'`.

## Constraints
- Static HTML/CSS/JS in `site/`, no build step, no external requests.
- CSP is `default-src 'self'` with `img-src` extended for `data:` only.
- Every claim on the page must be true of the shipped build.

## Fold classes used
- product-dominant — the running overlay, full bleed, cut by the fold's bottom
  edge. Measured dominance 3.85x against a reference median of 1.7x.
  `check_fold` classifies it as `band` because the five lyric lines are
  equal-height siblings; that is what the product is, so the reading is noted
  rather than designed around.
