{
  "project": "Causable",
  "version": "1.0.0-mvp",
  "epics": [
    {
      "id": "EPIC-001",
      "title": "MVP: Real-time Ledger Explorer in VS Code",
      "status": "todo",
      "owner": "Founder",
      "description": "Deliver the core, magical experience of Causable: a real-time, 'god-view' of the universal ledger, living directly inside the developer's most important tool, VS Code. This MVP is focused entirely on providing a high-quality, read-only view of the timeline. It must be fast, reliable, and visually polished to prove the value of the 'tangible ledger' concept and build a foundation for all future features.",
      "user_stories": [
        "As a developer using Causable, I want to securely connect the VS Code extension to my Causable Cloud project so that I can view my project's ledger from within my editor.",
        "As a developer, I want to see a real-time, streaming list of spans from my project's ledger so that I can observe the system's activity as it happens.",
        "As a developer, I want to click on any span in the timeline to view its full, formatted JSON payload so that I can inspect the details of any event.",
        "As a developer, I want to apply simple filters (by entity_type, status, trace_id) to the timeline so that I can quickly find the specific events I'm looking for during development or debugging.",
        "As a developer, I want a persistent, unobtrusive status indicator in my VS Code UI that shows my connection status to the Causable Cloud, so I always know if my view is live."
      ],
      "acceptance_criteria": [
        "The extension can be installed from the VS Code Marketplace.",
        "A user can successfully input an API key, which is stored securely.",
        "The side panel connects to the SSE stream and displays spans as they are written to the database (latency < 2s).",
        "The timeline view can render at least 1,000 spans without noticeable performance degradation.",
        "Filtering by `trace_id` correctly isolates all spans belonging to that trace.",
        "The full JSON of a selected span is visible and correctly formatted in a detail view."
      ],
      "technical_requirements": [
        "Must be a VS Code Extension published to the Marketplace.",
        "The UI must be built with React within a VS Code Webview.",
        "Communication with the backend must use REST for initial data load and SSE for real-time updates.",
        "Must adhere to the monorepo structure and use the shared `sdk` package.",
        "Authentication is handled via a single, user-provided API key."
      ],
      "related_prs": [
        "PR-101",
        "PR-102",
        "PR-103",
        "PR-104"
      ]
    }
  ],
  "prs": [
    {
      "id": "PR-101",
      "epic_id": "EPIC-001",
      "title": "chore: Setup Core Backend API and Shared SDK",
      "status": "todo",
      "author": "Developer",
      "description": "This foundational PR establishes the backend service and the shared code library. It creates the API contract that the VS Code extension will consume. The focus is on setting up the necessary infrastructure and the core real-time streaming logic.",
      "tasks": [
        "Initialize the `causable-cloud` package with Deno/Hono.",
        "Implement the `/api/stream` SSE endpoint that connects to PostgreSQL and uses `LISTEN/NOTIFY` to stream new spans.",
        "Implement a basic `/api/spans` REST endpoint for fetching initial history.",
        "Implement the `packages/sdk/src/types.ts` file, creating a perfect TypeScript interface for the `Span` object as defined in the Bluebook.",
        "Implement the `packages/sdk/src/client.ts` with a typed function to fetch spans from the REST endpoint.",
        "Write a basic test script to verify that inserting a row into the database results in a message being sent over the SSE stream."
      ],
      "testing_plan": "Manually run the `causable-cloud` server. Use a database client to INSERT a new span. Verify that the span JSON is immediately printed to the console by the SSE endpoint.",
      "affected_packages": [
        "causable-cloud",
        "sdk"
      ],
      "dependencies": []
    },
    {
      "id": "PR-102",
      "epic_id": "EPIC-001",
      "title": "feat: Scaffold VS Code Extension with Side Panel UI",
      "status": "todo",
      "author": "Developer",
      "description": "This PR creates the skeleton of the VS Code extension and its main user interface container. It establishes the entry point in the VS Code Activity Bar and sets up the React webview that will host the timeline.",
      "tasks": [
        "Initialize the `vscode-causable` package using `yo code`.",
        "In `package.json`, define the 'Causable' activity bar icon and the side panel view container.",
        "In `extension.ts`, implement the `activate` function to register the side panel provider.",
        "Create the `SidebarProvider.tsx` file, which will be responsible for rendering the React application inside the webview.",
        "Render a simple 'Hello, Causable' message in the side panel to confirm the webview is working.",
        "Set up the project to be debuggable by pressing F5 in the monorepo root."
      ],
      "testing_plan": "Run the extension in debug mode (F5). A new VS Code window should open. Verify the 'Causable' icon appears in the Activity Bar. Clicking it should open a side panel displaying the 'Hello, Causable' message.",
      "affected_packages": [
        "vscode-causable"
      ],
      "dependencies": []
    },
    {
      "id": "PR-103",
      "epic_id": "EPIC-001",
      "title": "feat: Implement Real-time SSE Connection and Auth",
      "status": "todo",
      "author": "Developer",
      "description": "Connects the frontend extension to the backend service. This PR implements the logic for securely handling the user's API key and establishing the persistent, real-time connection to the ledger stream. This is the 'steel thread' that makes the system live.",
      "tasks": [
        "Implement `ApiKeyService.ts` using VS Code's `SecretStorage` API to securely store and retrieve the user's Causable Cloud API key.",
        "Add a command `Causable: Set API Key` that prompts the user for their key.",
        "Create the `useTimelineStream.ts` custom React hook. This hook will use the `ApiKeyService` to get the key and establish a connection to the `/api/stream` SSE endpoint.",
        "The hook should manage connection state (connecting, connected, disconnected) and expose an array of incoming span objects.",
        "Integrate this hook into the `SidebarProvider.tsx` and log the received spans to the VS Code debug console to verify the end-to-end connection."
      ],
      "testing_plan": "Run the extension. Use the 'Set API Key' command. Verify the connection status changes to 'connected'. Manually insert a span in the database and verify its JSON is logged in the debug console of the extension host.",
      "affected_packages": [
        "vscode-causable",
        "sdk"
      ],
      "dependencies": [
        "PR-101",
        "PR-102"
      ]
    },
    {
      "id": "PR-104",
      "epic_id": "EPIC-001",
      "title": "feat: Build Real-time Timeline and Span Detail UI",
      "status": "todo",
      "author": "Developer",
      "description": "This PR builds the core user experience based on the Figma designs. It takes the raw stream of data from the previous PR and visualizes it as a polished, interactive timeline. This is the final piece of the MVP.",
      "tasks": [
        "Build the `TimelineView.tsx` component that consumes the `useTimelineStream` hook.",
        "Build the `SpanRow.tsx` component, meticulously matching the Figma design for a single span. It should display key fields like `who`, `did`, `this`, and `status` with appropriate styling.",
        "Build the `FilterBar.tsx` component with inputs for `entity_type`, `status`, and `trace_id`.",
        "Implement the filtering logic within `TimelineView.tsx`.",
        "Build the `DetailPane.tsx`. When a `SpanRow` is clicked, this pane should slide in or appear, displaying the full, syntax-highlighted JSON of the span.",
        "Implement the `StatusBar.tsx` component and register it in `extension.ts` to show the connection status in the main VS Code status bar."
      ],
      "testing_plan": "Run the full application. Verify the timeline UI matches the Figma mockups. Test the real-time updates. Test filtering by each field. Test clicking a span to open the detail pane. Verify the status bar item updates correctly.",
      "affected_packages": [
        "vscode-causable"
      ],
      "dependencies": [
        "PR-103"
      ]
    }
  ]
}
