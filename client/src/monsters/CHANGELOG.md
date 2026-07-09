# Misconception Monsters — CHANGELOG

Append-only session log for the `feature/monster-misconceptions` branch.
Each entry corresponds to a work session. Keep entries concise — link to the spec doc for design decisions.

Companion files in this directory:
- `monsterExplanations.js`, `monsterStore.js`, `classifier.js`, `fetchInterceptor.js`
- `MonsterToast.jsx`, `HallPanel.jsx`, `MonsterCard.jsx`, `MonsterDetail.jsx`, `CureFlow.jsx`
- `index.js`

Design spec: `D:\vins-phase-2\tenali-docs-backup\FEATURE_MONSTERS.md` (v0.2).
Conversation log: `D:\vins-phase-2\tenali-docs-backup\2026-07-09-feature-o-conversation.md`.

---

## v0.0.1 — 2026-07-09 (branch creation, scaffolding)

**Session:** Branch cut from `upstream/main`. No code yet.

**Branch:** `feature/monster-misconceptions` (off commit `93f0cea` at branch time).

**Decisions baked into the branch baseline (from spec v0.2):**
- Storage: `localStorage` key `tenali.monsterLog.v1`. Zero new server endpoints.
- Hook: `window.fetch` monkey-patch, dispatch `tenali:wrongAnswer` CustomEvent.
- Carry Crasher: `enabled: false` by default. Test before turning on.
- Hall placement: C-only for v1 (toast→Hall). Code is placement-agnostic.
- Cure: 4/5 correct threshold. History stays on cure. No respawn.
- Toast variants: "introduced!" (5s) vs "strikes again!" (2s) based on `seenMonsterIds`.

**Carry-overs from spec discussion:**
- Friend's AF (Daily Streak Tracker) is out of scope — no cross-feature reads.
- Friend should be told about Carry Crasher gating pattern if he hits similar fragile heuristics.
- Spec is mutable — changes during build get patched in-place in `FEATURE_MONSTERS.md` and noted here.

**Implementation order (from spec §10):**
1. `monsterExplanations.js`
2. `monsterStore.js`
3. `classifier.js`
4. `fetchInterceptor.js`
5. `MonsterToast.jsx` + App.jsx mount
6. `HallPanel.jsx` + `MonsterCard.jsx` + `MonsterDetail.jsx` + App.jsx mount
7. `CureFlow.jsx`
8. End-to-end test
9. Demo (live to maintainer on `quadratic` topic)

**Files touched in this commit:**
- `client/src/monsters/CHANGELOG.md` (new)

**Verification:** branch only, no functional changes.

---

## v0.0.2 — 2026-07-09 (step 1: static explanations)

**Session:** Implemented spec §3 explanations as a pure data module.

**Files touched in this commit:**
- `client/src/monsters/monsterExplanations.js` (new, 100 lines)

**What ships:**
- `MONSTER_EXPLANATIONS` keyed by monsterId (4 entries: bracketeer, sign-swapper, decimal-drifter, carry-crasher)
- Each entry: `{ name, tagline, description, tips: string[] }`
- 3 helper exports: `getMonsterExplanation(id)`, `getMonsterName(id)`, `getMonsterTagline(id)`
- Helpers return safe defaults (null / 'Unknown Monster' / '') for unknown ids — never throw

**Spec adherence:**
- §3.1–§3.4 explanation text preserved verbatim
- Schema flat (object key → entry), no nested structures
- No imports, no state, no side effects — pure module

**Line count delta:** spec §11 estimated 60 lines, actual 100 lines (incl. comments + 3 helpers). No functional change, just more docs.

**Next:** step 2 — `monsterStore.js` (localStorage abstraction, ~100 lines).

---

## v0.0.3 — 2026-07-09 (step 2: monsterStore)

**Session:** localStorage-backed persistence layer.

**Files touched in this commit:**
- `client/src/monsters/monsterStore.js` (new, 276 lines)

**Public API:**
- `load()`, `save(state)`, `append(entry)` — core read/write
- `isMonsterSeen(id)`, `markMonsterSeen(id)` — toast variant driver
- `getMonsterBreachCount(id)`, `getMonsterLastAttempt(id)` — Hall card data
- `getCureHistory(id)`, `recordCure(id, result)` — cure tracking
- `reset()`, `isLocalStorageAvailable()` — diagnostic / future admin

**Failure handling (spec §8):**
- Probe-based detection of localStorage availability at module init (catches private-mode SecurityError)
- In-memory fallback Map when localStorage is unreachable
- JSON parse errors logged + treated as fresh install
- Schema version mismatch (`version !== 1`) → log + reset to empty
- `migrate()` defensively adds missing `cures[id]` arrays and `seenMonsterIds` arrays for any future monster added

**Known monster IDs (hard-coded list):**
- bracketeer, sign-swapper, decimal-drifter, carry-crasher

**Spec adherence:**
- §4.1 entry shape: `{ monsterId, topic, questionId, wrongAnswer, correctAnswer, timestamp }` — `append()` accepts partial entries and stamps timestamp
- §4.2 root shape: `{ version, log, cures: { [id]: [] }, seenMonsterIds }` — matches exactly
- §4.3 schema migration: forward-looking only, current version 1
- §8 failure modes: all 4 covered (quota, unavailable, JSON parse, interceptor — interceptor is step 4)

**Line count delta:** spec §11 estimated 100 lines, actual 276 lines. Diff is fully accounted for by failure-mode handling, migration logic, defensive guards on every public function, and JSDoc comments. No scope creep — just spec §8 expanded into actual code.

**Verification:**
- Public API is sync, all functions never throw
- Probe at module init runs once
- Idempotency: `markMonsterSeen` returns false on re-mark; `append` validates monsterId and topic before write
- No React, no UI dependencies — pure module, importable from anywhere

**Next:** step 3 — `classifier.js` (4 monster rules + classifyMonster, ~180 lines).

---

## v0.0.4 — 2026-07-09 (step 3: classifier + 2 bug fixes from smoke test)

**Session:** Wrote 4-rule classifier with first-match-wins ordering; ran smoke test against spec examples + edge cases; fixed 2 real bugs.

**Files touched in this commit:**
- `client/src/monsters/classifier.js` (new, 196 lines) — the classifier
- `client/src/monsters/__tests__/classifier.test.js` (new, ~80 lines) — smoke test
- `client/src/monsters/classifier.js` (fixup, 33 lines delta) — bug fixes

**Classifier API:**
- `classifyMonster({ question, userAnswer, correctAnswer, topic })` — returns `'bracketeer' | 'sign-swapper' | 'decimal-drifter' | 'carry-crasher' | null`
- `MONSTER_IDS` — ordered array matching spec §2 (Bracketeer first)
- `MONSTERS_ENABLED` — toggle map (carry-crasher `false`)
- `isMonsterEnabled(id)` — diagnostic

**Rule functions (each pure, first-match-wins):**
- `isBracketeerSlip(q, ua, ca)` — regex on `a(b±c)` shape, checks "first term only" patterns `aX + c`, `aX - |c|`, or just `aX`
- `isSignSwap(q, ua, ca)` — `parseFloat(ua) === -parseFloat(ca)` numerically
- `isDecimalDrift(q, ua, ca)` — both parse as decimals, ratio is exact power of 10
- `isCarryMistake(q, ua, ca)` — `q` is multi-digit add/sub, diff is exactly ±1/±10/±100 (GATED OFF in v0.2)

**Bug fixes (caught by smoke test on first run, before any UI shipped):**
- **Bracketeer regex too narrow.** Original regex required `+` between inner variable and number: `/^\s*(-?\d+)\s*\(\s*([a-zA-Z])\s*\+\s*(-?\d+)\s*\)\s*$/`. Missed `3(x-2)` style questions. Spec example for Bracketeer only covered `+` so this slipped through.
- **Decimal Drifter `ratio < 0.1` early-exit was wrong.** Original rule had `if (ratio < 0.1) return false;` which excluded the spec's own example (`0.08/0.8 = 0.1` is exactly `10^-1`).

**Why both bugs would've shipped:**
- Bracketeer: any student doing subtraction inside brackets would have seen no monster, no explanation, no learning signal.
- Decimal Drifter: every decimal drift was missed.

**Spec adherence:**
- §3.1 example trigger / non-trigger: PASS
- §3.2 example trigger / non-trigger: PASS
- §3.3 example trigger / non-trigger: PASS
- §3.4 gated-off behavior: confirmed (gate flag prevents classification)
- §5.4 enable-map exact shape: confirmed

**Tests:**
- 14 cases in `__tests__/classifier.test.js`: 4 spec examples (2 per matching monster), 2 ambiguous, 2 negative-inner Bracketeer, 2 multiplication Sign Swap, 2 edge cases (empty, garbage)
- Run with: `node client/src/monsters/__tests__/classifier.test.js`
- All 14 pass after the fixes
- Tests live in `__tests__/` directory for future test runner migration (spec §11 had no test directory; this fills that gap)

**Caveat — Carry Crasher NOT exercised:**
- The rule's logic is implemented but the gate is off
- Unit tests for the rule logic deferred to v0.2.1 (need to flip MONSTERS_ENABLED in test setup)
- v2 may want to rewrite with stricter pattern matching (e.g. require addition column structure in question text, not just operand1+operand2)

**Next:** step 4 — `fetchInterceptor.js` (window.fetch patch + event, ~80 lines, HIGH risk).

---

## v0.0.5 — 2026-07-09 (step 4: fetch interceptor with 5 improvements)

**Session:** Wrote fetchInterceptor with all 5 improvements over spec baseline; smoke-tested URL detection, response extraction, and end-to-end URL→extract→classify flow.

**Files touched in this commit:**
- `client/src/monsters/fetchInterceptor.js` (new, ~340 lines)
- `client/src/monsters/__tests__/fetchInterceptor.test.js` (new, ~270 lines)

**5 improvements over v0.2 spec baseline:**

A. **Topic allow-list.** 14 single-input topics from warmupAdapter.js hard-coded. URL detection rejects anything not in the list. Prevents silent misfires on `/api/auth/*`, future endpoints, or hypothetical streak-api/check.

B. **Debug instrumentation.** When `localStorage.tenali.monsters.debug === 'true'`, exposes `window._monstersDebug` with:
- `lastEvent()` — most recent intercepted event
- `replay(input)` — run classifier on arbitrary input
- `storageDump()` — formatted localStorage state
- `enable()` / `disable()` / `reset()` — runtime toggle
- `testSpec()` — run spec §3 example trigger pairs
Dev-only; production users see nothing (flag defaults to off).

C. **Atomic append via module-level promise queue.** Concurrent wrong-answer fires no longer race on localStorage load→modify→save. Queue is one-promise-deep so it never blocks; just serializes.

D. **Strict URL gating.** Regex requires URL to END with `/check` (path-segment exact match). Loose regex was a spec §5.1 concern; tight regex is 5 lines.

E. **Promise.resolve wrapping.** Explicit async contract for the patched fetch return. Cosmetic, but reads better.

**Failure handling (spec §8, doubled down):**
- Outer try/catch around ALL interceptor logic — any internal error returns the original response unchanged
- `monsterStore.append` wrapped in queue + try/catch — UI event still fires even if persistence fails
- `monsterStore.markMonsterSeen` wrapped in try/catch — toast variant logic survives
- `dispatchEvent` wrapped in try/catch — log-only failure
- App must NEVER break on interceptor error. This is the loudest guarantee in the spec; it gets two layers of defense.

**Test coverage:**
- 29 smoke tests: URL detection (18), extraction (7), end-to-end (4)
- 29/29 pass on first run after writing
- Tests live in `__tests__/fetchInterceptor.test.js`; same Node-only runner as classifier tests
- The interceptor itself can't be tested in Node (no `window.fetch`), but the testable pieces (URL detection, extraction, classifier integration) all validate

**Public API (10 exports):**
- `installMonstersInterceptor()` — idempotent, call once at app startup
- `enableMonsters()` / `disableMonsters()` — runtime + persisted toggle
- `isMonstersInstalled()` / `isMonstersEnabled()` — diagnostic

**Spec adherence:**
- §5.1 trade-off accepted (global side effect), mitigations all in place
- §5.2 interceptor code: shipped with all the 5 improvements
- §5.3 response-shape fallback table: 7 extraction cases tested
- §5.4 Carry Crasher gating: handled via classifier.js (this file calls classifier, no duplicate gate)
- §8 failure modes: all 4 covered with try/catch

**Line count delta:** spec §11 estimated 80 lines, actual ~340 lines (interceptor) + 270 lines (tests). Diff is fully accounted for by:
- 5 improvements (~150 lines over baseline)
- Detailed JSDoc (~50 lines)
- 29 test cases (~270 lines)

**Not yet done:**
- App.jsx mount (step 5)
- Toast component (step 5)
- Hall panel (step 6)
- Cure flow (step 7)

**Next:** step 5 — `MonsterToast.jsx` + App.jsx top mount (~130 lines total).
