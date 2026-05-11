# TeamForge TODO List

This document tracks planned enhancements for the TeamForge hyperagent orchestration platform demo.

## High Priority

- [ ] **Full Real LLM Integration**: Replace all mock functions in `lib/agents.ts` and `lib/store.ts` with real `streamText`/`generateObject` calls from Vercel AI SDK using the existing LLM router.
- [ ] **Mastra Workflow Integration**: Fully implement the Coordinator as a Mastra workflow with real tool calling, memory, and parallel execution.
- [ ] **Persistent Storage**: Add database (Supabase or local JSON) for saving runs, agent configs, and conversation history.
- [ ] **Vector Memory / RAG**: Implement semantic memory using embeddings so agents can recall insights from past runs.

## Core Features

- [ ] **Human-in-the-Loop**: Add approval gates for plans, tool calls, and high-cost operations.
- [ ] **Advanced Cost & Budget Guardrails**: Real-time cost tracking with hard/soft limits per run and per agent.
- [ ] **Multi-Modal Support**: Integrate real image generation (Flux via Replicate/Fal.ai) and handle image inputs.
- [ ] **Real Tooling**: Replace mocks with production tools — Tavily/Serper for search, E2B/Fireworks for code execution, etc.

## UI/UX Improvements

- [ ] **Component Refactoring**: Break down the large `app/page.tsx` (~18KB) into smaller focused components (e.g., MissionInput, LiveRunPanel, AgentFleet).
- [ ] **Agent Customization UI**: Add modal/editor for users to create/customize their own agents with system prompts and tools.
- [ ] **Rich Deliverables Renderer**: Enhance `RunViewer.tsx` with native support for Recharts, tables, markdown, and embedded images/PDFs.
- [ ] **Dark/Light Mode Toggle** and improved responsive design for mobile/tablet.

## Production & DevEx

- [ ] **Testing Suite**: Add Jest/Vitest tests for agents, store, tools, and UI components.
- [ ] **CI/CD Pipeline**: Set up GitHub Actions for lint, build, and tests on PRs.
- [ ] **Observability Dashboard**: Add LangSmith-style trace viewer with timestamps, token usage, and costs.
- [ ] **Evaluation Framework**: Implement LLM-as-judge for scoring agent outputs and runs.

## Nice-to-Haves

- [ ] **Export Options**: One-click export of deliverables to PDF, Notion, Markdown, or Slack.
- [ ] **Multi-Tenancy / Auth**: User accounts and team collaboration features.
- [ ] **Example Mission Library**: Curated prompt templates for common business use cases.
- [ ] **Performance Optimizations**: Use React Server Components, streaming SSR where appropriate.

## Documentation

- [ ] **API Reference & Contribution Guide**: Expand README and add docs for extending agents/tools.

**Total open tasks: 18+**

Prioritize real AI integration and persistence first for a production-ready demo.

Last updated: May 2026
