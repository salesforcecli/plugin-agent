# summary

Replace the asset set of an MCP server in the API Catalog.

# description

Replaces the full set of assets (tools, prompts, resources) for an MCP server with the asset items supplied in a JSON file. The file must contain either a JSON array of asset items or an object of the form `{ "assets": [...] }`. Each asset item may include `id`, `name`, `label`, `description`, `active`, and `kind`. Existing assets not present in the supplied set may be removed, so provide the complete desired asset set.

# examples

- Replace the assets of an MCP server using a JSON file that contains an array of asset items:

  <%= config.bin %> <%= command.id %> --mcp-server-id 0XSxx0000000001 --assets-file ./assets.json --target-org myOrg

- Replace the assets and output the result as JSON:

  <%= config.bin %> <%= command.id %> --mcp-server-id 0XSxx0000000001 --assets-file ./assets.json --target-org myOrg --json

# flags.mcp-server-id.summary

ID of the MCP server whose assets you want to replace.

# flags.assets-file.summary

Path to a JSON file containing an array of asset items or an object of the form { "assets": [...] }.

# error.failed

Failed to replace MCP server assets: %s

# error.invalidJson

The assets file does not contain valid JSON.

# error.invalidShape

The assets file must contain a JSON array of asset items or an object with an "assets" array.
