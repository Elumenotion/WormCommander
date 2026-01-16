# Worm Commander

Worm Commander is a browser-based snake game that doubles as a multi-modal, multi-agent demo. You can steer with the keyboard, point-and-click/tap, or issue natural language commands through the GuideAnts chat component. The game also exposes in-browser tools so the guide can read game state and control the worm.

This repository is a standalone sample intended for GitHub: it includes the full TypeScript source, assets, and a simple build + static serve workflow.

## What This Demonstrates

- Multi-modal control: keyboard, mouse/touch, and voice commands
- A tool-based agent loop: the guide reads worm senses and issues actions
- Autopilot behaviors: eat, survive, hunt, avoid
- Real-time, reactive gameplay under pressure

## Core Agents

### The Worm (Agent One)

The worm is a classical agent:

- **Perception:** `getWormSenses()` reports position, heading, food, threats, and a polar world view
- **Decision-making:** `applyAutopilot()` evaluates candidate actions and scores them by alignment, clearance, and risk
- **Autonomy:** autopilot can run without direct user control
- **Reactivity:** decision cadence increases when danger is close
- **Proactiveness:** selects targets and balances pursuit with safety
- **Social ability:** avoids, intercepts, and evaluates other snakes

### The Guide (Agent Two)

The guide (LLM + chat UI) is an agent:

- **Perception:** receives worm senses via `setContextProvider()`
- **Decision-making:** resolves commands, handles ambiguity, and sequences tool calls
- **Action:** invokes tools like ExecuteIntent, Turn, Pause, Resume
- **Reactivity:** refreshes senses after each tool call and adapts

### The Human (Agent Three)

The human is part of the control hierarchy:

- **Perception:** sees the game state
- **Decision-making:** chooses direct control vs. delegation
- **Action:** keyboard, UI buttons, voice commands, or autopilot

## Controls

- **Keyboard:** Arrow keys or A/D to turn, R to restart, Space to toggle voice
- **Mouse/touch:** click or tap in the play area to steer
- **Voice:** phrases like "turn left", "pause", "eat and grow", "hunt"

## Quickstart

```bash
npm install
npm run build
npm run start
```

`npm run start` serves `public/` and hosts the game locally.

## Project Layout

- `src/` TypeScript source
- `public/` static assets and `worm-commander.js`
- `public/sounds/voice-snakes/` audio + artwork

## Notes

- Voice requires a microphone and browser permission.
- The guide uses the GuideAnts chat component (see `src/voice-snakes.ts`).
- This sample is preconfigured to use a published guide in GuideAnts Notebooks. Its source is in `WormCommander\Guide`.

## GuideAnts Chat Component

The GuideAnts Chat Component is a framework-agnostic web component for embedding conversations from published GuideAnts Notebooks into any page. It is driven by a required `pub-id` (the published guide ID) plus optional configuration like `api-base-url`, `speech-to-text-enabled`, and input labeling.

- Source repository: [https://github.com/Elumenotion/GuideAntsChat](https://github.com/Elumenotion/GuideAntsChat)

### How This Project Uses It

- The component is registered by bundling `guideants` in `WormCommander\Game\src\voice-snakes.ts`.
- The UI is declared in `WormCommander\Game\public\index.html` with the GuideAnts API endpoint, published guide ID, and microphone enabled.
- The game bridges state and tools via `setContextProvider(...)` and `registerTool(...)` in `WormCommander\Game\src\voice-snakes\speech.ts`.

```html
<guideants-chat
  id="worm-commander-chat"
  class="theme-elumenotion"
  api-base-url="https://api.guideants.ai"
  pub-id="a64e4f78-a486-4747-87fa-42a5655e88c6"
  speech-to-text-enabled="true"
  input-label
  input-placeholder="Say: left, right, pause, resume, restart"
></guideants-chat>
```

### Customizing the Component

- Update `pub-id` to point at your published guide.
- Adjust `api-base-url` if you want to target a different GuideAnts API host.
- Toggle `speech-to-text-enabled` and tweak `input-label` / `input-placeholder` to match your UI.

## Tool Calling: Guide ↔ Client

The guide calls tools that execute inside the browser. This is a client-side tool loop: the published guide uses an OpenAPI spec, and the game registers matching tool handlers on the `<guideants-chat>` element.

### How It Connects

- **Tool definitions** live in `WormCommander\Guide\OpenAPI\Web Connector.json`.  
  This OpenAPI spec uses the `client://worm-commander-client` server URL and declares operations such as `Start`, `Pause`, `Resume`, `Turn`, `HoldTurn`, `ExecuteIntent`, `SetAutopilot`, `Status`, and `EnableMusic`.
- **Tool handlers** are registered in `WormCommander\Game\src\voice-snakes\speech.ts`.  
  The chat element is discovered and `registerTool(...)` is called for each operation. Each handler executes game logic and returns a `ToolResult` payload with updated senses.
- **Senses/context** are sent from the game to the guide via `setContextProvider(...)` in `WormCommander\Game\src\voice-snakes\speech.ts`.  
  This provides the guide with current worm senses for decision‑making.

### Files of Interest

- `WormCommander\Guide\OpenAPI\Web Connector.json`
- `WormCommander\Game\src\voice-snakes\speech.ts`
- `WormCommander\Game\src\voice-snakes\index.ts`
- `WormCommander\Game\src\voice-snakes.ts`

## Import the Guide for Customization

Use the exported guide package in `WormCommander\Guide\guide-Worm Commander-1768599131865.zip` to copy the guide into your team and customize the guide in GuideAnts Notebooks.

### Steps

1. Open GuideAnts Notebooks and navigate to the project where you want the guide.
2. In the left sidebar, open **Team Guides** (project owners only).
3. Click **Import Guide**.
4. Select `guide-Worm Commander-1768599131865.zip`.
5. Review the preview:
   - Confirm the guide name and description.
   - Check crew members and any custom assistants included.
   - Resolve any name conflicts (rename, skip, or overwrite if allowed).
6. Confirm the import.
7. Open the newly imported guide and review:
   - **Instructions** and **Home Page** content.
   - **Model** and **parameters** (temperature, top‑p, reasoning effort).
   - **Tools** and any custom OpenAPI tools.
   - **Context options**.
8. Update authentication as needed:
   - Re-enter API keys or OAuth settings (secrets are not included in exports).
9. Save, then run a quick test conversation.

### Tips

- If a global assistant referenced in the guide is missing in your environment, replace it with a similar assistant during import or after.
- If you plan to publish the customized guide, configure its publish settings after import.
