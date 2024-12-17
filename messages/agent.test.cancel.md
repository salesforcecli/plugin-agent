# summary

Cancel an agent test that's currently running in your org.

# description

This command requires a job ID, which the original "agent test run" command displays when it completes. You can also use the --use-most-recent flag to see results for the most recently run agent test.

# flags.job-id.summary

Job ID of the running agent test that you want to cancel.

# flags.use-most-recent.summary

Use the job ID of the most recently-run agent test.

# examples

- Cancel an agent test currently running in your default org using a job ID:

  <%= config.bin %> <%= command.id %> --job-id 4KBfake0000003F4AQ

- Cancel the most recently run agent test in the org with alias "my-org":

  <%= config.bin %> <%= command.id %> --job-id 4KBfake0000003F4AQ --target-org my-org
