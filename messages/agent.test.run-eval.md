# summary

Run evaluation tests against the Einstein Eval Labs API.

# description

Execute rich evaluation tests against an Agentforce agent using the Einstein Evaluation API. Supports 8+ evaluator types including string assertions, topic routing verification, semantic similarity scoring, and LLM-based quality ratings.

Unlike `sf agent test run` which requires deploying YAML test specs as org metadata, this command sends JSON test payloads directly to the API with no deployment step.

The payload normalizer auto-corrects common field name mistakes (e.g., `agentId` to `agent_id`, `text` to `utterance`), converts `{step_id.field}` shorthand references to JSONPath, and injects default values. Use `--no-normalize` to disable.

# flags.payload.summary

Path to JSON test payload file (use - for stdin).

# flags.agent-api-name.summary

Auto-resolve agent_id and agent_version_id from the agent's DeveloperName.

# flags.wait.summary

Number of minutes to wait for results.

# flags.result-format.summary

Output format: human, json, junit, or tap.

# flags.batch-size.summary

Number of tests per API request (max 5).

# flags.no-normalize.summary

Disable auto-normalization of field names and shorthand references.

# examples

- Run tests from a JSON file:

  <%= config.bin %> <%= command.id %> --payload tests/eval.json --target-org my-org

- Auto-resolve agent IDs by DeveloperName:

  <%= config.bin %> <%= command.id %> --payload tests/eval.json --agent-api-name Customer_Support_Agent --target-org my-org

- Pipe payload from stdin:

  echo '{"tests":[...]}' | <%= config.bin %> <%= command.id %> --payload - --target-org my-org

- JUnit output for CI/CD:

  <%= config.bin %> <%= command.id %> --payload tests/eval.json --target-org my-org --result-format junit

- Skip normalization for pre-validated payloads:

  <%= config.bin %> <%= command.id %> --payload tests/eval.json --target-org my-org --no-normalize

# info.batchProgress

Running batch %d of %d (%d tests)...

# info.testComplete

Test %s: %s

# info.summary

Results: %d passed, %d failed, %d scored, %d errors

# error.invalidPayload

Invalid test payload: %s

# error.apiError

Einstein Eval API error (HTTP %s): %s

# error.agentNotFound

No agent found with DeveloperName '%s'. Verify the agent exists in the target org.

# error.agentVersionNotFound

No published version found for agent '%s'. Ensure the agent has been published at least once.
