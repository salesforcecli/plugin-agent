# summary

Get the results of a completed agent test run.

# description

This command requires a job ID, which the original "agent test run" command displays when it completes. You can also use the --use-most-recent flag to see results for the most recently run agent test.

By default, this command outputs test results in human-readable tables for each test case. The tables show whether the test case passed, the expected and actual values, the test score, how long the test took, and more. Use the --result-format to display the test results in JSON or Junit format. Use the --output-dir flag to write the results to a file rather than to the terminal.

# flags.job-id.summary

Job ID of the completed agent test run.

# flags.use-most-recent.summary

Use the job ID of the most recent agent test run.

# examples

- Get the results of an agent test run in your default org using its job ID:

  <%= config.bin %> <%= command.id %> --job-id 4KBfake0000003F4AQ

- Get the results of the most recently run agent test in an org with alias "my-org":

  <%= config.bin %> <%= command.id %> --use-most-recent --target-org my-org

- Get the results of the most recently run agent test in your default org, and write the JSON-formatted results into a directory called "test-results":

  <%= config.bin %> <%= command.id %> --use-most-recent --output-dir ./test-results --result-format json
