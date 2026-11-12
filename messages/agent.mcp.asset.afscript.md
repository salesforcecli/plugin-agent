# summary

Print the Agent Script action blocks and reasoning actions for MCP tools of a server.

# description

Prints the same Agent Script blocks that Agentforce Builder writes when you add the tool to an agent: one action block for the subagent actions section and one reasoning action for the reasoning actions section, for each tool. The blocks are indented for a subagent: action blocks at 8 spaces (under `actions:`) and reasoning actions at 12 spaces (under `reasoning:` > `actions:`). Paste them as printed. With --json, the blocks are returned without indentation.

Select tools by name with --tool (with or without the `McpTool__` prefix) or by asset ID with --asset-id. You must use at least one of the two flags. Each tool must be allowlisted (active) on the MCP server; run "agent mcp asset replace" to allowlist a tool. The output follows the order of the flags: all --tool values first, then all --asset-id values. Duplicates are sent once.

The API call also assigns the MCP runtime permissions that Agentforce Builder assigns, so it is not read-only.

# examples

- Print the Agent Script for one tool of an MCP server:

  <%= config.bin %> <%= command.id %> --target-org myOrg --mcp-server-id 0XSxx0000000001 --tool hello_world

- Print the Agent Script for two tools:

  <%= config.bin %> <%= command.id %> --target-org myOrg --mcp-server-id 0XSxx0000000001 --tool hello_world --tool add

- Select a tool by its asset ID and output as JSON:

  <%= config.bin %> <%= command.id %> --target-org myOrg --mcp-server-id 0XSxx0000000001 --asset-id 1XOxx0000000001 --json

# flags.mcp-server-id.summary

The ID of the MCP server that owns the tools.

# flags.tool.summary

Name of a tool on the server, with or without the `McpTool__` prefix. Repeat the flag for more tools.

# flags.asset-id.summary

Asset ID (1XO...) of a tool on the server. Repeat the flag for more tools.

# error.noSelection

Specify at least one tool with --tool or --asset-id.

# error.listFailed

Failed to list MCP server assets: %s

# error.toolsNotFound

These tools were not found on the MCP server: %s. Available tools: %s

# error.notAllowlisted

These assets are not allowlisted: %s. Run "sf agent mcp asset replace" to allowlist them.

# error.notFoundAndNotAllowlisted

Not found on the MCP server: %s. Available tools: %s. Not allowlisted: %s. Run "sf agent mcp asset replace" to allowlist them.

# error.badRequest

The API rejected the request (400): %s

# error.forbidden

The API denied access (403). The API is not enabled for this org, or you cannot author agents: %s

# error.notFoundApi

The API was not found (404). The org needs API version 68.0 (release 264) or later: %s

# error.failed

Failed to generate the Agent Script for the MCP tools: %s
