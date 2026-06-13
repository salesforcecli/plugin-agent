# summary

Delete an MCP server from the API Catalog.

# description

Permanently removes an MCP (Model Context Protocol) server registration from the API Catalog, identified by its ID. By default you are prompted to confirm the deletion; pass --no-prompt to skip the confirmation (for example in scripts and CI).

# examples

- Delete an MCP server, confirming interactively:

  <%= config.bin %> <%= command.id %> --mcp-server-id 0XSxx0000000001 --target-org myOrg

- Delete an MCP server without a confirmation prompt:

  <%= config.bin %> <%= command.id %> --mcp-server-id 0XSxx0000000001 --target-org myOrg --no-prompt

# flags.mcp-server-id.summary

ID of the MCP server to delete.

# flags.no-prompt.summary

Skip the confirmation prompt and delete the MCP server immediately.

# confirm.delete

Are you sure you want to delete the MCP server %s? This action cannot be undone.

# error.aborted

Deletion aborted: the operation was not confirmed.

# error.failed

Failed to delete MCP server: %s
