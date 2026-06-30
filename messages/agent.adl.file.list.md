# summary

List files in an Agentforce Data Library.

# description

Returns the list of files in an SFDRIVE library including file name, size, and creation date.

# examples

- List files in a data library:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --target-org myOrg

- List files and output as JSON:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --target-org myOrg --json

# flags.library-id.summary

Agentforce Data Library ID (18-char Salesforce ID with prefix 1JD).

# flags.page-size.summary

Number of files to return per page (1-200, default 50).

# flags.status.summary

Filter files by indexing status.

# error.listFailed

Failed to list files: %s
