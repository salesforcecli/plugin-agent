# summary

List cached preview sessions (beta).

# description

List preview sessions that were started with "agent preview start" and are still in the cache. Use this to see which sessions exist so you can end them with "agent preview end" (e.g. to clean up or resolve "multiple sessions" when using send without --session-id). Agent ID is the authoring bundle name for Agent Script agents, or the agent ID for published agents.

# output.empty

No cached preview sessions found.

# output.tableHeader.agent

Agent (authoring bundle or API name)

# output.tableHeader.sessionId

Session ID

# examples

- List all cached preview sessions:

  <%= config.bin %> <%= command.id %>
