# summary

Add files to an existing Agentforce Data Library.

# description

Adds one or more files to an existing SFDRIVE data library and triggers SearchIndex re-hydration. This is the day-2 operation for adding files to an already-provisioned library.

Constraints: at least 1 file required, no duplicate file names in a batch, maximum 1000 files per library.

# examples

- Add a file to an existing library:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --file ./docs/new-guide.pdf --target-org myOrg

# flags.library-id.summary

Agentforce Data Library ID (18-char Salesforce ID with prefix 1JD).

# flags.file.summary

Path to the file to add to the library.

# error.addFailed

Failed to add file: %s
