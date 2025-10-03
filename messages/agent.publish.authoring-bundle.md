# summary

Publish an Agent Authoring Bundle as a new agent

# description

Publishes an Agent Authoring Bundle by compiling the AF script and creating a new agent in your org.

# examples

- Publish an Agent Authoring Bundle:
  <%= config.bin %> <%= command.id %> --api-name path/to/bundle --agent-name "My New Agent" --target-org myorg@example.com

# flags.api-name.summary

API name of the Agent Authoring Bundle to publish

# flags.api-name.prompt

API name of the authoring bundle to publish

# flags.agent-name.summary

Name for the new agent to be created

# error.missingRequiredFlags

Required flag(s) missing: %s

# error.invalidBundlePath

Invalid bundle path. Please provide a valid path to an Agent Authoring Bundle.

# error.publishFailed

Failed to publish agent with the following errors:
%s

# error.agentNotFound

Could not find an .agent file with API name '%s' in the project.

# error.agentNotFoundAction

Please check that the API name is correct and that the .agent file exists in your project directory.
