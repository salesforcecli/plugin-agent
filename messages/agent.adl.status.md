# summary

Get indexing status of an Agentforce Data Library.

# description

Returns the current indexing status including stage details (DATA_STREAM, DATA_LAKE_OBJECT, DATA_MODEL_OBJECT, SEARCH_INDEX, RETRIEVER) and any errors.

# examples

- Get status of a data library:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --target-org myOrg

# flags.library-id.summary

Agentforce Data Library ID (18-char Salesforce ID with prefix 1JD).

# flags.include-artifacts.summary

Resolve DC asset artifacts (DataStream, DLO, DMO, SearchIndex, Retriever) with entity IDs and names on each stage. Slower — requires additional queries.

# error.statusFailed

Failed to get data library status: %s
