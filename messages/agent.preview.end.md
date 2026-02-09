# summary

End an existing programmatic agent preview session and get trace location.

# description

You must have previously started a programmatic agent preview session with the "agent preview start" command to then use this command to end it. This command also displays the local directory where the session trace files are stored. 

The original "agent preview start" command outputs a session ID which you then use with this command. Alternatively, you can use the --authoring-bundle or --api-name flags to specify the API name of the authoring bundle, or the agent itself, as long as the agent has only one active preview session. If it has multiple sessions, then you must instead use --session-id to identify the exact one you want to end.

# flags.session-id.summary

Session ID outputted by "agent preview start". Not required when the agent has exactly one active session. Run "agent preview sessions" to see the list of all sessions.

# flags.api-name.summary

API name of the activated published agent you want to preview.

# flags.authoring-bundle.summary

API name of the authoring bundle metadata component that contains the agent's Agent Script file.

# error.noSession

No agent preview session found. Run "sf agent preview start" to start a new agent preview session.

# error.multipleSessions

Multiple preview sessions found for this agent. Use the --session-id flag to identify a specific session. Sessions: %s

# output.tracesPath

Session traces: %s

# examples

- End an agent preview session by specifying its session ID; use the default org:

    <%= config.bin %> <%= command.id %> --session-id <SESSION_ID>

- End an agent preview session using the API name of the published agent; you get an error if the agent has more than one active session. Use the org with alias "my-dev-org":

    <%= config.bin %> <%= command.id %> --api-name My_Published_Agent --target-org my-dev-org

- End an agent preview session using its authoring bundle API name; you get an error if the agent has more than one active session.

    <%= config.bin %> <%= command.id %> --authoring-bundle My_Local_Agent
