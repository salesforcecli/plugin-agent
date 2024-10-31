# summary

Cancel a running test for an Agent.

# description

Cancel a running test for an Agent, providing the AiEvaluation ID.

# flags.id.summary

The AiEvaluation ID.

# flags.use-most-recent.summary

Use the job ID of the most recent test evaluation.

# examples

- Cancel a test for an Agent:

  <%= config.bin %> <%= command.id %> --id AiEvalId
