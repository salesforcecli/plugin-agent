# summary

Resume a running test for an Agent.

# description

Resume a running test for an Agent, providing the AiEvaluation ID.

# flags.job-id.summary

The AiEvaluation ID.

# flags.use-most-recent.summary

Use the job ID of the most recent test evaluation.

# flags.wait.summary

Number of minutes to wait for the command to complete and display results to the terminal window.

# flags.wait.description

If the command continues to run after the wait period, the CLI returns control of the terminal window to you.

# flags.output-dir.summary

Directory in which to store test run files.

# examples

- Resume a test for an Agent:

  <%= config.bin %> <%= command.id %> --id AiEvalId
