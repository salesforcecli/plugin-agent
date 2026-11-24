# summary

Start a server-side HEPO optimization for an Agentforce agent.

# description

Starts an iterative optimization workflow on the server. The workflow evaluates the agent against test cases, proposes instruction improvements via an LLM, and keeps changes that improve the score.

Unlike `sf agent optimize run` (which runs optimization client-side), this command offloads all work to the HEPO service and only polls for progress.

# examples

- Start optimization and wait for completion:

  <%= config.bin %> <%= command.id %> --authoring-bundle ShoppingAgent --criteria criteria.yaml --target-org myOrg --wait 60

- Start optimization without waiting (check status later):

  <%= config.bin %> <%= command.id %> --authoring-bundle ShoppingAgent --criteria criteria.yaml --target-org myOrg

- Start with custom iteration settings:

  <%= config.bin %> <%= command.id %> --authoring-bundle ShoppingAgent --criteria criteria.yaml --max-iterations 15 --target-score 0.95 --target-org myOrg

# flags.authoring-bundle.summary

Name of the agent authoring bundle to optimize.

# flags.criteria.summary

Path to criteria YAML file defining scoring metrics, gates, and weights.

# flags.test-cases.summary

Path to test cases YAML file. If not provided, test cases from the criteria file are used.

# flags.max-iterations.summary

Maximum number of optimization iterations (default: 10).

# flags.target-score.summary

Target composite score to stop early (default: 1.0).

# flags.wait.summary

Minutes to wait for completion.

# flags.wait.description

Poll for status updates until the optimization completes or times out. Without --wait, the command returns immediately after starting.

# output.started

Optimization started. Execution ID: %s

# output.progress

Iteration %s/%s — Baseline: %s Current: %s Best: %s

# output.completed

Optimization completed in %s iterations. Baseline: %s → Best: %s

# output.timeout

Optimization still running after %s minutes. Use `sf agent optimize status --execution-id %s` to check progress.

# error.startFailed

Failed to start optimization: %s

# error.pollFailed

Failed to poll optimization status: %s

# error.criteriaNotFound

Criteria file not found: %s

# error.invalidCriteria

Invalid criteria file: %s
