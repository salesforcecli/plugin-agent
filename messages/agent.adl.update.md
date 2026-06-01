# summary

Update an Agentforce Data Library.

# description

Updates the label, description, or other mutable properties of an existing data library.

# examples

- Update the label of a data library:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --name "New Name" --target-org myOrg

- Update the description:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --description "Updated description" --target-org myOrg

- Update Knowledge library content fields (triggers re-indexing):

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --content-fields "Answer**c,Summary**c" --target-org myOrg

- Restrict Knowledge library to public articles:

  <%= config.bin %> <%= command.id %> --library-id 1JDSG000007IbWX4A0 --restrict-to-public-articles --target-org myOrg

# flags.library-id.summary

Agentforce Data Library ID (18-char Salesforce ID with prefix 1JD).

# flags.name.summary

New display name for the data library (max 80 characters).

# flags.description.summary

New description for the data library (max 255 characters).

# flags.content-fields.summary

Comma-separated list of content fields for KNOWLEDGE libraries (triggers re-indexing).

# flags.restrict-to-public-articles.summary

Restrict to public Knowledge articles only (KNOWLEDGE libraries, triggers re-indexing).

# error.updateFailed

Failed to update data library: %s
