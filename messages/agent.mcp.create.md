# summary

Create an MCP server in the API Catalog.

# description

Registers an external Model Context Protocol (MCP) server with the API Catalog and discovers its assets (tools, prompts, and resources). Provide the server URL and, when the server requires it, OAuth authorization details. When the authorization type is OAUTH you must supply the identity provider, client ID, client secret, and scope.

# examples

- Create an MCP server with no authentication:

  <%= config.bin %> <%= command.id %> --name myServer --server-url https://mcp.example.com --target-org myOrg

- Create an MCP server that uses OAuth authentication, piping the client secret from stdin to keep it out of shell history:

  cat secret.txt | <%= config.bin %> <%= command.id %> --name myServer --server-url https://mcp.example.com --auth-type OAUTH --identity-provider myIdp --client-id abc123 --client-secret - --scope "read write" --target-org myOrg

# flags.name.summary

Unique name of the MCP server.

# flags.label.summary

Human-readable label for the MCP server.

# flags.description.summary

Description of the MCP server.

# flags.server-url.summary

URL of the external MCP server.

# flags.auth-type.summary

Authorization type to use when connecting to the MCP server.

# flags.identity-provider.summary

Identity provider to use for OAuth authorization. Required when auth-type is OAUTH.

# flags.client-id.summary

OAuth client ID. Required when auth-type is OAUTH.

# flags.client-secret.summary

OAuth client secret. Required when auth-type is OAUTH. Pass "-" to read it from stdin (piped) and keep it out of shell history.

# flags.scope.summary

OAuth scope to request. Required when auth-type is OAUTH.

# error.missingOauthFields

When auth-type is OAUTH you must provide --identity-provider, --client-id, --client-secret, and --scope.

# error.failed

Failed to create MCP server: %s
