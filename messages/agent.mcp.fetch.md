# summary

Fetch the live assets (tools, prompts, resources) advertised by an MCP server.

# description

Performs a live fetch against the configured MCP server identified by its ID, returning the assets (MCP tools, prompts, and resources) it currently advertises along with their status and activation state. Use this to refresh the view of what an MCP server exposes before activating its assets as agent actions.

The response also includes a `serverFingerprint` — an opaque hash of the server's current tool definitions. Pass it to `agent mcp asset replace --server-fingerprint` to confirm the definitions you reviewed are still current when you save the allowlist.

# examples

- Fetch the assets advertised by an MCP server in the default target org:

  <%= config.bin %> <%= command.id %> --target-org myOrg --mcp-server-id 0XSxx0000000001

- Fetch MCP server assets and output as JSON:

  <%= config.bin %> <%= command.id %> --target-org myOrg --mcp-server-id 0XSxx0000000001 --json

# flags.mcp-server-id.summary

ID of the MCP server to fetch assets from.

# output.serverFingerprint

Server fingerprint: %s

# error.failed

Failed to fetch MCP server assets: %s
