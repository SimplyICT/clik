# Critical Rules - Must Follow

## Responses

- Keep responses concise and to the point - unless the user asks otherwise

## Persistent Memory System

You MUST follow the Persistent Memory Protocol defined in `~/.config/opencode/AGENTS.md` — it applies to all opencode sessions across all projects.

For this project specifically:
- Read `.opencode/memory.md` at session start for project context.
- Update `.opencode/memory.md` at session end with progress, decisions, and state.
- Update `~/.opencode/memory/global.md` with cross-project-relevant info.

## Planning Mode

- Always ask clarifying questions
- never assume design, tech stack or features
- use deep-dive sub-agents to assist with research
- use deep-dive sub-agents to review the different aspects of your plan before presenting to the user

## Change / Edit Mode

- Never implement features yourself when possible - use sub-agents
- Identify changes from the plan that can be implemented in parallel, and use sub-agents to implement the features efficiently
- when using sub-agents to implement features, act as a coordinator only
- Use the best model available for the task 
- After completing features (large and small), always run commands like lint, type check and next build to check code quality

## Database Schema Changes

- Whenever you make changes to the database schema, ALWAYS run the drizzle generate and migrate commands
- NEVER run drizzle push!

## UI Design

- Always follow the UI design system when creating or reviewing components or pages.
- Design System: @DESIGN.md
