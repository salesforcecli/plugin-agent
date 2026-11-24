# summary

Optimize an Agentforce agent by iteratively improving its instructions.

# description

Runs an optimization loop that evaluates the agent against test cases, uses an LLM to propose instruction improvements, and keeps changes that improve the score.

Each iteration:

1. Sends test utterances to the agent via preview
2. Scores responses against expected outputs
3. Proposes instruction edits via an LLM
4. Applies edits and re-evaluates
5. Keeps improvements, rejects regressions

Uses the org's Einstein LLM to propose improvements. Falls back to ANTHROPIC_API_KEY or OPENAI_API_KEY from the environment when Einstein is not available on the org.

# flags.authoring-bundle.summary

Name of the authoring bundle to optimize.

# flags.spec.summary

Path to optimization spec file (JSON or YAML). Contains test cases with utterances and expected response keywords.

# flags.iterations.summary

Number of optimization iterations to run (default: 3).

# examples

- Optimize an agent with 3 iterations:

  <%= config.bin %> <%= command.id %> --authoring-bundle MyAgent --spec test-cases.json --target-org my-org

- Run 5 optimization iterations:

  <%= config.bin %> <%= command.id %> --authoring-bundle MyAgent --spec test-cases.json --target-org my-org --iterations 5

# output.baseline

Baseline score: %s (%s/%s test cases passed)

# output.iterationKeep

Iteration %s: KEEP — score improved %s → %s (%s)

# output.iterationReject

Iteration %s: REJECT — score %s did not improve over %s (%s)

# output.summary

Optimization complete. Baseline: %s → Best: %s (%s iterations, %s kept)

# output.noImprovement

No improvements found after %s iterations. Agent unchanged.

# output.alreadyPerfect

All test cases already passing. Agent is fully optimized — no changes needed.

# output.agentUpdated

Agent file updated: %s

# output.agentRestored

Agent file restored to best version.

# error.specNotFound

Spec file not found: %s.

# error.invalidSpec

Invalid optimization spec: %s. Expected JSON with a "test_cases" array.

# error.bundleNotFound

Authoring bundle '%s' not found in the project.

# error.agentFileNotFound

Agent file not found in bundle '%s'. Expected <BundleName>.agent inside the authoring bundle directory.

# error.llmCallFailed

Einstein LLM call failed: %s.

# error.previewFailed

Preview session failed: %s.
