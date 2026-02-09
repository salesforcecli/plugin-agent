# summary

List all known programmatic agent preview sessions.

# description

This command lists the agent preview sessions that were started with the "agent preview start" command and are still in the local cache. Use this command to discover specific session IDs that you can pass to the "agent preview send" or "agent preview end" commands with the --session-id flag.

Programmatic agent preview sessions can be started for both published activated agents and by using an agent's local authoring bundle, which contains its Agent Script file.  In this command's output table, the Agent column contains either the API name of the authoring bundle or the published agent, whichever was used when starting the session. In the table, if the same API name has multiple rows with different session IDs, then it means that you previously started multiple preview sessions with the associated agent. 

# output.empty

No cached agent preview sessions found.

# output.tableHeader.agent

Agent (authoring bundle or API name)

# output.tableHeader.sessionId

Session ID

# examples

- List all cached agent preview sessions:

   <%= config.bin %> <%= command.id %>
