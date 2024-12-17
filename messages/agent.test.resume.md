# summary

Resume an agent test that you previously started in your org so you can view the test results.

# description

This command requires a job ID, which the original "agent test run" command displays when it completes. You can also use the --use-most-recent flag to see results for the most recently run agent test.

Use the --wait flag to specify the number of minutes for this command to wait for the agent test to complete; if the test completes by the end of the wait time, the command displays the test results. If not, the CLI returns control of the terminal to you, and you must run "agent test resume" again.

By default, this command outputs test results in human-readable tables for each test case. The tables show whether the test case passed, the expected and actual values, the test score, how long the test took, and more. Use the --result-format to display the test results in JSON or Junit format. Use the --output-dir flag to write the results to a file rather than to the terminal.

# flags.job-id.summary

Job ID of the original agent test run.

# flags.use-most-recent.summary

Use the job ID of the most recent agent test run.

# flags.wait.summary

Number of minutes to wait for the command to complete and display results to the terminal window.

# examples

- Resume an agent test in your default org using a job ID:

  <%= config.bin %> <%= command.id %> --job-id 4KBfake0000003F4AQ

- Resume the most recently-run agent test in an org with alias "my-org" org; wait 10 minutes for the tests to finish:

  <%= config.bin %> <%= command.id %> --use-most-recent --wait 10 --target-org my-org

- Resume the most recent agent test in your default org, and write the JSON-formatted results into a directory called "test-results":

  <%= config.bin %> <%= command.id %> --use-most-recent --output-dir ./test-results --result-format json
