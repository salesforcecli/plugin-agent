# summary

List files in an Agentforce Data Library.

# description

Returns a paginated list of files in an SFDRIVE library with per-file indexing status.

# examples

- List files in a data library:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --target-org myOrg

- List files and output as JSON:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --target-org myOrg --json

# flags.library-id.summary

Agentforce Data Library ID (18-char Salesforce ID with prefix 1JD).

# error.listFailed

Failed to list files: %s
