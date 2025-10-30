Of course. This is the definitive, consolidated blueprint for the "Causable" VS Code Extension. It's the master document that translates the grand vision into a focused, buildable, and high-quality developer tool.

This blueprint is designed to be the single source of truth you hand to a developer. It's structured, granular, and leaves no room for ambiguity.

---

### 📘 Causable VS Code Extension Bluebook v1.0

**The Verifiable Runtime for Autonomous AI, right in your editor.**

**Core Mission:** To make the LogLineOS/Causable ledger a tangible, observable, and interactive part of the developer's daily workflow. The extension transforms the abstract concept of a "universal ledger" into a living, real-time "system heartbeat" inside the developer's primary tool.

**Key Principles:**
1.  **Meet Developers Where They Are:** Don't force a context switch. Bring the ledger into VS Code.
2.  **Real-time is a Requirement, Not a Feature:** The system must feel alive. Latency is the enemy.
3.  **Developer Experience is the Product:** The UI must be fast, beautiful, intuitive, and provide immediate value. It should feel like a native part of the VS Code experience.
4.  **Read-First, Write-Later:** The MVP is focused on creating the world's best "ledger explorer." Editing and writing capabilities (deploying kernels, etc.) will be built on this solid, observable foundation.

---

### 1. Architecture & Technology Stack

*   **Host Platform:** Visual Studio Code (via standard Extension API)
*   **Language:** TypeScript
*   **UI Framework:** React (rendered in a VS Code Webview)
*   **Communication Protocol:** HTTPS (for REST API) & Server-Sent Events (SSE for real-time stream)
*   **State Management:** React Hooks (`useState`, `useContext`, `useEffect`)
*   **Shared Logic:** Consumes the `@causable/sdk` package for types and API client.
*   **Security:** Uses VS Code's native `SecretStorage` API for secure credential management.

---

### 2. Core Features & UI Blueprint

#### 2.1. Entry Point & Core UI Shell

*   **Activity Bar Icon:** A single, clean "C" logo (for Causable) is added to the VS Code Activity Bar.
*   **Side Panel View:** Clicking the icon opens the main "Causable" side panel. This panel is a single React application.
*   **Status Bar Item:** An item in the bottom status bar displays the connection status (`Connecting...`, `● Live`, `⚠ Disconnected`) and a subtle count of new spans in the last minute. Clicking it focuses the Causable side panel.

#### 2.2. Authentication Flow

1.  On first launch (or if no API key is found), the side panel will display a single input field and a "Connect" button.
2.  The developer will execute the command `Causable: Set API Key` from the command palette (`Cmd+Shift+P`).
3.  A VS Code input box appears, prompting for the API key from their Causable Cloud dashboard.
4.  The key is saved securely using the `SecretStorage` API.
5.  The side panel automatically detects the new key and attempts to connect to the SSE stream.

#### 2.3. The Timeline View (`TimelineView.tsx`)

This is the main screen of the extension.

*   **Real-time & Infinite Scroll:** It establishes a persistent connection to the `/api/stream` SSE endpoint. New spans animate in at the top of the list in real-time. The view should handle thousands of spans without performance issues (using virtualization, e.g., `react-window`).
*   **Filter Bar (`FilterBar.tsx`):** A sticky header at the top of the timeline with the following inputs:
    *   `Trace ID`: A text input that filters the list to only spans with a matching `trace_id`.
    *   `Entity Type`: A multi-select dropdown to filter by one or more `entity_type`s (e.g., 'function', 'execution', 'policy').
    *   `Status`: A multi-select dropdown to filter by `status` (e.g., 'complete', 'error', 'slow').
*   **Span List:** The main body, rendering a list of `SpanRow` components.

#### 2.4. The Span Row (`SpanRow.tsx`)

This is the most critical UI component, representing a single event in the ledger. Each row must be a masterpiece of information density and clarity.

*   **Layout:** A compact, horizontal layout.
*   **Visual Elements:**
    *   **Status Indicator:** A colored dot on the far left (`green` for complete/active, `red` for error, `yellow` for slow/queued, `gray` for draft).
    *   **Semantic Triple (`who`, `did`, `this`):** The core of the event, displayed prominently. E.g., "**edge:run\_code** `executed` **run\_code**".
    *   **Timestamp:** A relative timestamp (e.g., "3s ago", "2m ago") that updates in real-time. Hovering shows the full ISO timestamp.
    *   **Entity Type Badge:** A small, color-coded badge (e.g., `function`, `policy_violation`).
*   **Interaction:**
    *   **Hover:** Shows a tooltip with additional info like `duration_ms`.
    *   **Click:** Selects the span and opens the Detail Pane. The selected row should have a distinct background color.

#### 2.5. The Detail Pane (`DetailPane.tsx`)

When a `SpanRow` is clicked, a detail view appears (e.g., slides in, or the view splits).

*   **Content:** Renders the *entire* JSON object of the selected span.
*   **Formatting:** The JSON must be beautifully formatted and syntax-highlighted.
*   **Actions:**
    *   A "Copy JSON" button.
    *   A "Copy Trace ID" button.
    *   Clickable links for `id`, `parent_id`, and `trace_id` that automatically apply a filter to the main timeline view.

---

### 3. File & Component Architecture

This is the granular file structure from the previous response, now framed as the official blueprint.

```plaintext
/vscode-causable/
├── .vscode/
│   └── launch.json           // Debug configuration for the extension
├── src/
│   ├── extension.ts          // ★ Main entry point: registers all commands and UI providers.
│   ├── SidebarProvider.tsx   // The React root that renders the webview UI.
│   ├── components/
│   │   ├── TimelineView.tsx    // Manages state, filtering, and renders the list of spans.
│   │   ├── SpanRow.tsx         // Renders a single span in the timeline.
│   │   ├── FilterBar.tsx       // The filtering UI at the top of the timeline.
│   │   ├── DetailPane.tsx      // Shows the full JSON of a selected span.
│   │   └── StatusBar.tsx       // Renders the component for the bottom status bar.
│   ├── hooks/
│   │   ├── useCausableApi.ts   // Hook for fetching initial data via REST.
│   │   └── useTimelineStream.ts// ★ Core Logic: Connects to SSE and provides real-time spans.
│   └── services/
│       └── ApiKeyService.ts    // Securely manages the user's API key.
├── package.json              // The VS Code Extension Manifest (defines all contributions).
└── tsconfig.json             // TypeScript configuration.
```

---

### 4. `package.json` Contributions (The Extension Manifest)

This file tells VS Code how the extension plugs into the editor. It's the "wiring" diagram.

```json
{
  "name": "causable",
  "displayName": "Causable Ledger Explorer",
  "description": "Real-time, verifiable runtime for autonomous AI, right in your editor.",
  "version": "1.0.0",
  "publisher": "YourCompanyName",
  "main": "./dist/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "causable-sidebar",
          "title": "Causable",
          "icon": "media/icon.svg"
        }
      ]
    },
    "views": {
      "causable-sidebar": [
        {
          "type": "webview",
          "id": "causable.timelineView",
          "name": "Ledger Timeline"
        }
      ]
    },
    "commands": [
      {
        "command": "causable.setApiKey",
        "title": "Causable: Set API Key"
      }
    ],
    "menus": {
        "commandPalette": [
            {
                "command": "causable.setApiKey",
                "when": "true"
            }
        ]
    }
  },
  "activationEvents": [
    "onView:causable.timelineView"
  ]
}
```

---

### 5. Development Plan & Milestones (For the Developer)

This is the task list from the Rich PRs, framed as a project plan.

1.  **Milestone 1: The Steel Thread (Week 1):**
    *   **Goal:** Prove end-to-end real-time connectivity.
    *   **Tasks:** Implement the basic backend SSE stream, the SDK types, the extension skeleton, and the `useTimelineStream` hook.
    *   **Outcome:** A developer can log spans from the database directly into the VS Code debug console.

2.  **Milestone 2: The Core UI (Weeks 2-3):**
    *   **Goal:** Build the complete read-only user interface.
    *   **Tasks:** Implement `TimelineView`, `SpanRow`, `FilterBar`, and `DetailPane` to pixel-perfect match the Figma mockups. Wire them up to the data stream from Milestone 1.
    *   **Outcome:** The extension is feature-complete for the MVP. It is a beautiful, real-time ledger explorer.

3.  **Milestone 3: Polish & Publish (Week 4):**
    *   **Goal:** Harden the extension and prepare for release.
    *   **Tasks:** Implement the `ApiKeyService`, the `StatusBar` item, handle edge cases (disconnections, errors), and write basic documentation. Set up the release workflow.
    *   **Outcome:** The extension is published to the VS Code Marketplace and ready for its first users.
