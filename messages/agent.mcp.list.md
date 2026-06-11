# summary

List the MCP servers registered in the API Catalog.

# description

Returns the Model Context Protocol (MCP) servers registered in the API Catalog, optionally filtered by label, type, or status. Use this to discover which MCP servers are available and inspect their server URLs and current status.

# examples

- List all MCP servers in the default target org:

  <%= config.bin %> <%= command.id %> --target-org myOrg

- List external MCP servers filtered by status and output as JSON:

  <%= config.bin %> <%= command.id %> --target-org myOrg --type EXTERNAL --status ACTIVE --json

# flags.label.summary

Filter the MCP servers by label.

# flags.type.summary

Filter the MCP servers by type.

# flags.status.summary

Filter the MCP servers by connection status. Only ACTIVE and DISCONNECTED are supported as filters.

# error.failed

Failed to list MCP servers: %s
