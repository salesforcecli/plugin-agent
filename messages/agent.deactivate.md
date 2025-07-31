# summary

Deactivate an agent in an org.

# description

Deactivating an agent makes it unavailable to your users. To make changes to an agent, such as adding or removing topics or actions, you must deactivate it. You can't preview an agent with the "agent preview" CLI command or VS Code if it's deactivated.

You must know the agent's API name to deactivate it; you can either be prompted for it or you can specify it with the --api-name flag. Find the agent's API name in its Agent Details page of your org's Agentforce Studio UI in Setup.

# examples

- Deactivate an agent in your default target org by being prompted:

  <%= config.bin %> <%= command.id %>

- Deactivate the agent Resort_Manager in the org with alias "my_org":

  <%= config.bin %> <%= command.id %> --api-name Resort_Manager --target-org my-org

# flags.api-name.summary

API name of the agent to deactivate.

# error.missingRequiredFlags

Missing required flags: %s.
