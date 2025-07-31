# summary

Activate an agent in an org.

# description

Activating an agent makes it immediately available to your users. An agent must be active before you can preview it with the "agent preview" CLI command or VS Code.

You must know the agent's API name to activate it; you can either be prompted for it or you can specify it with the --api-name flag. Find the agent's API name in its Agent Details page of your org's Agentforce Studio UI in Setup.

# examples

- Activate an agent in your default target org by being prompted:

  <%= config.bin %> <%= command.id %>

- Activate an agent with API name Resort_Manager in the org with alias "my-org":

  <%= config.bin %> <%= command.id %> --api-name Resort_Manager --target-org my-org

# flags.api-name.summary

API name of the agent to activate.

# error.missingRequiredFlags

Missing required flags: %s.
