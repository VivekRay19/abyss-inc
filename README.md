# ABYSS INC. — The Ocean Is Not for Sale

A single-player 3D environmental strategy and interactive adventure game built with **Three.js** and **Vite**.

> **Core Message:** *You can change the rules of your business, but you cannot change the laws of nature.*

---

## Overview

In **ABYSS INC.**, you establish a deep-sea mining company, configure three starting business parameters, deploy the **TRITON-IX** mining crawler from your industrial vessel, witness real-time ecological damage, enact **two permanent in-campaign rule changes**, clean organic floating oil slicks on the ocean surface, and restore damaged coral reefs through interactive sediment scrubbing and a water-flow logic puzzle.

Once the introductory story is completed (**TUTORIAL COMPLETE!**), click **CONTINUE OPERATIONS** to keep playing in persistent **Ongoing Operations** mode—freely diving (`[F]`) and surfacing (`[F]`), mining remaining seabed deposits, selling ore, and upgrading your vessel and crawler.

For complete rules and mechanics, see [RULEBOOK.md](./RULEBOOK.md).

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

## Single-Player Controls

- **Steer Boat / Drive Crawler / Swim Diver:** `W` `A` `S` `D` or Arrow Keys
- **Dive to Ocean Floor / Return to Surface:** `F`
- **Interact (Mine Ore / Skim Oil / Restore Reef):** `E`
- **Offload Ore / Empty Skimmer Tank:** `R`
- **Diver Swim Up / Down:** `Space` / `Shift`

---

## Testing Instructions

Run the automated navigation, tutorial-continuation, single-player, and puzzle verification suite:
```bash
node tests/verifyGameLogic.mjs
```

See [PLAYTEST_PLAN.md](./PLAYTEST_PLAN.md) and [PLAYTEST_LOG.md](./PLAYTEST_LOG.md) for structured test scenarios and verification logs.
