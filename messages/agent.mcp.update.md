# summary

Update an MCP server registered in the API Catalog.

# description

Updates an existing MCP server in the API Catalog. Only the fields you provide are changed; omitted fields are left untouched. You can update the label, description, and server URL, and replace the authorization configuration. When setting `--auth-type OAUTH`, you must also provide `--identity-provider`, `--client-id`, `--client-secret`, and `--scope`. When setting `--auth-type NO_AUTH`, no authorization credentials are required. At least one updatable field must be supplied.

# examples

- Update the label and description of an MCP server in the default target org:

  <%= config.bin %> <%= command.id %> --mcp-server-id 0XSxx0000000001 --label "Orders MCP" --description "Order tooling" --target-org myOrg

- Update the server URL and switch the authorization to OAuth, piping the client secret from stdin and outputting as JSON:

  cat secret.txt | <%= config.bin %> <%= command.id %> --mcp-server-id 0XSxx0000000001 --server-url https://mcp.example.com --auth-type OAUTH --identity-provider MyIdp --client-id abc --client-secret - --scope "read write" --target-org myOrg --json

# flags.mcp-server-id.summary

ID of the MCP server to update.

# flags.label.summary

New display label for the MCP server.

# flags.description.summary

New description for the MCP server.

# flags.server-url.summary

New endpoint URL of the MCP server.

# flags.auth-type.summary

Authorization type to apply to the MCP server (OAUTH or NO_AUTH).

# flags.identity-provider.summary

Identity provider name for OAuth authorization (required when --auth-type is OAUTH).

# flags.client-id.summary

OAuth client ID (required when --auth-type is OAUTH).

# flags.client-secret.summary

OAuth client secret (required when --auth-type is OAUTH). Pass "-" to read it from stdin (piped) and keep it out of shell history.

# flags.scope.summary

OAuth scope (required when --auth-type is OAUTH).

# error.failed

Failed to update MCP server: %s

# error.noFields

No fields to update. Provide at least one of --label, --description, --server-url, or --auth-type.

# error.missingOauthFields

OAuth authorization requires --identity-provider, --client-id, --client-secret, and --scope.
