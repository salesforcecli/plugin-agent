# summary

Run evaluation tests against an Agentforce agent.

# description

Execute rich evaluation tests against an Agentforce agent using the Einstein Evaluation API. Supports both YAML test specs (same format as `sf agent generate test-spec`) and JSON payloads.

When you provide a YAML test spec, the command automatically translates test cases into Evaluation API calls and infers the agent name from the spec's `subjectName` field. This means you can use the same test spec with both `sf agent test run` and `sf agent test run-eval`.

When you provide a JSON payload, it's sent directly to the API with optional normalization. The normalizer auto-corrects common field name mistakes, converts shorthand references to JSONPath, and injects defaults. Use `--no-normalize` to disable.

Supports 8+ evaluator types including topic routing assertions, action invocation checks, string/numeric assertions, semantic similarity scoring, and LLM-based quality ratings.

# flags.spec.summary

Path to test spec file (YAML or JSON). Use `-` for stdin.

# flags.agent-api-name.summary

Agent DeveloperName to resolve agent_id and agent_version_id. Auto-inferred from YAML spec's subjectName.

# flags.wait.summary

Number of minutes to wait for results.

# flags.result-format.summary

Output format: human, json, junit, or tap.

# flags.batch-size.summary

Number of tests per API request (max 5).

# flags.no-normalize.summary

Disable auto-normalization of field names and shorthand references.

# examples

- Run tests from a YAML test spec:

  <%= config.bin %> <%= command.id %> --spec tests/my-agent-testSpec.yaml --target-org my-org

- Run tests from a YAML spec with explicit agent name override:

  <%= config.bin %> <%= command.id %> --spec tests/my-agent-testSpec.yaml --agent-api-name My_Agent --target-org my-org

- Run tests from a JSON payload:

  <%= config.bin %> <%= command.id %> --spec tests/eval-payload.json --target-org my-org

- JUnit output for CI/CD:

  <%= config.bin %> <%= command.id %> --spec tests/my-agent-testSpec.yaml --target-org my-org --result-format junit

- Pipe JSON payload from stdin:

  echo '{"tests":[...]}' | <%= config.bin %> <%= command.id %> --spec - --target-org my-org

# info.batchProgress

Running batch %s of %s (%s tests)...

# info.testComplete

Test %s: %s

# info.summary

Results: %s passed, %s failed, %s scored, %s errors

# info.yamlDetected

Detected YAML test spec for agent '%s' with %s test case(s). Translating to Evaluation API format.

# error.invalidPayload

Invalid test payload: %s

# error.apiError

Einstein Eval API error (HTTP %s): %s

# error.agentNotFound

No agent found with DeveloperName '%s'. Verify the agent exists in the target org.

# error.agentVersionNotFound

No published version found for agent '%s'. Ensure the agent has been published at least once.
