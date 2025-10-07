# summary

Validate an Agent Authoring Bundle

# description

Validates an Agent Authoring Bundle by compiling the .agent file and checking for errors.

# examples

- Validate an Agent Authoring Bundle:
  <%= config.bin %> <%= command.id %> --api-name path/to/bundle

# flags.api-name.summary

API name of the Agent Authoring Bundle to validate.

# flags.api-name.prompt

API name of the authoring bundle to validate

# error.missingRequiredFlags

Required flag(s) missing: %s

# error.invalidBundlePath

Invalid bundle path. Please provide a valid path to an Agent Authoring Bundle.

# error.compilationFailed

Agent compilation failed with the following errors:
%s

# error.agentNotFound

Could not find an .agent file with API name '%s' in the project.

# error.agentNotFoundAction

Please check that the API name is correct and that the .agent file exists in your project directory.
