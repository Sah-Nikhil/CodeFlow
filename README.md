# CodeFlow: Source Code Graph Visualizer

CodeFlow is a Next.js application that visualizes the structure and relationships within a codebase as an interactive graph. It helps developers understand code organization, dependencies, and flow by representing files, functions, classes, components, and more as nodes and edges.

## Features
- Visualizes code structure as a graph (files, functions, classes, components, etc.)
- Interactive node selection with code preview (pending)
- Supports multiple node types with color-coded visualization
- Modern UI with dark/light mode support (pending)
- Multi Language support (JS/TS & Python for now)

## Architecture & Flow of Operations

```
┌────────────────────────────┐
│        User Browser        │
└─────────────┬──────────────┘
              │
              ▼
   1. User enters/pastes Git repo link
              │
              ▼
┌────────────────────────────┐
│   Next.js App (Frontend)   │
└─────────────┬──────────────┘
              │
   2. App fetches repo code (via API or direct fetch)
              │
              ▼
┌────────────────────────────┐
│      Code Parsers (TS/JS,  │
│        Python, etc.)       │
└─────────────┬──────────────┘
              │
   3. Parse files for structure (files, functions, classes, etc.)
              │
              ▼
┌────────────────────────────┐
│      Graph Builder         │
└─────────────┬──────────────┘
              │
   4. Build graph data (nodes/edges)
              │
              ▼
┌────────────────────────────┐
│   Graph UI (D3/React)      │
└─────────────┬──────────────┘
              │
   5. Render interactive graph
              │
              ▼
   6. User explores, selects nodes, previews code
              │
              ▼
   7. AI generates code summary for the selected file/node (on demand)
```

* **Step 1:** User provides a GitHub repo link.
* **Step 2:** The app fetches and downloads the codebase.
* **Step 3:** Parsers analyze the code for structure and relationships.
* **Step 4:** A graph is built from the parsed data.
* **Step 5:** The graph is rendered interactively in the browser.

* **Step 6:** User can click nodes to preview code and explore relationships.
* **Step 7:** When a user selects a file or node, the app can send the code to an AI model (LLM) to generate a summary or explanation, which is then displayed in the UI.

---

## Project Structure
- `app/` — Next.js app directory (pages, API routes, global styles)
- `components/` — React components for UI and graph rendering
- `lib/parsers/` — Code parsers for different languages (e.g., Babel for JS, Python parser)
- `public/` — Static assets (SVGs, images)
- `README.md` — Project documentation

## Usage
1. Install dependencies:
   ```bash
   pnpm install
   # or
   npm install
   # or
   yarn install
   ```
2. Start the development server:
   ```bash
   pnpm dev
   # or
   npm run dev
   # or
   yarn dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Node Types & Color Reference

| **Node Type** | **Hex Color** | **Closest Named Color**      | **Description**                                     |
| ------------- | ------------- | ---------------------------- | --------------------------------------------------- |
| `file`        | `#69b3a2`     | Green Blue / Sea Green       | Represents a source code file                       |
| `function`    | `#4285F4`     | Google Blue / Vivid Blue     | Represents a function definition                    |
| `class`       | `#DB4437`     | Google Red / Strong Red      | Represents a class definition                       |
| `component`   | `#F4B400`     | Google Yellow / Vivid Yellow | Likely a React or UI component                      |
| `export`      | `#0F9D58`     | Jungle Green / Rich Green    | Represents an exported symbol or entity             |
| `import`      | `#9e5fba`     | Amethyst / Medium Purple     | Represents an import statement or module            |
| *(default)*   | `#cccccc`     | Light Gray                   | Fallback/default for unknown or uncategorized types |

## Contributing
Pull requests and issues are welcome! Please open an issue to discuss major changes.

## License
