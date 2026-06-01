# summary

List Agentforce Data Libraries in an org.

# description

Returns all data libraries in the target org, including their source type, status, and library ID.

# examples

- List all data libraries in the default target org:

  <%= config.bin %> <%= command.id %> --target-org myOrg

- List data libraries and output as JSON:

  <%= config.bin %> <%= command.id %> --target-org myOrg --json

# error.listFailed

Failed to list data libraries: %s
