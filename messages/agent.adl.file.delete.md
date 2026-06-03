# summary

Delete a file from an Agentforce Data Library.

# description

Permanently removes a file from an SFDRIVE data library and triggers re-indexing of the search index.

# examples

- Delete a file from a data library:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --file-id a1B2C3D4E5F6G7H8I9 --target-org myOrg

# flags.library-id.summary

Agentforce Data Library ID (18-char Salesforce ID with prefix 1JD).

# flags.file-id.summary

ID of the file to delete (AiGroundingFileRef record ID).

# error.deleteFailed

Failed to delete file: %s
