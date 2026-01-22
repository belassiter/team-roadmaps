# Team Roadmaps

A simplified, interactive proof-of-concept for a team capacity and roadmap planning tool. Built with Vue 3 and TypeScript.

## Live Demo
[View Deployment](https://belassiter.github.io/team-roadmaps/)

## Features

### Core Interaction
*   **Drag & Drop**: Freely move task bars across a timeline grid.
*   **Grid Snapping**: Items snap to defined cell sizes (days/weeks).
*   **Multi-Selection**: Ctrl+Click to select and move multiple items at once.
*   **Undo History**: Basic Ctrl+Z support for movement and deletions.

### Smart Modes
*   **Bump Mode**: When enabled, moving an item "bumps" overlapping items forward in time, creating a cascade effect to resolve conflicts.
*   **Backfill Mode**: When enabled, moving an item out of a "lane" causes downstream items to slide left and fill the gap.

### Organization
*   **Named Rows**: Click row headers to rename teams or workstreams.
*   **Row Filtering**: Filter visible rows using the input in the top-left corner.
*   **Task List**: View, sort, and edit all tasks in a tabular modal view.

## Development

### Setup
```bash
npm install
```

### Run Locally
```bash
npm run dev
```

### Quality Assurance
The project enforces a strict "Definition of Done" pipeline.
```bash
npm run verify
```
This runs:
1.  `npm run lint` (ESLint)
2.  `npm test` (Vitest)
3.  `npm run build` (Vite)

### Deployment
To deploy to GitHub Pages:
```bash
npm run deploy
```

## Tech Stack
*   **Framework**: Vue 3 (Composition API)
*   **Language**: TypeScript
*   **Build Tool**: Vite
*   **Testing**: Vitest + Vue Test Utils
*   **Styling**: Plain CSS (Variables & Flexbox)
