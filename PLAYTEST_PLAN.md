# ABYSS INC. — Playtest Plan (Create → Test → Refine)

This document defines three structured single-player playtesting scenarios verifying repeatable surface-to-seabed diving, tutorial-to-ongoing operations progression, and dynamic rule enforcement.

---

## Test 1 — Repeatable Surface & Underwater Navigation

**Procedure:**
1. Start a fresh single-player game and complete initial deployment.
2. Mine ore underwater, then press `F` (**RETURN TO SURFACE [F]**).
3. On the surface, press `F` (**DIVE TO OCEAN FLOOR [F]**) and confirm arrival on the seabed.
4. Mine additional ore and press `F` to return to the surface again.
5. Repeat the Dive ↔ Surface cycle at least 3 times.

**Verification Checklist:**
- [ ] Player can dive and return to the surface repeatedly without input locks.
- [ ] Credits, ore stockpile, remaining seabed reserves, environmental damage, and enacted rules remain intact across every transition.

---

## Test 2 — Tutorial Completion into Ongoing Operations

**Procedure:**
1. Complete the tutorial story (Rule Change 1, Surface Oil Cleanup, Rule Change 2, Restoration Budget, Reef Cleaning & Water-Flow Logic Puzzle).
2. Confirm the **TUTORIAL COMPLETE!** screen appears with the **CONTINUE OPERATIONS** button.
3. Click **CONTINUE OPERATIONS** and continue playing.

**Verification Checklist:**
- [ ] Completing the tutorial does **not** reset the company or force a return to the main menu.
- [ ] Player can dive (`[F]`), mine remaining deposits, surface (`[F]`), sell ore, purchase equipment upgrades (`+15t Hold`, `+25% Drill`), and restore reefs in Ongoing Operations.

---

## Test 3 — Different Rule Choices (Branch Verification)

**Procedure:** Complete separate runs selecting opposite options for Rule 1 and Rule 2.

**Verification Checklist:**
- [ ] **Rule 1 (`continuous_extraction` vs `restoration_first`):** Changes whether further mining is permitted before completing reef restoration.
- [ ] **Rule 2 (`open_market` vs `eco_certified`):** Changes whether ore can be sold immediately or requires restoration completion for the +35% certified premium.
