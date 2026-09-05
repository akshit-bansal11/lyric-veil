This project inherits every rule in ~/.claude/CLAUDE.md. Rules below add to or override it. Nothing here restates it.

- Reference ID: `yfu0idauhvj2nm9nkp0lcgkd7-x67ria0kfu`. Every commit carries it as a `Ref-ID:` trailer.
- Non-code facts live on the Notion project page, not in this repo. Do not create `STATE.md`, `DECISIONS.md`, `DRIFT.md`, `TECH-STACK.md` or `DIRECTORY-STRUCTURE.md` here.
- Quality gate is `npm run check` (biome format + organise imports + lint, then typecheck, then vitest).
- `electron-store` is pinned to v8 deliberately: v9+ is ESM-only and the main process builds to CJS.
- Never put `positionMs` in React state. The rAF loop writes it to a ref and to CSS custom properties. React state tracks only which line is active.
