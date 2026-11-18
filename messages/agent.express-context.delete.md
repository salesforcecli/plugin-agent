# summary

Delete an Agentforce Express Context library.

# description

Permanently deletes an Express Context library and its indexed files. This cannot be undone. You are prompted to confirm unless you pass --no-prompt.

# examples

- Delete a library (with confirmation prompt):

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --target-org myOrg

- Delete without prompting (for scripts and CI):

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --no-prompt --target-org myOrg

# flags.library-id.summary

Express Context library ID (18-char Salesforce ID with prefix 1JD) or developer name (including the hash suffix).

# flags.no-prompt.summary

Skip the confirmation prompt.

# confirm

Delete Express Context library %s and all its indexed files? This cannot be undone.

# success

Deleted Express Context library %s.
