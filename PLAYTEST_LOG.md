# ABYSS INC. — Playtest Log

> **Note:** External human participant playtesting is **PENDING**. Automated logic tests and developer build checks are recorded below.

---

## 1. Automated & Developer Verification Log

| Date | Type | What Was Tested | Result | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 2026-11-17 | Automated (`node tests/verifyGameLogic.mjs`) | 4 Starting Parameters across 2 configurations (`20T/50T/$2500/40T` vs `50T/150T/$4000/90T`), Fixed `$120K` Starting Credits vs parameters, separate `240T` Deposit Remaining, 3x Repeatable Dive/Surface cycles, 4 shuffled solvable puzzle variations & 4 distinct 3D coral outcomes, Back button state preservation, 2-Rule cap (rejects 3rd change), Simplified underwater UI (`E` & `F` only) | **PASS** | All checks passed with zero errors or warnings. |
| 2026-11-17 | Build (`npm run build`) | Vite production bundle (`index.html`, `style.css`, `main.js` + Three.js) | **PASS** | Clean production bundle generated in `dist/`. |
