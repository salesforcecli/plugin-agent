# summary

List the assets (tools, prompts, and resources) for an MCP server in the catalog.

# description

Returns the assets discovered for the specified MCP server, including each asset's kind (MCP_TOOL, MCP_PROMPT, or MCP_RESOURCE), whether it is active, and whether it is available as an agent action.

# examples

- List the assets for an MCP server in the default target org:

  <%= config.bin %> <%= command.id %> --target-org myOrg --mcp-server-id 0XSxx0000000001

- List the assets for an MCP server and output as JSON:

  <%= config.bin %> <%= command.id %> --target-org myOrg --mcp-server-id 0XSxx0000000001 --json

# flags.mcp-server-id.summary

The ID of the MCP server whose assets you want to list.

# error.failed

Failed to list MCP server assets: %s
