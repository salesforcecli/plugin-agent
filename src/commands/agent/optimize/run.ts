/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Flags, SfCommand, toHelpSection } from '@salesforce/sf-plugins-core';
import { Connection, EnvironmentVariable, Messages, SfError, SfProject } from '@salesforce/core';
import { Agent, findAuthoringBundle } from '@salesforce/agents';
import { parse as parseYaml } from 'yaml';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.optimize.run');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TestCase = {
  utterance: string;
  expected_response_contains?: string[];
  expected_topic?: string;
};

type OptimizationSpec = {
  test_cases: TestCase[];
};

type TestCaseResult = {
  utterance: string;
  response: string;
  passed: boolean;
  matchedKeywords: string[];
  missedKeywords: string[];
};

type IterationResult = {
  iteration: number;
  mutation: string;
  score: number;
  passCount: number;
  totalCount: number;
  decision: 'KEEP' | 'REJECT';
};

export type OptimizeRunResult = {
  baselineScore: number;
  bestScore: number;
  iterations: IterationResult[];
  agentFile: string;
};

// ---------------------------------------------------------------------------
// LLM client — tries Einstein Prompt Generations API first, then falls back
// to ANTHROPIC_API_KEY or OPENAI_API_KEY from the environment.
// ---------------------------------------------------------------------------

type PromptGenerationResponse = {
  generations: Array<{ text: string; responseId: string }>;
};

type AnthropicResponse = {
  content: Array<{ type: string; text: string }>;
};

type OpenAIResponse = {
  choices: Array<{ message: { content: string } }>;
};

async function callLlmEinstein(conn: Connection, prompt: string): Promise<string> {
  const body = {
    isPreview: false,
    inputParams: {
      valueMap: {
        'Input:prompt_text': {
          value: prompt,
        },
      },
    },
    additionalConfig: {
      applicationName: 'PromptTemplateGenerationsInvocable',
      maxTokens: 4096,
      temperature: 0,
    },
  };

  const url = `/services/data/v${conn.version}/einstein/prompt-templates/AgentOptimizer/generations`;

  const resp = await conn.request<PromptGenerationResponse>({
    method: 'POST',
    url,
    body: JSON.stringify(body),
  });

  if (!resp.generations?.length) {
    throw new Error('Empty response from Einstein LLM');
  }
  return resp.generations[0].text;
}

async function callLlmAnthropic(apiKey: string, prompt: string): Promise<string> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      // eslint-disable-next-line camelcase
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`Anthropic API error: ${resp.status} ${resp.statusText}`);
  const data = (await resp.json()) as AnthropicResponse;
  return data.content[0].text;
}

async function callLlmOpenAI(apiKey: string, prompt: string): Promise<string> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      // eslint-disable-next-line camelcase
      max_tokens: 4096,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI API error: ${resp.status} ${resp.statusText}`);
  const data = (await resp.json()) as OpenAIResponse;
  return data.choices[0].message.content;
}

async function callLlm(conn: Connection, prompt: string): Promise<string> {
  // Try Einstein first
  try {
    return await callLlmEinstein(conn, prompt);
  } catch {
    // Einstein not available — fall through to external providers
  }

  // Fallback: ANTHROPIC_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return callLlmAnthropic(anthropicKey, prompt);
  }

  // Fallback: OPENAI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return callLlmOpenAI(openaiKey, prompt);
  }

  throw new SfError(messages.getMessage('error.llmCallFailed', ['No LLM provider available']), 'LlmProviderError', [
    'Einstein Prompt Generations API is not available on this org.',
    'Set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable as a fallback.',
    'Or enable Einstein generative AI and assign EinsteinGPTPromptTemplateUser permission set.',
  ]);
}

// ---------------------------------------------------------------------------
// Agent file helpers
// ---------------------------------------------------------------------------

function locateAgentFile(project: SfProject, bundleName: string): string {
  const dirs = project.getPackageDirectories().map((d) => d.fullPath);
  const bundleDir = findAuthoringBundle(dirs, bundleName);
  if (!bundleDir) {
    throw new SfError(messages.getMessage('error.bundleNotFound', [bundleName]));
  }
  return join(bundleDir, `${bundleName}.agent`);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

async function evaluateAgent(
  conn: Connection,
  project: SfProject,
  bundleName: string,
  testCases: TestCase[],
  log: (msg: string) => void
): Promise<{ score: number; passCount: number; results: TestCaseResult[] }> {
  const results: TestCaseResult[] = [];

  // Init once — Agent.init with aabName compiles the .agent file and returns a ScriptAgent
  const agent = await Agent.init({
    connection: conn,
    project,
    aabName: bundleName,
  });
  agent.preview.setMockMode('Mock');

  for (const tc of testCases) {
    let responseText = '';
    try {
      // Start a fresh session per utterance to avoid conversational state leaking
      // eslint-disable-next-line no-await-in-loop
      await agent.preview.start({});
      // eslint-disable-next-line no-await-in-loop
      const response = await agent.preview.send(tc.utterance);
      responseText = response.messages
        .filter((m) => m.type === 'Inform')
        .map((m) => m.message ?? '')
        .join(' ');
      // eslint-disable-next-line no-await-in-loop
      await agent.preview.end();
    } catch (e) {
      log(`  Preview failed for "${tc.utterance}": ${(e as Error).message}`);
      try {
        // eslint-disable-next-line no-await-in-loop
        await agent.preview.end();
      } catch {
        // best-effort cleanup
      }
    }

    const expectedKeywords = tc.expected_response_contains ?? [];
    const lowerResponse = responseText.toLowerCase();
    const matchedKeywords = expectedKeywords.filter((kw) => lowerResponse.includes(kw.toLowerCase()));
    const missedKeywords = expectedKeywords.filter((kw) => !lowerResponse.includes(kw.toLowerCase()));

    const passed = expectedKeywords.length === 0 || missedKeywords.length === 0;

    results.push({
      utterance: tc.utterance,
      response: responseText,
      passed,
      matchedKeywords,
      missedKeywords,
    });
  }

  const passCount = results.filter((r) => r.passed).length;
  const score = testCases.length > 0 ? passCount / testCases.length : 0;
  return { score, passCount, results };
}

// ---------------------------------------------------------------------------
// Mutation proposal
// ---------------------------------------------------------------------------

function stripCodeFences(text: string): string {
  let stripped = text.trim();
  stripped = stripped.replace(/^```(?:yaml|agent|agentscript)?\s*\n?/i, '');
  stripped = stripped.replace(/\n?```\s*$/, '');
  return stripped.trim();
}

function buildMutationPrompt(agentContent: string, evalResults: TestCaseResult[]): string {
  const failures = evalResults
    .filter((r) => !r.passed)
    .map(
      (r) =>
        `- Utterance: "${r.utterance}"\n  Response: "${r.response.slice(
          0,
          200
        )}"\n  Missing keywords: ${r.missedKeywords.join(', ')}`
    )
    .join('\n');

  const successes = evalResults
    .filter((r) => r.passed)
    .map((r) => `- Utterance: "${r.utterance}" — PASSED`)
    .join('\n');

  return `You are an Agentforce agent optimization expert. You must improve the agent's instructions to fix failing test cases while preserving passing ones.

CRITICAL RULES:
- Output ONLY the raw agent file content. No markdown fences, no explanations, no commentary.
- Preserve the EXACT file structure: system:, config:, variables:, language:, start_agent, topic blocks.
- Only modify text inside "instructions:" fields and "description:" fields.
- Do NOT add new topics, variables, or actions unless absolutely necessary.
- Do NOT change the config: block or default_agent_user.
- Keep all indentation and block-scalar markers (| and ->) exactly as they are.

## Current Agent File (this is valid AgentScript — preserve its structure)
${agentContent}

## Test Results
### Failing (needs improvement):
${failures || '(none)'}

### Passing (preserve these):
${successes || '(none)'}

## What to change
Improve ONLY the reasoning instructions text to better handle failing utterances. For example:
- Add explicit routing rules like "Route return/refund requests to the returns topic"
- Add keywords the agent should mention in responses (e.g., "Always mention refund policy when discussing returns")
- Make topic descriptions more specific so routing works correctly

Output the complete agent file now:`;
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export default class AgentOptimizeRun extends SfCommand<OptimizeRunResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;
  public static state = 'beta';

  public static readonly envVariablesSection = toHelpSection(
    'ENVIRONMENT VARIABLES',
    EnvironmentVariable.SF_TARGET_ORG
  );

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'authoring-bundle': Flags.string({
      summary: messages.getMessage('flags.authoring-bundle.summary'),
      required: true,
    }),
    spec: Flags.file({
      char: 's',
      required: true,
      summary: messages.getMessage('flags.spec.summary'),
      exists: true,
    }),
    iterations: Flags.integer({
      char: 'i',
      default: 3,
      summary: messages.getMessage('flags.iterations.summary'),
    }),
  };

  public async run(): Promise<OptimizeRunResult> {
    const { flags } = await this.parse(AgentOptimizeRun);
    const org = flags['target-org'];
    const conn = org.getConnection(flags['api-version']);
    const bundleName = flags['authoring-bundle'];
    const maxIterations = flags.iterations;

    // 1. Load spec (supports JSON and YAML)
    let spec: OptimizationSpec;
    try {
      const raw = await readFile(flags.spec, 'utf-8');
      if (flags.spec.endsWith('.yml') || flags.spec.endsWith('.yaml')) {
        spec = parseYaml(raw) as OptimizationSpec;
      } else {
        spec = JSON.parse(raw) as OptimizationSpec;
      }
    } catch (e) {
      throw new SfError(messages.getMessage('error.invalidSpec', [(e as Error).message]));
    }
    if (!spec.test_cases || !Array.isArray(spec.test_cases) || spec.test_cases.length === 0) {
      throw new SfError(messages.getMessage('error.invalidSpec', ['missing or empty "test_cases" array']));
    }

    // 2. Locate agent file
    const agentFile = locateAgentFile(this.project!, bundleName);
    let agentContent: string;
    try {
      agentContent = await readFile(agentFile, 'utf-8');
    } catch {
      throw new SfError(messages.getMessage('error.agentFileNotFound', [bundleName]));
    }
    const originalContent = agentContent;

    // 3. Baseline evaluation
    this.log(`Evaluating baseline (${spec.test_cases.length} test cases)...`);
    const baseline = await evaluateAgent(conn, this.project!, bundleName, spec.test_cases, (msg) => this.log(msg));
    this.log(
      messages.getMessage('output.baseline', [
        `${(baseline.score * 100).toFixed(0)}%`,
        baseline.passCount.toString(),
        spec.test_cases.length.toString(),
      ])
    );

    // 4. Optimization loop
    let bestScore = baseline.score;
    let bestContent = agentContent;
    let currentResults = baseline.results;
    const iterations: IterationResult[] = [];
    let keptCount = 0;

    for (let i = 1; i <= maxIterations; i++) {
      this.log(`\nIteration ${i}/${maxIterations}...`);

      // 4a. If all tests pass, stop early
      if (bestScore >= 1.0) {
        this.log('All test cases passing — stopping early.');
        break;
      }

      // 4b. Ask LLM for mutation
      this.log('  Proposing improvements via LLM...');
      let mutatedContent: string;
      try {
        const prompt = buildMutationPrompt(agentContent, currentResults);
        // eslint-disable-next-line no-await-in-loop
        mutatedContent = await callLlm(conn, prompt);
        mutatedContent = stripCodeFences(mutatedContent);
      } catch (e) {
        this.log(`  LLM call failed: ${(e as Error).message}. Skipping iteration.`);
        iterations.push({
          iteration: i,
          mutation: 'LLM_ERROR',
          score: bestScore,
          passCount: baseline.passCount,
          totalCount: spec.test_cases.length,
          decision: 'REJECT',
        });
        continue;
      }

      // 4c. Basic validation: ensure it looks like an agent file
      if (!mutatedContent.includes('system:') || !mutatedContent.includes('start_agent')) {
        this.log('  LLM returned invalid agent content (missing system: or start_agent). Skipping iteration.');
        iterations.push({
          iteration: i,
          mutation: 'INVALID_CONTENT',
          score: bestScore,
          passCount: baseline.passCount,
          totalCount: spec.test_cases.length,
          decision: 'REJECT',
        });
        continue;
      }

      // 4d. Apply mutation
      // eslint-disable-next-line no-await-in-loop
      await writeFile(agentFile, mutatedContent, 'utf-8');

      // 4e. Evaluate
      this.log('  Evaluating...');
      // eslint-disable-next-line no-await-in-loop
      const evalResult = await evaluateAgent(conn, this.project!, bundleName, spec.test_cases, (msg) => this.log(msg));

      // 4f. KEEP or REJECT
      const mutationLabel = 'instruction_refine';
      if (evalResult.score > bestScore) {
        bestScore = evalResult.score;
        bestContent = mutatedContent;
        agentContent = mutatedContent;
        currentResults = evalResult.results;
        keptCount++;
        this.log(
          messages.getMessage('output.iterationKeep', [
            i.toString(),
            `${(evalResult.score * 100).toFixed(0)}%`,
            `${(bestScore * 100).toFixed(0)}%`,
            mutationLabel,
          ])
        );
        iterations.push({
          iteration: i,
          mutation: mutationLabel,
          score: evalResult.score,
          passCount: evalResult.passCount,
          totalCount: spec.test_cases.length,
          decision: 'KEEP',
        });
      } else {
        // Revert to best known version
        // eslint-disable-next-line no-await-in-loop
        await writeFile(agentFile, bestContent, 'utf-8');
        agentContent = bestContent;
        this.log(
          messages.getMessage('output.iterationReject', [
            i.toString(),
            `${(evalResult.score * 100).toFixed(0)}%`,
            `${(bestScore * 100).toFixed(0)}%`,
            mutationLabel,
          ])
        );
        iterations.push({
          iteration: i,
          mutation: mutationLabel,
          score: evalResult.score,
          passCount: evalResult.passCount,
          totalCount: spec.test_cases.length,
          decision: 'REJECT',
        });
      }
    }

    // 5. Final write of best content
    await writeFile(agentFile, bestContent, 'utf-8');

    // 6. Summary
    if (baseline.score >= 1.0 && iterations.length === 0) {
      this.log(messages.getMessage('output.alreadyPerfect'));
    } else if (bestScore > baseline.score) {
      this.log(
        `\n${messages.getMessage('output.summary', [
          `${(baseline.score * 100).toFixed(0)}%`,
          `${(bestScore * 100).toFixed(0)}%`,
          iterations.length.toString(),
          keptCount.toString(),
        ])}`
      );
      this.log(messages.getMessage('output.agentUpdated', [agentFile]));
    } else {
      await writeFile(agentFile, originalContent, 'utf-8');
      this.log(`\n${messages.getMessage('output.noImprovement', [iterations.length.toString()])}`);
    }

    return {
      baselineScore: baseline.score,
      bestScore,
      iterations,
      agentFile,
    };
  }
}
