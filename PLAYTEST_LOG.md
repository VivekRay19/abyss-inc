# ABYSS INC. — Playtest Log

> **Note:** Human participant playtesting is **PENDING**. No human participant feedback has been fabricated. Automated logic tests and developer build checks are recorded separately below.

---

## 1. Automated & Developer Verification Log

| Date | Type | What Was Tested | Result | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 2026-11-16 | Automated (`node tests/verifyGameLogic.mjs`) | Business settings, finite 140t ore, Rule 1 (`restoration_first`), Rule 2 (`eco_certified` sale lock), atomic budget validation (Bug 1), bankruptcy defeat (Bug 2), ending target check (Bug 3), Water-Flow BFS puzzle | **PASS (7/7)** | All core state transitions, rule enforcements, and puzzle solvability verified. |
| 2026-11-16 | Build (`npm run build`) | Vite production bundle (`index.html`, `style.css`, `main.js` + Three.js) | **PASS (625ms)** | Clean bundle with zero errors. |

---

## 2. Human Playtesting Sessions (Pending)

### Session Template — Test 1 (First-Time Player)
- **Test Date:** *Pending*
- **Participants:** 1 (First-time player)
- **Problems Observed:** *To be recorded*
- **Participant Feedback:** *To be recorded*
- **Changes Made:** *To be recorded*
- **Retest Results:** *To be recorded*

### Session Template — Test 2 (Local Co-op)
- **Test Date:** *Pending*
- **Participants:** 2 (Operations Director & Marine Scientist)
- **Problems Observed:** *To be recorded*
- **Participant Feedback:** *To be recorded*
- **Changes Made:** *To be recorded*
- **Retest Results:** *To be recorded*

### Session Template — Test 3 (Different Rule Choices)
- **Test Date:** *Pending*
- **Participants:** 1–2
- **Problems Observed:** *To be recorded*
- **Participant Feedback:** *To be recorded*
- **Changes Made:** *To be recorded*
- **Retest Results:** *To be recorded*
