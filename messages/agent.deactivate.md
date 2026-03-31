# summary

Deactivate an agent in an org.

# description

Deactivating an agent makes it unavailable to your users. To make changes to an agent, such as adding or removing topics or actions, you must deactivate it. You can't preview an agent with the "agent preview" CLI command or VS Code if it's deactivated.

If you run the command without the --api-name flag, the command provides a list of agent API names for you to choose from. Use the flag to specify the exact agent without being prompted.

# examples

- Deactivate an agent in your default target org by being prompted:

  <%= config.bin %> <%= command.id %>

- Deactivate the agent Resort_Manager in the org with alias "my_org":

  <%= config.bin %> <%= command.id %> --api-name Resort_Manager --target-org my-org

# flags.api-name.summary

API name of the agent to deactivate; if not specified, the command provides a list that you choose from.

# error.missingRequiredFlags

Missing required flags: %s.

# error.agentNotFound

Agent '%s' not found in the org. Check that the API name is correct and that the agent exists.

# error.deactivationFailed

Failed to deactivate agent: %s
