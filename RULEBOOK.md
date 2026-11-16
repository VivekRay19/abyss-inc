# ABYSS INC. — OFFICIAL GAME RULEBOOK

**Subtitle:** *The Ocean Is Not for Sale*  
**Version:** 3.0.0  
**Genre:** Environmental Strategy & Interactive 3D Adventure (5–10 Minute Demonstration)

---

## 1. Game Title and Central Objective

**ABYSS INC. — The Ocean Is Not for Sale** is a short environmental strategy and interactive adventure game.  
The central objective is to establish a deep-sea mining company, extract minerals to meet your business target, witness and manage the ecological consequences of industrial extraction, make two permanent company rule changes, clean floating surface oil pollution, and restore the damaged underwater coral reef.

**Core Message:** *You can change the rules of your business, but you cannot change the laws of nature.*

---

## 2. Story Introduction

You begin aboard a small industrial research-and-mining vessel on the open ocean surface alongside **Captain Harlan**. You name yourself and your company, set initial business parameters, and lower your compact mining machine (**TRITON-IX**) to the seabed. As you extract minerals, sediment clouds spread, coral reefs lose color, and oil waste rises to the ocean surface—forcing your company to confront the true cost of resource extraction.

---

## 3. Player Roles (Single-Player & Local Co-op)

The game supports **Single-Player** (one player controls both roles with Captain guidance) and **Local Co-op (2 Players)** on one shared screen:

- **Player 1 — Operations Director:** Controls the surface boat and the mining machine, sets initial business parameters, monitors ore cargo and company credits, proposes the restoration budget, and participates in both rule-change decisions.
- **Player 2 — Marine Scientist:** Operates the Ecological Scanner (`[Q]`), monitors reef condition and pollution risk, advises when to stop mining, participates in both rule-change decisions, reviews/counterproposes the restoration budget, and leads the underwater diver & reef-restoration logic puzzle.

---

## 4. Controls

| Action | Key / Input |
| :--- | :--- |
| Move Boat / Mining Machine / Diver | `W` `A` `S` `D` (or Arrow Keys in Single-Player) |
| Diver Swim Up / Down | `Space` / `Shift` |
| Interact / Start-Stop Mining / Skim Oil / Open Reef Cleaning | `E` |
| Return Mining Machine to Boat / Empty Skimmer Tank | `R` |
| Co-op Player 2 Ecological Scan | `Q` |
| Co-op Player 2 Navigation / Review | Arrow Keys & Mouse |
| Scrub Sediment (Mini-Game A) & Rotate Tiles (Mini-Game B) | Mouse Click / Drag (Touch supported) |

---

## 5. Gameplay Stages

1. **Stage 1 — Ocean Surface (Welcome Aboard):** Name your player and company and choose Single-Player or Local Co-op.
2. **Stage 2 — Initial Business Settings:** Set Machine Capacity, Ore Selling Price, and Extraction Target.
3. **Stage 3 — Deployment:** Watch the boat's crane lower the mining machine to the seabed.
4. **Stage 4 — Underwater Mining & Rule Change 1:** Extract ore from finite deposits while observing seabed damage, then enact **Rule Change 1**.
5. **Stage 5 — Ascent & Surface Cleanup:** Return to the surface and steer the boat's skimmer arm to collect floating oil slicks.
6. **Stage 6 — Rule Change 2:** Enact **Rule Change 2** governing mineral sales.
7. **Stage 7 — Cooperation & Budget Negotiation:** Agree on a Small, Standard, or Generous restoration budget.
8. **Stage 8 — Dive & Reef Restoration:** Control the human diver, complete **Mini-Game A (Clean the Reef)** and **Mini-Game B (Water-Flow Logic Puzzle + Coral Placement)**.
9. **Stage 9 — Ending:** Review your company and environmental summary.

---

## 6. Three Initial Business Settings

*(These are starting parameters and do **not** count as the two in-campaign dynamic rule changes.)*

1. **Mining Machine Capacity (`20t`, `35t`, or `50t`):** Determines how much ore the machine can hold before returning to the boat.
2. **Ore Selling Price (`$2,000/t` to `$4,500/t`):** Higher prices increase potential revenue, but asking above `$3,500/t` carries commercial buyer pushback (up to a 32% negotiated discount).
3. **Extraction Target (`40t` to `100t`):** Sets your company's ore extraction goal. Seabed reserves are strictly finite (`140t` total).

---

## 7. The Two In-Campaign Dynamic Rule Changes

Each rule change is permanent for the remainder of the campaign and genuinely alters gameplay conditions:

### Rule Change 1 — The Extraction Rule *(Triggered after initial mining & environmental warning)*
- **Option A: Continuous Extraction** — Permits continued mining to reach or exceed your target, but increases pollution (`1.25x` disturbance) and restoration difficulty.
- **Option B: Restoration-First Permit** — Immediately prohibits further mining until surface cleanup and reef restoration are completed, limiting total ore extracted while keeping the reef healthier.

### Rule Change 2 — The Mineral Sales Rule *(Triggered after surface oil cleanup)*
- **Option A: Open Market** — Allows immediate sale of extracted ore without environmental certification at standard market price.
- **Option B: Eco-Certified Market** — Blocks mineral sales until surface cleanup and reef restoration are completed, then grants a **+35% Eco-Certified premium** upon completion.

---

## 8. Immutable Ecological Laws

Regardless of any business setting or rule change:
1. Mining always produces environmental disturbance and sediment plumes.
2. Sediment damages the seabed and nearby coral habitats.
3. Mineral reserves on the ocean floor are strictly finite (`140t`).
4. Pollution cannot be removed by changing financial settings.
5. Restoration requires direct player interaction and effort.
6. Extracted minerals cannot be recreated simply by cleaning the ocean.

---

## 9. Mining Rules

Drive the **TRITON-IX** crawler near a glowing mineral deposit and press `E` to drill. Extracted ore fills the machine's hold (`oreInHold` up to `machineCapacity`). Return near the subsea riser or press `R` to offload ore to the boat's stockpile and ascend.

---

## 10. Environmental Damage Mechanics

Every mining tick releases sediment particles, darkens seabed terrain sectors, reduces **Ocean Health**, degrades nearby coral colors/emissive glow, increases underwater fog murkiness, and causes oil waste to accumulate on the ocean surface.

---

## 11. Surface-Cleaning Mechanics

After ascending, steer the surface vessel (`WASD`) near each of the 8 floating oil slicks and press `E` to activate the skimmer arm. The collection tank holds `40` units; press `R` to empty the tank when full. Cleaning all 8 slicks completes the surface objective.

---

## 12. Reef-Restoration Mechanics

In **Mini-Game A (Clean the Reef)**, click and drag across sediment blobs on the coral close-up to scrub them away. Scrubbing speed scales with the negotiated restoration budget (`1.0x`, `1.5x`, or `2.2x`), immediately restoring 3D coral colors and Ocean Health.

---

## 13. Water-Flow Logic Puzzle Instructions (Mini-Game B)

A 3×3 grid of coral-support channels sits between the **Fresh Current Inlet** (top-left) and **Coral Nursery Outlet** (bottom-right). Click any tile to rotate it 90° clockwise until a continuous blue water path connects Inlet to Outlet. Once connected, plant all 3 coral fragments to complete reef restoration.

---

## 14. Cooperation and Negotiation Mechanics

Before diving to restore the reef, **Player 1 (Operations Director)** proposes a **Small (`$25K`)**, **Standard (`$50K`)**, or **Generous (`$80K`)** restoration budget. **Player 2 (Marine Scientist)** reviews it and may **Accept** or make **one Counterproposal**, which Player 1 then accepts or rejects. The agreed amount is atomically checked against available credits and deducted to determine cleaning speed and puzzle clues.

---

## 15. Resources and Objectives

Resources are strictly limited to: **Ore**, **Company Credits**, **Mining Capacity**, **Surface-Cleaning Tank Capacity**, and **Restoration Supplies**. A single clear objective is displayed in the top bar at every stage.

---

## 16. Winning and Defeat Conditions

- **Victory / Campaign Completion:** Complete surface cleanup, reef restoration (Mini-Games A & B), and evaluate whether your **Extraction Target** was met (`MODEL STEWARDSHIP` if target met & Ocean Health ≥ 75%; `OCEAN PROTECTED, TARGET MISSED` if target missed).
- **Defeat — Bankruptcy:** Triggered if Company Credits fall below `$0`, or if Credits are below `$25K` (minimum restoration budget) during Budget Negotiation with no sellable ore.
- **Defeat — Ecological Collapse:** Triggered if Global Ocean Health drops to `10%` or below.

---

## 17. Optional Between-Run Constitution System

If defeated, players may ratify up to 2 permanent **Between-Run Charter Amendments** (stored in `localStorage` via `ConstitutionPersistence.js`). This is an optional meta-progression feature outside the 5–10 minute demonstration and does **not** count as either of the two in-campaign dynamic rule changes.
