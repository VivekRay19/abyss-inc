# ABYSS INC. — The Ocean Is Not for Sale

A streamlined 3D environmental strategy and interactive adventure game built with **Three.js** and **Vite**.

> **Core Message:** *You can change the rules of your business, but you cannot change the laws of nature.*

---

## Overview

In a focused 5–10 minute session, players establish a deep-sea mining company, configure three starting business parameters, deploy a compact mining machine to the ocean floor, witness real-time ecological damage, enact **two permanent in-campaign rule changes**, clean floating oil pollution on the ocean surface, negotiate a restoration budget in **Single-Player or Local Co-op**, and dive as a human diver to scrub coral and solve a water-flow logic puzzle.

For full rules, roles, and mechanics, see [RULEBOOK.md](./RULEBOOK.md).

---

## How to Run

### Prerequisites
- Node.js 18+

### Development Server
```bash
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### Production Build
```bash
npm run build
npm run preview
```

---

## Controls

- **Move (Boat / Mining Machine / Diver):** `W` `A` `S` `D` (or Arrow Keys in Single-Player)
- **Diver Up / Down:** `Space` / `Shift`
- **Interact (Mine / Skim Oil / Restore Reef):** `E`
- **Return to Boat / Empty Skimmer Tank:** `R`
- **Co-op Player 2 (Marine Scientist):** Arrow Keys + `Q` (Ecological Scan)

---

## Testing Instructions

Run the automated logic & puzzle verification suite:
```bash
node tests/verifyGameLogic.mjs
```

See [PLAYTEST_PLAN.md](./PLAYTEST_PLAN.md) and [PLAYTEST_LOG.md](./PLAYTEST_LOG.md) for structured human playtesting scenarios and verification logs.
