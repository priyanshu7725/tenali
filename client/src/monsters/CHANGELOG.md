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
