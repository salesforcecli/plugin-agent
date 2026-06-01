# summary

Delete an Agentforce Data Library.

# description

Permanently deletes a data library and all associated files and indexing data.

# examples

- Delete a data library:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --target-org myOrg

# flags.library-id.summary

Agentforce Data Library ID (18-char Salesforce ID with prefix 1JD).

# error.deleteFailed

Failed to delete data library: %s
