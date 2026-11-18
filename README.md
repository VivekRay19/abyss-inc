# ABYSS INC. — The Ocean Is Not for Sale

A 3D environmental strategy and interactive adventure game featuring both **Single-Player** and **Two-Player Online Cooperative Mode** built with **Three.js**, **Vite**, and **Supabase Realtime**.

> **Core Message:** *You can change the rules of your business, but you cannot change the laws of nature.*

---

## Game Modes

### 1. Single Player Mode
Experience the complete narrative expedition solo: establish your mining company, configure four starting business parameters, dive the **TRITON-IX** mining crawler, manage seabed impacts, enact two permanent in-campaign rule changes, clean floating oil slicks, and restore bleached reefs.

### 2. Two-Player Online Cooperative Mode (Supabase Realtime)
Join an online session with a teammate sharing the same vessel, operations, resources, and ocean ecosystem:
- **Player 1 — Operations Director (Host):**
  - Controls the vessel and heavy crawler.
  - Carries out seabed mining and manages workshop stockpile.
  - Sells ore on the surface market.
  - Proposes business decisions and rule changes.
- **Player 2 — Marine Scientist (Crew):**
  - Monitors ocean ecosystem health, turbidity, and surface pollution.
  - Directs surface oil cleanup operations and skimmer tanks.
  - Solves the water-flow current routing puzzles to restore damaged reefs.
  - Advises on environmental consequences during the two dynamic rule changes.

---

## Online Cooperative Setup (Supabase)

1. Create a free project at [Supabase](https://supabase.com).
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Fill in your Supabase project URL and publishable anon key:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
   ```
4. *(Optional for persistent database auditing)* Apply the SQL migration in `supabase/migrations/20261118_create_coop_expeditions.sql` in the Supabase SQL Editor. The game automatically operates using low-latency Supabase Realtime channels with presence and atomic room joining.

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

- **Steer Boat / Drive Crawler / Swim Diver:** `W` `A` `S` `D` or Arrow Keys
- **Dive to Ocean Floor / Return to Surface:** `F`
- **Interact (Mine Ore / Skim Oil / Restore Reef):** `E`
- **Offload Ore / Empty Skimmer Tank:** `R`
- **Diver Swim Up / Down:** `Space` / `Shift`

---

## Testing Instructions

Run the automated game logic and cooperative multiplayer test suites:
```bash
node tests/verifyGameLogic.mjs
node tests/verifyCoopMultiplayer.mjs
```

See [PLAYTEST_PLAN.md](./PLAYTEST_PLAN.md) and [PLAYTEST_LOG.md](./PLAYTEST_LOG.md) for structured test scenarios and verification logs.
