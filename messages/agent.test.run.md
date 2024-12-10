# summary

Start a test for an Agent.

# description

Start a test for an Agent, providing the AiEvalDefinitionVersion ID. Returns the job ID.

# flags.name.summary

The name of the AiEvaluationDefinition to start.

# flags.name.description

The name of the AiEvaluationDefinition to start.

# flags.wait.summary

Number of minutes to wait for the command to complete and display results to the terminal window.

# flags.wait.description

If the command continues to run after the wait period, the CLI returns control of the terminal window to you.

# examples

- Start a test for an Agent:

  <%= config.bin %> <%= command.id %> --name AiEvalDefVerId
