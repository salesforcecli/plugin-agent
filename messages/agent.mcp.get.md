# summary

Get a single MCP server registered in the API Catalog.

# description

Retrieves the details of an MCP (Model Context Protocol) server by its identifier, including its name, label, type, status, and server URL.

# examples

- Get an MCP server by id in the default target org:

  <%= config.bin %> <%= command.id %> --target-org myOrg --mcp-server-id 0Mx000000000001

- Get an MCP server and output as JSON:

  <%= config.bin %> <%= command.id %> --target-org myOrg --mcp-server-id 0Mx000000000001 --json

# flags.mcp-server-id.summary

The identifier of the MCP server to retrieve.

# error.failed

Failed to get MCP server: %s
