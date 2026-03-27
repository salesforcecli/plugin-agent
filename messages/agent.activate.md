# summary

Activate an agent in an org.

# description

Activating an agent makes it immediately available to your users. A published agent must be active before you can preview it with the "agent preview" CLI command or VS Code. Agents can have multiple versions; only one version can be active at a time.

If you run the command without the --api-name or --version flags, the command provides a list of agent API names and versions for you to choose from. Use the flags to specify the exact agent and version without being prompted. If you use the --json flag and not --version, then the latest agent version is automatically activated.

The value of the --version flag is always a number, corresponding to the "vX" part of the "BotVersion" metadata in your project. For example, if you have a force-app/main/default/bots/My_Agent/v4.botVersion-meta.xml file in your project, then you activate this version with the "--version 4" flag.

# examples

- Activate an agent in your default target org by being prompted for both its API name and version:

  <%= config.bin %> <%= command.id %>

- Activate version 2 of an agent with API name Resort_Manager in the org with alias "my-org":

  <%= config.bin %> <%= command.id %> --api-name Resort_Manager --version 2 --target-org my-org

# flags.api-name.summary

API name of the agent to activate; if not specified, the command provides a list that you choose from.

# flags.version.summary

Version number of the agent to activate; if not specified, the command provides a list that you choose from.

# error.missingRequiredFlags

Missing required flags: %s.

# error.agentNotFound

Agent '%s' not found in the org. Check that the API name is correct and that the agent exists.

# error.activationFailed

Failed to activate agent: %s
