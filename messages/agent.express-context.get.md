# summary

Get details for a single Agentforce Express Context library.

# description

Returns the full metadata for one Express Context library, including its retriever and retriever-action wiring.

# examples

- Get a library by ID:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --target-org myOrg

# flags.library-id.summary

Express Context library ID (18-char Salesforce ID with prefix 1JD) or developer name (including the hash suffix).
