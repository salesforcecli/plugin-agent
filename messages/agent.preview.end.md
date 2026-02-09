# summary

End an existing programmatic agent preview session and get trace location.

# description

You must have previously started a programmatic agent preview session with the "agent preview start" command to then use this command to end it. This command also displays the local directory where the session trace files are stored. 

The original "agent preview start" command outputs a session ID which you then use with the --session-id flag of this command to end the session.  You don't have to specify the --session-id flag if an agent has only one active preview session. You must also use either the --authoring-bundle or --api-name flag to specify the API name of the authoring bundle or the published agent, respecitvely.  To find either API name, navigate to your package directory in your DX project. The API name of an authoring bundle is the same as its directory name under the "aiAuthoringBundles" metadata directory.  Similarly, the published agent's API name is the same as its directory name under the "Bots" metadata directory. 

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

- End a preview session of a published agent by specifying its session ID and API name ; use the default org:

    <%= config.bin %> <%= command.id %> --session-id <SESSION_ID> --api-name My_Published_Agent 

- Similar to previous example, but don't specify a session ID; you get an error if the published agent has more than one active session. Use the org with alias "my-dev-org":

    <%= config.bin %> <%= command.id %> --api-name My_Published_Agent --target-org my-dev-org

- End a preview session of an agent using its authoring bundle API name; you get an error if the agent has more than one active session.

    <%= config.bin %> <%= command.id %> --authoring-bundle My_Local_Agent
