# summary

Upload one or more files to an existing Agentforce Express Context library and wait for them to be indexed.

# description

Requests a pre-signed upload URL for each file, uploads the bytes, and registers the files so the Express Context service indexes them. Then checks indexing status every 2 seconds for up to 10 minutes.

If only some files are indexed, or indexing times out, you can continue with the indexed files, retry once, or abort. If the upload fails or you abort, you're asked to confirm deletion of the files this command uploaded; the library itself is never deleted. With --json, there are no prompts and any failure or partial indexing aborts and deletes this run's files.

To create a new library and add it to an authoring bundle, use "sf agent express-context create" instead.

Maximum 50 files per run and 100 MB per file.

# examples

- Upload a single file:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --file ./docs/faq.pdf --target-org myOrg

- Upload multiple files:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --file ./a.pdf --file ./b.pdf --target-org myOrg

# flags.library-id.summary

Express Context library ID (18-char Salesforce ID with prefix 1JD) or developer name (including the hash suffix).

# flags.file.summary

Path to a file to upload. Repeat the flag to upload multiple files.

# success

%s file(s) in library %s are ready.

# prompt.cleanup

Delete the %s file(s) this command uploaded to library %s?

# cleanup.failed

Upload didn't complete: %s

# cleanup.lookupFailed

Couldn't look up the uploaded files to clean them up: %s

# cleanup.kept

Kept uploaded files: %s

# cleanup.deleted

Deleted %s.

# cleanup.partial

Some files couldn't be deleted; remove them manually:
%s

# error.notIndexed

Not all files were indexed.
