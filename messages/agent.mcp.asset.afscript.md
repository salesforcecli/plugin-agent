# summary

Print or add the Agent Script action blocks and reasoning actions for MCP tools of a server.

# description

Prints the same Agent Script blocks that Agentforce Builder writes when you add the tool to an agent: one action block for the subagent actions section and one reasoning action for the reasoning actions section, for each tool. The blocks are indented for a subagent: action blocks at 8 spaces (under `actions:`) and reasoning actions at 12 spaces (under `reasoning:` > `actions:`). Paste them as printed. With --json, the blocks are returned without indentation.

Select tools by name with --tool (with or without the `McpTool__` prefix) or by asset ID with --asset-id. You must use at least one of the two flags. Each tool must be allowlisted (active) on the MCP server; run "agent mcp asset replace" to allowlist a tool. The output follows the order of the flags: all --tool values first, then all --asset-id values. Duplicates are sent once.

To add the blocks to a local authoring bundle instead of printing them, use --authoring-bundle with one or more --subagent flags. The command adds each action block under the subagent's `actions:` and each reasoning action under its `reasoning:` > `actions:`, and creates a missing section. It skips an action that the subagent already has, so you can run it again safely. Then it compiles the bundle in the org; if the compile fails, it restores the file. Run the command from a Salesforce DX project.

The API call also assigns the MCP runtime permissions that Agentforce Builder assigns, so it is not read-only.

# examples

- Print the Agent Script for one tool of an MCP server:

  <%= config.bin %> <%= command.id %> --target-org myOrg --mcp-server-id 0XSxx0000000001 --tool hello_world

- Print the Agent Script for two tools:

  <%= config.bin %> <%= command.id %> --target-org myOrg --mcp-server-id 0XSxx0000000001 --tool hello_world --tool add

- Select a tool by its asset ID and output as JSON:

  <%= config.bin %> <%= command.id %> --target-org myOrg --mcp-server-id 0XSxx0000000001 --asset-id 1XOxx0000000001 --json

- Add two tools to the "order_status" and "returns" subagents of the "My_Agent" authoring bundle:

  <%= config.bin %> <%= command.id %> --target-org myOrg --mcp-server-id 0XSxx0000000001 --tool hello_world --tool add --authoring-bundle My_Agent --subagent order_status --subagent returns

# flags.mcp-server-id.summary

The ID of the MCP server that owns the tools.

# flags.tool.summary

Name of a tool on the server, with or without the `McpTool__` prefix. Repeat the flag for more tools.

# flags.asset-id.summary

Asset ID (1XO...) of a tool on the server. Repeat the flag for more tools.

# flags.authoring-bundle.summary

API name of a local authoring bundle to update instead of printing the blocks. Requires --subagent.

# flags.subagent.summary

Name of a subagent (or the start agent) in the authoring bundle to add the tools to. Repeat the flag for more subagents. Requires --authoring-bundle.

# info.subagentUpdated

Subagent %s: added %s; already present %s.

# info.bundleUpdated

Updated and compiled %s.

# error.notInProject

--authoring-bundle needs a Salesforce DX project. Run the command from the project directory.

# error.bundleNotFound

Cannot find an authoring bundle named %s in the project's package directories.

# error.subagentNotFound

Cannot find subagent %s in the authoring bundle. Subagents in the file: %s

# error.compileFailed

The updated Agent Script did not compile, so %s is restored to its previous content:
%s

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
