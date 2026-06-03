# summary

Get details of an Agentforce Data Library.

# description

Returns the full detail of a data library including its grounding source configuration, status, and retriever ID.

# examples

- Get details of a data library:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --target-org myOrg

# flags.library-id.summary

Agentforce Data Library ID (18-char Salesforce ID with prefix 1JD).

# error.getFailed

Failed to get data library: %s
