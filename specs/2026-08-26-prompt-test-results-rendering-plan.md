# PROMPT Test Results Rendering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render per-test-case `Inputs` and `Latency`/`Tokens` lines in the human-readable output of `sf agent test results`, for AgentforceStudio (NGT) results.

**Architecture:** Two small, presence-based helpers extend `humanFormatAgentforceStudio()` in `src/handleTestResults.ts`. Each test case's table title grows from a fixed 2-line string into a variable-length array of lines (`titleLines`), populated only with the data that actually exists on that test case. No changes to `@salesforce/agents`.

**Tech Stack:** TypeScript, Mocha/Chai, `@salesforce/sf-plugins-core` `Ux.makeTable`, `ansis`.

## Global Constraints

- CLI-only change — no modifications to the `@salesforce/agents` package/repo, no Connect API or results-contract changes (per W-23524159).
- Human format only. JUnit and TAP are explicitly out of scope for this pass.
- Rendering is presence-based, not gated by subject type (the payload has no `subjectType` field) — render whenever the data exists, for any subject type.
- Only `src/handleTestResults.ts` and its test file/fixtures change.

---

## File Structure

- Modify: `src/handleTestResults.ts` — add `TestCaseInput` type, `getTestCaseInputs`, `capitalizeInputName`, `formatInputsLine` (Task 1); add `ParsedSubjectResponseMetrics` type, `parseSubjectResponseMetrics`, `formatMetricsLine` (Task 2); export `humanFormatAgentforceStudio` (currently module-private).
- Modify: `test/handleTestResults.test.ts` — add two new `describe` blocks (one per task), following the file's existing pattern of loading a fixture and asserting on `humanFormatAgentforceStudio(...)` output.
- Create: `test/mocks/agentforce-studio-results/with-inputs.json`, `legacy-user-input-fallback.json`, `no-inputs-no-user-input.json`, `many-inputs.json`, `latency-only.json`, `tokens-only.json` — new fixtures modeling `AgentforceStudioTestResultsResponse`.

---

### Task 1: Inputs line

**Files:**

- Modify: `src/handleTestResults.ts:105-163` (the `humanFormatAgentforceStudio` function and its imports)
- Test: `test/handleTestResults.test.ts`
- Create: `test/mocks/agentforce-studio-results/with-inputs.json`
- Create: `test/mocks/agentforce-studio-results/legacy-user-input-fallback.json`
- Create: `test/mocks/agentforce-studio-results/no-inputs-no-user-input.json`
- Create: `test/mocks/agentforce-studio-results/many-inputs.json`

**Interfaces:**

- Consumes: `AgentforceStudioTestResultsResponse`, `AgentforceStudioTestCaseResult` (import from `@salesforce/agents`, the latter is new to this file's imports).
- Produces (for Task 2 to build on):

  - `export function humanFormatAgentforceStudio(results: AgentforceStudioTestResultsResponse): string` (newly exported; was module-private)
  - Inside that function, a local `const titleLines: string[]` array per test case, built up before the `ux.makeTable({ title: titleLines.join('\n'), ... })` call — Task 2 appends one more line to this same array.

- [ ] **Step 1: Create the four fixture files**

`test/mocks/agentforce-studio-results/with-inputs.json`:

```json
{
  "status": "SUCCESS",
  "testCases": [
    {
      "testNumber": 1,
      "inputs": [
        { "name": "account", "value": "Acme" },
        { "name": "notes", "value": "what is kafka" }
      ],
      "subjectResponse": "{\"text\":\"Acme is a manufacturing prospect.\",\"performance\":{\"latency\":{\"duration\":842}},\"tokenUsage\":{\"completion\":89,\"prompt\":{\"total\":156},\"total\":245}}",
      "testScorerResults": [
        {
          "scorerName": "Conciseness Evaluation",
          "scorerResponse": "{\"status\":\"PASS\",\"score\":4.7,\"reasoning\":\"Good.\"}"
        }
      ]
    }
  ]
}
```

`test/mocks/agentforce-studio-results/legacy-user-input-fallback.json`:

```json
{
  "status": "SUCCESS",
  "testCases": [
    {
      "testNumber": 1,
      "subjectResponse": "{\"userInput\":\"What is the account status?\",\"text\":\"The account is active.\"}",
      "testScorerResults": [
        {
          "scorerName": "Coherence Evaluation",
          "scorerResponse": "{\"status\":\"PASS\",\"score\":4.5,\"reasoning\":\"Clear.\"}"
        }
      ]
    }
  ]
}
```

`test/mocks/agentforce-studio-results/no-inputs-no-user-input.json`:

```json
{
  "status": "SUCCESS",
  "testCases": [
    {
      "testNumber": 1,
      "subjectResponse": "{\"text\":\"Some response with no metadata.\"}",
      "testScorerResults": [
        {
          "scorerName": "Coherence Evaluation",
          "scorerResponse": "{\"status\":\"PASS\",\"score\":4.0,\"reasoning\":\"OK.\"}"
        }
      ]
    }
  ]
}
```

`test/mocks/agentforce-studio-results/many-inputs.json`:

```json
{
  "status": "SUCCESS",
  "testCases": [
    {
      "testNumber": 2,
      "inputs": [
        { "name": "account", "value": "Acme" },
        { "name": "region", "value": "ANZ" },
        { "name": "tier", "value": "Gold" },
        { "name": "segment", "value": "Enterprise" },
        { "name": "priority", "value": "High" }
      ],
      "subjectResponse": "{\"text\":\"Multi-input response.\"}",
      "testScorerResults": [
        {
          "scorerName": "Coherence Evaluation",
          "scorerResponse": "{\"status\":\"PASS\",\"score\":4.2,\"reasoning\":\"OK.\"}"
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Write the failing tests**

Add to `test/handleTestResults.test.ts` (add `stripVTControlCharacters` and `AgentforceStudioTestResultsResponse` imports, and `humanFormatAgentforceStudio` to the existing `handleTestResults.js` import):

```ts
import { stripVTControlCharacters } from 'node:util';
import { AgentforceStudioTestResultsResponse } from '@salesforce/agents';
import { humanFormat, humanFormatAgentforceStudio, readableTime, truncate } from '../src/handleTestResults.js';
```

```ts
describe('humanFormatAgentforceStudio - inputs line', () => {
  it('renders Inputs line from testCase.inputs, capitalizing each name', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/with-inputs.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.include('Inputs: Account = "Acme", Notes = "what is kafka"');
  });

  it('falls back to User Input when testCase.inputs is absent but subjectResponse.userInput exists', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/legacy-user-input-fallback.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.include('User Input: What is the account status?');
    expect(output).to.not.include('Inputs:');
  });

  it('omits the inputs line entirely when neither inputs nor userInput is present', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/no-inputs-no-user-input.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.not.include('Inputs:');
    expect(output).to.not.include('User Input:');
  });

  it('truncates to the first 3 inputs and appends a "+N more" suffix', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/many-inputs.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.include('Inputs: Account = "Acme", Region = "ANZ", Tier = "Gold"  (+2 more)');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node_modules/.bin/mocha test/handleTestResults.test.ts`
Expected: FAIL — `humanFormatAgentforceStudio` is not exported from `src/handleTestResults.ts` (TypeScript compile error via ts-node: `has no exported member 'humanFormatAgentforceStudio'`).

- [ ] **Step 4: Implement**

In `src/handleTestResults.ts`, update the `@salesforce/agents` import (around line 19-25) to add `AgentforceStudioTestCaseResult`:

```ts
import {
  AgentTestResultsResponse,
  AgentforceStudioTestCaseResult,
  AgentforceStudioTestResultsResponse,
  convertTestResultsToFormat,
  humanFriendlyName,
  metric,
} from '@salesforce/agents';
```

Add these three helpers directly above `function humanFormatAgentforceStudio` (i.e. right after the existing `parseScorerResponse` function, around line 103):

```ts
type TestCaseInput = { name: string; value: string };

function getTestCaseInputs(testCase: AgentforceStudioTestCaseResult): TestCaseInput[] | undefined {
  const inputs = (testCase as unknown as { inputs?: unknown }).inputs;
  if (!Array.isArray(inputs)) {
    return undefined;
  }
  const valid = inputs.filter(
    (i): i is TestCaseInput =>
      typeof i === 'object' &&
      i !== null &&
      typeof (i as TestCaseInput).name === 'string' &&
      typeof (i as TestCaseInput).value === 'string'
  );
  return valid.length > 0 ? valid : undefined;
}

function capitalizeInputName(name: string): string {
  return name.length > 0 ? `${name[0].toUpperCase()}${name.slice(1)}` : name;
}

function formatInputsLine(inputs: TestCaseInput[]): string {
  const shown = inputs.slice(0, 3);
  const remaining = inputs.length - shown.length;
  const pairs = shown.map((i) => `${capitalizeInputName(i.name)} = "${i.value}"`).join(', ');
  return remaining > 0 ? `${pairs}  (+${remaining} more)` : pairs;
}
```

Replace the body of `function humanFormatAgentforceStudio` (currently starting `function humanFormatAgentforceStudio(results: AgentforceStudioTestResultsResponse): string {`) — change the declaration to `export function humanFormatAgentforceStudio(...)`, and replace the per-test-case loop's title construction:

```ts
export function humanFormatAgentforceStudio(results: AgentforceStudioTestResultsResponse): string {
  const ux = new Ux();
  const tables: string[] = [];

  for (const testCase of results.testCases) {
    const inputs = getTestCaseInputs(testCase);

    const titleLines = [ansis.bold(`Test Case #${testCase.testNumber}`)];
    if (inputs) {
      titleLines.push(`${ansis.dim('Inputs')}: ${formatInputsLine(inputs)}`);
    } else {
      let userInput = '';
      try {
        const parsed = JSON.parse(testCase.subjectResponse) as { userInput?: string };
        userInput = parsed.userInput ?? '';
      } catch {
        // ignore
      }
      if (userInput) {
        titleLines.push(`${ansis.dim('User Input')}: ${userInput}`);
      }
    }

    const scorerRows = testCase.testScorerResults.map((scorer) => {
      const parsed = parseScorerResponse(scorer.scorerResponse);
      return {
        scorer: scorer.scorerName,
        result: parsed.status === 'PASS' ? ansis.green('Pass') : ansis.red('Fail'),
        expected: parsed.expectedValue ?? '',
        actual: parsed.actualValue ?? '',
        reasoning: parsed.reasoning ?? '',
      };
    });

    tables.push(
      ux.makeTable({
        title: titleLines.join('\n'),
        overflow: 'wrap',
        columns: [
          { key: 'scorer', name: 'Scorer' },
          { key: 'result', name: 'Result' },
          { key: 'expected', name: 'Expected', width: '25%' },
          { key: 'actual', name: 'Actual', width: '25%' },
          { key: 'reasoning', name: 'Reasoning', width: '35%' },
        ],
        data: scorerRows,
        width: '100%',
      })
    );
    tables.push('\n');
  }

  const totalCases = results.testCases.length;
  const passCases = results.testCases.filter((tc) =>
    tc.testScorerResults.every((s) => parseScorerResponse(s.scorerResponse).status === 'PASS')
  ).length;

  const summary = makeSimpleTable(
    {
      Status: results.status,
      'Total Test Cases': String(totalCases),
      'Passing Test Cases': String(passCases),
      'Failing Test Cases': String(totalCases - passCases),
    },
    ansis.bold.blue('Test Results')
  );

  return tables.join('') + `\n${summary}\n`;
}
```

(Everything from `const totalCases = ...` to the end is unchanged from today — shown here only so the full function reads correctly.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `node_modules/.bin/mocha test/handleTestResults.test.ts`
Expected: PASS — all 4 new tests plus the existing 12 (16 total).

- [ ] **Step 6: Commit**

```bash
git add src/handleTestResults.ts test/handleTestResults.test.ts test/mocks/agentforce-studio-results/with-inputs.json test/mocks/agentforce-studio-results/legacy-user-input-fallback.json test/mocks/agentforce-studio-results/no-inputs-no-user-input.json test/mocks/agentforce-studio-results/many-inputs.json
git commit -m "feat: render test-case inputs in agent test results human format"
```

---

### Task 2: Latency/Tokens line

**Files:**

- Modify: `src/handleTestResults.ts` (the `humanFormatAgentforceStudio` function from Task 1)
- Test: `test/handleTestResults.test.ts`
- Create: `test/mocks/agentforce-studio-results/latency-only.json`
- Create: `test/mocks/agentforce-studio-results/tokens-only.json`

**Interfaces:**

- Consumes: `export function humanFormatAgentforceStudio(...)` and the `titleLines: string[]` array from Task 1 — this task appends one more line to that same array, after the `Inputs`/`User Input` line and before `scorerRows` is built.
- Produces: `formatMetricsLine(parsed: ParsedSubjectResponseMetrics): string | undefined`, `parseSubjectResponseMetrics(raw: string): ParsedSubjectResponseMetrics` — used only within this file; nothing downstream depends on them.

- [ ] **Step 1: Create the two new fixture files**

`test/mocks/agentforce-studio-results/latency-only.json`:

```json
{
  "status": "SUCCESS",
  "testCases": [
    {
      "testNumber": 1,
      "subjectResponse": "{\"text\":\"Response with latency only.\",\"performance\":{\"latency\":{\"duration\":500}}}",
      "testScorerResults": [
        {
          "scorerName": "Coherence Evaluation",
          "scorerResponse": "{\"status\":\"PASS\",\"score\":4.1,\"reasoning\":\"OK.\"}"
        }
      ]
    }
  ]
}
```

`test/mocks/agentforce-studio-results/tokens-only.json`:

```json
{
  "status": "SUCCESS",
  "testCases": [
    {
      "testNumber": 1,
      "subjectResponse": "{\"text\":\"Response with tokens only.\",\"tokenUsage\":{\"completion\":20,\"prompt\":{\"total\":30},\"total\":50}}",
      "testScorerResults": [
        {
          "scorerName": "Coherence Evaluation",
          "scorerResponse": "{\"status\":\"PASS\",\"score\":4.3,\"reasoning\":\"OK.\"}"
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Write the failing tests**

Add to `test/handleTestResults.test.ts` (reuses `with-inputs.json` from Task 1 — it already has both `performance` and `tokenUsage` matching the numbers in the ticket's example, and `no-inputs-no-user-input.json`, which has neither):

```ts
describe('humanFormatAgentforceStudio - latency/tokens line', () => {
  it('renders combined Latency and Tokens line', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/with-inputs.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.include('Latency: 842ms  |  Tokens: 156 in / 89 out / 245 total');
  });

  it('renders Latency alone when tokenUsage is missing', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/latency-only.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.include('Latency: 500ms');
    expect(output).to.not.include('Tokens:');
  });

  it('renders Tokens alone when performance is missing', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/tokens-only.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.include('Tokens: 30 in / 20 out / 50 total');
    expect(output).to.not.include('Latency:');
  });

  it('omits the metrics line entirely when neither performance nor tokenUsage is present', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/no-inputs-no-user-input.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.not.include('Latency:');
    expect(output).to.not.include('Tokens:');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node_modules/.bin/mocha test/handleTestResults.test.ts`
Expected: FAIL — the 4 new tests fail because no `Latency:`/`Tokens:` line is rendered yet (`formatMetricsLine`/`parseSubjectResponseMetrics` don't exist yet).

- [ ] **Step 4: Implement**

Add these two helpers to `src/handleTestResults.ts`, directly below the `formatInputsLine` function added in Task 1:

```ts
type ParsedSubjectResponseMetrics = {
  performance?: { latency?: { duration?: number } };
  tokenUsage?: { completion?: number; prompt?: { total?: number }; total?: number };
};

function parseSubjectResponseMetrics(raw: string): ParsedSubjectResponseMetrics {
  try {
    return JSON.parse(raw) as ParsedSubjectResponseMetrics;
  } catch {
    return {};
  }
}

function formatMetricsLine(parsed: ParsedSubjectResponseMetrics): string | undefined {
  const parts: string[] = [];
  const latencyMs = parsed.performance?.latency?.duration;
  if (typeof latencyMs === 'number') {
    parts.push(`${ansis.dim('Latency')}: ${latencyMs}ms`);
  }
  const tokenUsage = parsed.tokenUsage;
  const hasTokens =
    tokenUsage !== undefined &&
    (typeof tokenUsage.completion === 'number' ||
      typeof tokenUsage.prompt?.total === 'number' ||
      typeof tokenUsage.total === 'number');
  if (hasTokens) {
    const tokensIn = tokenUsage?.prompt?.total ?? 0;
    const tokensOut = tokenUsage?.completion ?? 0;
    const tokensTotal = tokenUsage?.total ?? 0;
    parts.push(`${ansis.dim('Tokens')}: ${tokensIn} in / ${tokensOut} out / ${tokensTotal} total`);
  }
  return parts.length > 0 ? parts.join('  |  ') : undefined;
}
```

In `humanFormatAgentforceStudio`, inside the per-test-case loop, add one block right after the `Inputs`/`User Input` `if`/`else` from Task 1 and before `const scorerRows = ...`:

```ts
const metricsLine = formatMetricsLine(parseSubjectResponseMetrics(testCase.subjectResponse));
if (metricsLine) {
  titleLines.push(metricsLine);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node_modules/.bin/mocha test/handleTestResults.test.ts`
Expected: PASS — all 8 new tests (4 from Task 1, 4 from this task) plus the existing 12 (20 total).

- [ ] **Step 6: Run the full test suite for a regression check**

Run: `yarn test`
Expected: PASS — no regressions elsewhere (this only exercises `src/handleTestResults.ts`, an isolated, previously-under-tested file).

- [ ] **Step 7: Commit**

```bash
git add src/handleTestResults.ts test/handleTestResults.test.ts test/mocks/agentforce-studio-results/latency-only.json test/mocks/agentforce-studio-results/tokens-only.json
git commit -m "feat: render latency and token usage in agent test results human format"
```

---

## After both tasks

Both tasks are on branch `feat/w-23524159-prompt-results-rendering`. Per your earlier direction: no PR yet. Next step is your own `yarn build` + live-org verification via your already-linked local `sf` CLI. JUnit/TAP enrichment is explicitly deferred to a follow-up ticket/plan.
