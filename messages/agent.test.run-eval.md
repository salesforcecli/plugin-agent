# summary

Run evaluation tests against an Agentforce agent.

# description

Execute rich evaluation tests against an Agentforce agent using the Einstein Evaluation API. Supports both YAML test specs (same format as `sf agent generate test-spec`) and JSON payloads.

When you provide a YAML test spec, the command automatically translates test cases into Evaluation API calls and infers the agent name from the spec's `subjectName` field. This means you can use the same test spec with both `sf agent test run` and `sf agent test run-eval`. YAML test specs also support contextVariables, which allow you to inject contextual data (such as CaseId or RoutableId) into agent sessions for testing with different contexts.

When you provide a JSON payload, it's sent directly to the API with optional normalization. The normalizer auto-corrects common field name mistakes, converts shorthand references to JSONPath, and injects defaults. Use `--no-normalize` to disable this auto-normalization. JSON payloads can also include context_variables on agent.create_session steps for the same contextual testing capabilities.

Supports 8+ evaluator types, including topic routing assertions, action invocation checks, string/numeric assertions, semantic similarity scoring, and LLM-based quality ratings.

# flags.spec.summary

Path to test spec file (YAML or JSON). Supports reading from stdin when piping content.

# flags.api-name.summary

Agent DeveloperName (also called API name) to resolve agent_id and agent_version_id. Auto-inferred from the YAML spec's subjectName.

# flags.wait.summary

Number of minutes to wait for results.

# flags.result-format.summary

Format of the agent test results.

# flags.batch-size.summary

Number of tests per API request (max 5).

# flags.no-normalize.summary

Disable auto-normalization of field names and shorthand references.

# examples

- Run tests using a YAML test spec on the org with alias "my-org":

  <%= config.bin %> <%= command.id %> --spec tests/my-agent-testSpec.yaml --target-org my-org

- Run tests using a YAML spec with explicit agent name override; use your default org:

  <%= config.bin %> <%= command.id %> --spec tests/my-agent-testSpec.yaml --api-name My_Agent --target-org my-org

- Run tests using a JSON payload:

  <%= config.bin %> <%= command.id %> --spec tests/eval-payload.json --target-org my-org

- Run tests and output results in JUnit format; useful for continuous integration and deployment (CI/CD):

  <%= config.bin %> <%= command.id %> --spec tests/my-agent-testSpec.yaml --target-org my-org --result-format junit

- Run tests with contextVariables to inject contextual data into agent sessions (add contextVariables to test cases in your YAML spec):

  <%= config.bin %> <%= command.id %> --spec tests/agent-with-context.yaml --target-org my-org

- Pipe JSON payload from stdin (--spec flag is automatically populated from stdin):

  $ echo '{"tests":[...]}' | <%= config.bin %> <%= command.id %> --spec --target-org my-org

# info.batchProgress

Running batch %s of %s (%s tests)...

# info.testComplete

Test %s: %s.

# info.summary

Results: %s passed, %s failed, %s scored, %s errors.

# info.yamlDetected

Detected YAML test spec for agent '%s' with %s test case(s). Translating to Evaluation API format.

# error.invalidPayload

Invalid test payload: %s.

# error.apiError

Einstein Eval API error (HTTP %s): %s

# error.agentNotFound

No agent found with DeveloperName (also API name) '%s'. Verify that the agent exists in the target org.

# error.agentVersionNotFound

No published version found for agent '%s'. Make sure the agent has been published at least once.
