## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Architecture Memory

Before touching a module, read `docs/architecture/`:

- `docs/architecture/README.md` — entry point + doc index
- `docs/architecture/CODEBASE_MAP.md` — **start here**: module map + "sửa gì → mở file nào"
- `docs/architecture/CHANGELOG.md` — architecture changes, read BEFORE editing

**Code is the source of truth.** If a doc contradicts the code, trust the code and
update the doc in the same task. Update docs when a change affects module
boundaries, data flow, API, schema, auth, navigation, AI flow, or shared
components — not for cosmetic edits.
