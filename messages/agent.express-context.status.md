# summary

Show the indexing status of an Agentforce Express Context library.

# description

Returns richer indexing detail than the file list — the overall status, the retriever and retriever-action wiring, per-run indexed/failed file counts, and the last indexed timestamp.

# examples

- Check indexing status for a library:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --target-org myOrg

# flags.library-id.summary

Express Context library ID (18-char Salesforce ID with prefix 1JD) or developer name (including the hash suffix).
