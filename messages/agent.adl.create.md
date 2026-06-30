# summary

Create an Agentforce Data Library.

# description

Creates a new data library in the target org. The --source-type flag determines the type of library: SFDRIVE (file upload), KNOWLEDGE (Salesforce Knowledge articles), or RETRIEVER (existing active Custom Retriever).

For SFDRIVE libraries, creation provisions the full Data Cloud pipeline (DLO → DMO → SearchIndex → Retriever). Upload files with `sf agent adl upload` after creation.

# examples

- Create an SFDRIVE library:

  <%= config.bin %> <%= command.id %> --target-org myOrg --name "My Docs" --developer-name My_Docs --source-type sfdrive

- Create a KNOWLEDGE library with index fields:

  <%= config.bin %> <%= command.id %> --target-org myOrg --name "KB Library" --developer-name KB_Library --source-type knowledge --primary-index-field1 Title --primary-index-field2 Summary

- Create a RETRIEVER library:

  <%= config.bin %> <%= command.id %> --target-org myOrg --name "Existing Retriever" --developer-name Existing_Retriever --source-type retriever --retriever-id 0ppXX0000000001

# flags.name.summary

Display name for the data library (max 80 characters).

# flags.developer-name.summary

API name for the data library (max 80 characters, alphanumeric and underscores only, must start with a letter).

# flags.source-type.summary

Type of grounding source: sfdrive (file upload), knowledge (Salesforce Knowledge articles), or retriever (existing active Custom Retriever).

# flags.description.summary

Description of the data library (max 255 characters).

# flags.index-mode.summary

Index mode for SFDRIVE libraries: basic or enhanced.

# flags.retriever-id.summary

ID of an active Custom Retriever (required for RETRIEVER source type; retriever must be active).

# flags.primary-index-field1.summary

Primary index field 1 for KNOWLEDGE libraries (required, immutable after creation).

# flags.primary-index-field2.summary

Primary index field 2 for KNOWLEDGE libraries (required, immutable after creation).

# flags.content-fields.summary

Comma-separated list of content fields for KNOWLEDGE libraries (optional, mutable after creation).

# flags.data-category-ids.summary

Comma-separated list of data category selection IDs for KNOWLEDGE libraries. Mutually exclusive with --data-category-names (provide one or the other, not both).

# flags.data-category-names.summary

Comma-separated list of data category names in qualified format (e.g., "Group_API_Name.Category"). Mutually exclusive with --data-category-ids (provide one or the other, not both).

# flags.wait.summary

Wait N minutes for indexing to complete (KNOWLEDGE libraries). SFDRIVE libraries require upload before indexing; RETRIEVER libraries are ready immediately.

# error.createFailed

Failed to create data library: %s

# error.missingKnowledgeFields

KNOWLEDGE source type requires --primary-index-field1 and --primary-index-field2.

# error.missingRetrieverId

RETRIEVER source type requires --retriever-id.

# error.dataCategoryMutuallyExclusive

--data-category-ids and --data-category-names are mutually exclusive. Provide one or the other, not both.
