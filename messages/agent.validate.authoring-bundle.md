# summary

Validate an Agent Authoring Bundle

# description

Validates an Agent Authoring Bundle by compiling the AF script and checking for errors.

# examples

- Validate an Agent Authoring Bundle:
  <%= config.bin %> <%= command.id %> --api-name path/to/bundle

# flags.api-name.summary

Path to the Agent Authoring Bundle to validate

# error.missingRequiredFlags

Required flag(s) missing: %s

# error.invalidBundlePath

Invalid bundle path. Please provide a valid path to an Agent Authoring Bundle.

# error.compilationFailed

AF Script compilation failed with the following errors:
%s

# error.afscriptNotFound

Could not find an .agent file with API name '%s' in the project.

# error.afscriptNotFoundAction

Please check that the API name is correct and that the .agent file exists in your project directory.
