# Copilot Journal

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
    * darkened grid lines from `#eee` to `#ccc`.
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
