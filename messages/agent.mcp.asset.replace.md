# summary

Replace the asset set of an MCP server in the API Catalog.

# description

Replaces the full set of assets (tools, prompts, resources) for an MCP server with the asset items you supply. Provide the assets either inline with `--assets` (a JSON string, or `-` to read from stdin) or from a file with `--assets-file`. The JSON must be either an array of asset items or an object of the form `{ "assets": [...] }`. Each asset item may include `id`, `name`, `label`, `description`, `active`, and `kind`. This is a full replacement: existing assets not present in the supplied set are removed, so provide the complete desired asset set (read the current set first with `agent mcp asset list` or `agent mcp fetch`).

# examples

- Replace the assets inline with a JSON string:

  <%= config.bin %> <%= command.id %> --mcp-server-id 0XSxx0000000001 --assets '{"assets":[{"name":"McpTool__add","active":true}]}' --target-org myOrg

- Replace the assets from a JSON file:

  <%= config.bin %> <%= command.id %> --mcp-server-id 0XSxx0000000001 --assets-file ./assets.json --target-org myOrg

- Pipe the assets from stdin:

  cat assets.json | <%= config.bin %> <%= command.id %> --mcp-server-id 0XSxx0000000001 --assets - --target-org myOrg

# flags.mcp-server-id.summary

ID of the MCP server whose assets you want to replace.

# flags.assets.summary

The desired asset allowlist as a JSON string (or "-" to read from stdin). Mutually exclusive with --assets-file.

# flags.assets-file.summary

Path to a JSON file containing the desired asset allowlist. Mutually exclusive with --assets.

# error.failed

Failed to replace MCP server assets: %s

# error.noInput

Provide the assets either inline with --assets or from a file with --assets-file.

# error.invalidJson

The assets input does not contain valid JSON.

# error.invalidShape

The assets input must be a JSON array of asset items or an object with an "assets" array.
