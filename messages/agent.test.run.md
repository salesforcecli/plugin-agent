# summary

Start an agent test in your org.

# description

Use the --api-name flag to specify the name of the agent test you want to run. Use the output of the "agent test list" command to get the names of all the available agent tests in your org.

By default, this command starts the agent test in your org, but it doesn't wait for the test to finish. Instead, it displays the "agent test resume" command, with a job ID, that you execute to see the results of the test run, and then returns control of the terminal window to you. Use the --wait flag to specify the number of minutes for the command to wait for the agent test to complete; if the test completes by the end of the wait time, the command displays the test results. If not, run "agent test resume".

By default, this command outputs test results in human-readable tables for each test case, if the test completes in time. The tables show whether the test case passed, the expected and actual values, the test score, how long the test took, and more. Use the --result-format to display the test results in JSON or Junit format. Use the --output-dir flag to write the results to a file rather than to the terminal.

To run a conversation-level test without saving it to your org, use the --spec flag instead of --api-name, and specify a YAML test spec that has `testScope: CONVERSATION_LEVEL`. A simulated user holds a multi-turn conversation with the agent for each test case's `conversationGoal`, and the scorers in the spec grade it. The command waits for the run to finish and displays the results; nothing is saved to the org. The --wait and --test-runner flags don't apply to --spec.

# flags.api-name.summary

API name of the agent test to run; corresponds to the name of the AiEvaluationDefinition metadata component that implements the agent test.

# flags.api-name.prompt

API name of the agent test to run

# flags.spec.summary

Path to a conversation-level test spec (YAML) to run without saving it to the org.

# flags.spec.description

The spec must set `testScope: CONVERSATION_LEVEL`, and name the agent with `subjectName` (a published agent's API name, plus an optional `subjectVersion` such as v3; the latest version is used if omitted) or `project` (a draft agent's projectId and projectVersionId). Each test case needs a `conversationGoal`. Supported scorers when running without saving: task_resolution (the default), acceptance_criteria, topic_sequence_match and action_sequence_match. A run accepts up to 10 test cases (more if your org has a higher limit) and `maxTurns` from 1 to 30.

# flags.wait.summary

Number of minutes to wait for the command to complete and display results to the terminal window.

# examples

- Start an agent test called Resort_Manager_Test for an agent in your default org, don't wait for the test to finish:

  <%= config.bin %> <%= command.id %> --api-name Resort_Manager_Test

- Start an agent test for an agent in an org with alias "my-org" and wait for 10 minutes for the test to finish:

  <%= config.bin %> <%= command.id %> --api-name Resort_Manager_Test --wait 10 --target-org my-org

- Start an agent test and write the JSON-formatted results into a directory called "test-results":

  <%= config.bin %> <%= command.id %> --api-name Resort_Manager_Test --wait 10 --output-dir ./test-results --result-format json

- Run the conversation-level test spec in the file specs/order-status-clt.yaml without saving it, using the org with alias "my-org":

  <%= config.bin %> <%= command.id %> --spec specs/order-status-clt.yaml --target-org my-org

- Run a conversation-level test spec and write the JUnit-formatted results into a directory called "test-results":

  <%= config.bin %> <%= command.id %> --spec specs/order-status-clt.yaml --output-dir ./test-results --result-format junit

# progress.conversationRun

Running conversation-level test "%s" (%s test cases) without saving

# error.specFileNotFound

Spec file not found: %s

# error.specNotConversationLevel

The spec %s isn't a conversation-level test spec.

# error.specNotConversationLevel.actions

- Add `testScope: CONVERSATION_LEVEL` to the spec to run it with --spec.
- To run a saved turn-level test, deploy it and use --api-name instead.

# error.invalidSpec

The spec %s isn't valid: %s

# error.agentVersionNotFound

Version '%s' of agent '%s' not found. Set `subjectVersion` to a BotVersion API name such as v1, or remove it to use the latest version.

# error.missingRequiredFlags

When using --json, you must also specify the required flag(s): %s.
