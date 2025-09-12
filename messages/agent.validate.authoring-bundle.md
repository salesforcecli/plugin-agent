# summary

Validate an Agent Authoring Bundle

# description

Validates an Agent Authoring Bundle by compiling the AF script and checking for errors.

# examples

- Validate an Agent Authoring Bundle:
  <%= config.bin %> <%= command.id %> --bundle-path path/to/bundle

# flags.bundle-path.summary

Path to the Agent Authoring Bundle to validate

# error.missingRequiredFlags

Required flag(s) missing: %s

# error.invalidBundlePath

Invalid bundle path. Please provide a valid path to an Agent Authoring Bundle.

# error.compilationFailed

AF Script compilation failed with the following errors:
%s
