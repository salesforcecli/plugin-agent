# summary

Start an agent test in your org.

# description

Use the --api-name flag to specify the name of the agent test you want to run. Use the output of the "agent test list" command to get the names of all the available agent tests in your org.

By default, this command starts the agent test in your org, but it doesn't wait for the test to finish. Instead, it displays the "agent test resume" command, with a job ID, that you execute to see the results of the test run, and then returns control of the terminal window to you. Use the --wait flag to specify the number of minutes for the command to wait for the agent test to complete; if the test completes by the end of the wait time, the command displays the test results. If not, run "agent test resume".

By default, this command outputs test results in human-readable tables for each test case, if the test completes in time. The tables show whether the test case passed, the expected and actual values, the test score, how long the test took, and more. Use the --result-format to display the test results in JSON or Junit format. Use the --output-dir flag to write the results to a file rather than to the terminal.

# flags.api-name.summary

API name of the agent test to run; corresponds to the name of the AiEvaluationDefinition metadata component that implements the agent test.

# flags.wait.summary

Number of minutes to wait for the command to complete and display results to the terminal window.

# examples

- Start an agent test called Resort_Manager_Test for an agent in your default org, don't wait for the test to finish:

  <%= config.bin %> <%= command.id %> --api-name Resort_Manager_Test

- Start an agent test for an agent in an org with alias "my-org" and wait for 10 minutes for the test to finish:

  <%= config.bin %> <%= command.id %> --api-name Resort_Manager_Test --wait 10 --target-org my-org

- Start an agent test and write the JSON-formatted results into a directory called "test-results":

  <%= config.bin %> <%= command.id %> --api-name Resort_Manager_Test --wait 10 --output-dir ./test-results --result-format json
