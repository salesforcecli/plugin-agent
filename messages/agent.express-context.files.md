# summary

List the files indexed into an Agentforce Express Context library.

# description

Returns file metadata only — name, ID, size, and indexing status. The Express Context Connect API has no file-download endpoint; raw file bytes are not retrievable through the CLI.

# examples

- List files in a library:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --target-org myOrg

# flags.library-id.summary

Express Context library ID (18-char Salesforce ID with prefix 1JD) or developer name (including the hash suffix).
