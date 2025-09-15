# summary

Publish an Agent Authoring Bundle as a new agent

# description

Publishes an Agent Authoring Bundle by compiling the AF script and creating a new agent in your org.

# examples

- Publish an Agent Authoring Bundle:
  <%= config.bin %> <%= command.id %> --bundle-path path/to/bundle --agent-name "My New Agent" --target-org myorg@example.com

# flags.bundle-path.summary

Path to the Agent Authoring Bundle to publish

# flags.agent-name.summary

Name for the new agent to be created

# error.missingRequiredFlags

Required flag(s) missing: %s

# error.invalidBundlePath

Invalid bundle path. Please provide a valid path to an Agent Authoring Bundle.

# error.publishFailed

Failed to publish agent with the following errors:
%s
