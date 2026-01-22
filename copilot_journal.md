# Copilot Journal

<!-- 
PROTOCOL: 
1. Edit Code
2. npm run verify
3. Login entry below
4. Report to user
-->

This file tracks the evolution of the project. Copilot should update this file after completing significant tasks.

## Format
* **Goal**: [Brief description of the objective]
* **Files Modified**: [List of key files changed] (Optional)
* **Approach**: [Technical details of implementation]
* **Outcome**: [Result and verification status]

---

## 2026-01-22 11:55
* **Goal**: Enforce quality assurance protocols (Definition of done).
* **Files Modified**: `.github/copilot-instructions.md`, `package.json`, `copilot_journal.md`
* **Approach**: 
    * Created `.github/copilot-instructions.md` with strict rules for testing, linting, and building before completion.
    * Added `npm run verify` script to `package.json` combining `lint`, `test`, and `build`.
    * Updated `copilot_journal.md` with the new protocol header.
* **Outcome**: 
    * `npm run verify` passed.
    * Automation now assists in enforcing the QA cycle.

## 2026-01-22 11:45
* **Goal**: QA and Bugfixes (Delete key, JSON loading, Backfill ghosts, Backfill return logic).
* **Files Modified**: `src/utils/physics.ts`, `src/App.vue`, `src/components/TaskListModal.vue`
* **Approach**: 
    * **Backfill Return**: Updated `physics.ts` to ignore backfill triggers if the dragged item overlaps its original position.
    * **Delete Key**: Fixed `App.vue` to use `selectedItemIds`.
    * **JSON Load**: Cleared `selectedItemIds` on load to prevent crash.
    * **Ghosts**: Decoupled ghost rendering from Bump mode in `App.vue`.
    * **QA**: Added `src/App.loading.test.ts`, `src/App.ghosts.test.ts`, `src/utils/physics.backfill_return.test.ts`. 
    * **Cleanup**: Fixed lint errors in `App.vue` (indentation) and `physics.ts` (dead code).
* **Outcome**: 
    * Regression tests passed.
    * `npm run verify` passed (Lint: Clean, Tests: 44/44, Build: Success).

## 2026-01-22 10:00
* **Goal**: Fix Backfill & Bump Interaction and Visualization (Unified Physics).
* **Files Modified**: `src/utils/physics.ts`, `src/App.vue`, `src/utils/physics.layout.test.ts`
* **Approach**:
    * Created `calculateLayoutOutcome` in `physics.ts` to pipeline Backfill -> Collision/Bump.
    * Updated `resolveBumps` to handle center-aligned overlap correctly.
    * Updated `App.vue` to use `calculateLayoutOutcome` for both ghost previews (visuals) and final drop logic (`stopDrag`).
    * Added `physics.layout.test.ts` to verify complex interactions (Backfilling then moving into the vacated spot).
* **Outcome**: 
    * Unified physics engine allows seamless mixing of Bump and Backfill modes.
    * Visuals accurately reflect the final state during drag.
    * All 37 tests passed.

## 2026-01-22 09:30
* **Goal**: Implement "Backfill Mode" where moving an item allows adjacent items to slide left and fill the void.
* **Approach**:
    * Implemented `resolveBackfill` in `utils/physics.ts` (Chain-shift logic).
    * Added `src/utils/physics.backfill.test.ts` to verify behavior.
    * Added "Backfill" toggle in `App.vue` header.
    * Integrated backfill trigger in `stopDrag`.
* **Outcome**: Verified that right-adjacent chains effectively slide left to close gaps when backfill is enabled.

## 2026-01-22 09:05
* **Goal**: Establish a regression testing suite and improve quality assurance process.
* **Files Modified**: `src/App.test.ts`, `eslint.config.js`, `src/vite-env.d.ts`, `package.json`, `src/components/TaskListModal.vue`
* **Approach**: 
    * Installed `@vue/test-utils` and `jsdom`.
    * Created `src/App.test.ts` with integration tests for DOM structure, Scrolling sync, Adding items, and Undo.
    * Configured `eslint` with `typescript-eslint` to fix linting errors.
* **Outcome**: 
    * Lint: Pass | Test: 30 Pass | Build: Success
    * Regressions in grid rendering or basic interactions will be caught automatically.

## 2026-01-22 08:58
* **Goal**: Refine Bump Mode visual feedback during drag operations.
* **Approach**: 
    * Updated `bumpedItemIds` logic in `App.vue` to exclude the currently dragged item (keeping it solid).
    * Re-enabled the standard "Ghost" (gray dashed border) for the dragged item to show its snap target.
    * Maintained "Hatched" ghosts only for downstream bumped items.
* **Outcome**: Dragged item looks "real", target position is clear, and bumped items look "temporary" (hatched).

## 2026-01-22 08:45
* **Goal**: Verify Bump Logic correctness with tests and add visual polish.
* **Approach**: 
    * Created `src/utils/physics.bump.test.ts` to test `resolveBumps` logic (chain bumps, overlaps).
    * Updated `App.vue` to display item names inside the Hatched Ghosts.
* **Outcome**: Verified logic handles chain reactions correctly; Visualization is more informative.

## 2026-01-22 08:35
* **Goal**: Fix Grid rendering issue (grid was invisible/collapsed).
* **Approach**: 
    * Separated "Viewport" (Scrollable container) from "Content" (Sized div) in `App.vue`.
    * Darkened grid lines from `#eee` to `#ccc`.
    * Explicitly set `z-index: 0` on grid background.
* **Outcome**: Grid is now visible and scrolls correctly; Headers stay in sync.

## 2026-01-21 15:30
* **Goal**: Implement "Bump Mode" (Smart collision handling).
* **Approach**: 
    * Implemented `resolveBumps` in `physics.ts` using recursive overlap detection.
    * Added Toggle Button in Header.
    * Added "Ghosting" logic to visualize future positions of bumped items.
    * Added style `.bump-ghost-hatched` for bumped items.
* **Outcome**: Dragging items now successfully pushes neighbors out of the way; Grid expands automatically.

## 2026-01-21 15:10
* **Goal**: Restore Original UI Layout after simplified TypeScript migration caused regression.
* **Approach**: 
    * Retrieved original HTML/CSS from git history.
    * Manually merged original layout (Sidebar + Grid) with new Composition API Script.
    * Fixed multiple syntax errors (`Set-Content` escaping issues, Vue event handlers).
* **Outcome**: App looks like the original design but is powered by the new TypeScript codebase.
