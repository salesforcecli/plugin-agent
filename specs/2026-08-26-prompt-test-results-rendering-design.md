# Design: Render inputs + latency/tokens in `sf agent test results`

**Ticket:** W-23524159 — "[Headless PT] - Impl: CLI rendering of latency + token metrics"
**Depends on:** W-23524158 (server-side; "Ready for Review") — populates `subjectResponse` for PROMPT test cases.
**Repo:** `plugin-agent` (this repo). No changes to the `agents` package/repo — the ticket is explicitly scoped as a CLI-only change, with no Connect API / results-contract change.

## Context

`sf agent test results` renders results from two distinct APIs:

1. **Legacy** (`AgentTestResultsResponse`, detected via `subjectName` field) — the original Bot Testing API. Out of scope for this change entirely.
2. **AgentforceStudio / NGT** (`AgentforceStudioTestResultsResponse`) — used by both AGENT and PROMPT subject types under the `agentforce-studio` test runner (PROMPT support added in forcedotcom/agents#353, not yet released). This is the path we're changing.

Today, `humanFormatAgentforceStudio()` in `src/handleTestResults.ts` tries to read `userInput` off `testCase.subjectResponse` — but that field doesn't exist there. A real PROMPT-subject sample response shows:

- Each test case has a top-level `inputs: [{name, value}, ...]` array. This field exists on the wire (confirmed by tracing `AgentforceStudioTester.results()` → `normalizeAgentforceStudioResults()`, which spreads `...tc` and so preserves it) but is **not declared** on the `AgentforceStudioTestCaseResult` TS type in `@salesforce/agents`.
- `subjectResponse` (a JSON string, already HTML-decoded by the SDK) contains `performance.latency.duration` (ms) and `tokenUsage.{completion, prompt.total, total}` for PROMPT test cases.

The results payload has no `subjectType` field, so there's no way to positively distinguish AGENT vs. PROMPT test cases at render time.

## Decisions

- **Presence-based rendering, not subject-type-gated.** Render the new lines whenever the data exists, for any subject type. This is simpler (no detection needed) and, as a side effect, fixes AGENT's currently-broken "User Input" line for free if AGENT test cases populate the same `inputs` field.
- **Human format only.** JUnit and TAP are out of scope for this pass — revisit once human format has landed and been validated against a real org.
- **No changes to the `agents` package.** The `inputs` field is read via a local type extension in `plugin-agent`, not by modifying `AgentforceStudioTestCaseResult` upstream.
- **Fallback preserved.** If `testCase.inputs` is absent/empty, fall back to the existing `subjectResponse.userInput` parse (today's behavior, unchanged) rather than removing it outright.

## Behavior

For each test case in `humanFormatAgentforceStudio()`, after the `Test Case #N` title and before the scorer table:

```
Test Case #1
  Inputs: Account = "Acme", Notes = "what is kafka"
  Latency: 842ms  |  Tokens: 156 in / 89 out / 245 total
```

### Inputs line

- Source: `testCase.inputs: Array<{name, value}>` (locally typed, since not on the upstream `AgentforceStudioTestCaseResult` type).
- Format: `Inputs: Name1 = "value1", Name2 = "value2"`, values always double-quoted.
- Label: capitalize just the first letter of the raw `name` (`account` → `Account`). No snake_case/camelCase splitting — no evidence any real input names need it; simplest option that matches the sample data.
- Truncation: show the first 3 inputs in original array order; if there are more, append ` (+N more)` where N = total − 3.
- Fallback: if `inputs` is missing or empty, fall back to today's `User Input: {value}` line derived from `subjectResponse.userInput`, unchanged. If neither exists, omit the line (previously this rendered `User Input: ` with an empty value — omitting is strictly better).

### Latency/Tokens line

- Source: `JSON.parse(testCase.subjectResponse)`, reading `performance.latency.duration` and `tokenUsage.{completion, prompt.total, total}`. Reuses the existing try/catch-and-default-to-`{}` pattern already used for scorer responses (`parseScorerResponse`) — never throws on malformed/missing data.
- Format: `Latency: {duration}ms  |  Tokens: {prompt.total} in / {completion} out / {total} total`.
- Partial data: show only the parts that exist (e.g. `Latency: 842ms` alone if `tokenUsage` is missing). Omit the whole line if neither `performance.latency.duration` nor `tokenUsage` is present.

## Out of scope (this ticket)

- JUnit and TAP formats for AgentforceStudio results — revisit in a follow-up once human format is validated.
- Any change to `@salesforce/agents` types or the Connect API contract.
- Live-org / scratch-org test setup — the user will build (`yarn build`) and verify against a real connected org via their own already-linked local `sf` CLI.

## Testing

`humanFormatAgentforceStudio()` currently has zero unit test coverage. Add:

- A fixture derived from the real sample response (trimmed `subjectResponse` prose for readability) covering: `inputs` present, `performance`/`tokenUsage` present.
- A fixture with no `inputs` and no `performance`/`tokenUsage`, to verify graceful omission (no crash, no blank/broken lines).
- A fixture with 4+ inputs on one test case, to verify the `(+N more)` truncation.
- Assertions cover the exact rendered lines for each case above.

## Verification

Unit tests only, in this session. The user has already `yarn link`ed their local `sf` CLI to this repo's build and will do the live-org pass themselves after `yarn build`.
