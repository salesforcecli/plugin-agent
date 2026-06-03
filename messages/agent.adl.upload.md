# summary

Upload a file to an SFDRIVE Agentforce Data Library.

# description

Performs the multi-step upload workflow: checks upload readiness, obtains a pre-signed S3 URL, uploads the file, triggers indexing, and optionally polls until the library is ready (retrieverId is populated).

This command only works with SFDRIVE libraries. KNOWLEDGE libraries index automatically after creation, and RETRIEVER libraries require no file upload.

# examples

- Upload a file and wait for indexing to complete:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --file ./docs/guide.pdf --target-org myOrg --wait 10

- Upload a file without waiting:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --file ./docs/guide.pdf --target-org myOrg

# flags.library-id.summary

Agentforce Data Library ID (18-char Salesforce ID with prefix 1JD).

# flags.file.summary

Path to the file to upload.

# flags.wait.summary

Number of minutes to wait for indexing to complete. If not specified, returns after triggering indexing.

# error.uploadReadiness

Library is not ready for upload: %s

# error.getUploadUrl

Failed to get upload URL: %s

# error.s3Upload

Failed to upload file to storage: %s

# error.indexing

Failed to trigger indexing: %s

# error.polling

Failed to poll library status: %s

# error.timeout

Indexing did not complete within the specified wait time. Use "sf agent adl get --library-id %s" to check status.
