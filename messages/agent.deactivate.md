# summary

Deactivate an agent in the org.

# description

An agent can be active or inactive within an org. Active agents are available in the org and can be previewed using the CLI or VS Code while inactive agents cannot.

# examples

- Deactivate an agent in the default target org by being prompted:

  <%= config.bin %> <%= command.id %>

- Deactivate an agent by specifying the agent API name and target org:

  <%= config.bin %> <%= command.id %> --api-name Resort_Manager --target-org my-org

# flags.api-name.summary

API name of the agent to deactivate.

# error.missingRequiredFlags

Missing required flags: %s.
