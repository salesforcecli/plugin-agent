# summary

List the Agentforce Express Context libraries in an org.

# description

Agentforce Express Context (AEC) libraries are lightweight, realtime retrieval libraries that bypass the Data Cloud pipeline used by Agentforce Data Libraries. This command lists every AEC library in the target org with its ID, developer name, and indexing status.

# examples

- List all Express Context libraries in your default org:

  <%= config.bin %> <%= command.id %> --target-org myOrg

# error.listFailed

Failed to list Express Context libraries: %s
