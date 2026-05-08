# summary

End an existing programmatic agent preview session and get trace location.

# description

You must have previously started a programmatic agent preview session with the "agent preview start" command to then use this command to end it. This command also displays the local directory where the session trace files are stored.

The original "agent preview start" command outputs a session ID which you then use with the --session-id flag of this command to end the session. You don't have to specify the --session-id flag if an agent has only one active preview session. You must also use either the --authoring-bundle or --api-name flag to specify the API name of the authoring bundle or the published agent, respectively. To find either API name, navigate to your package directory in your DX project. The API name of an authoring bundle is the same as its directory name under the "aiAuthoringBundles" metadata directory. Similarly, the published agent's API name is the same as its directory name under the "Bots" metadata directory.

Use the --all flag to end all active preview sessions at once. You can combine --all with --api-name or --authoring-bundle to end only sessions for a specific agent, or use --all on its own to end every session across all agents in the project.

# flags.session-id.summary

Session ID outputted by "agent preview start". Not required when the agent has exactly one active session. Run "agent preview sessions" to see the list of all sessions.

# flags.api-name.summary

API name of the activated published agent you want to preview.

# flags.authoring-bundle.summary

API name of the authoring bundle metadata component that contains the agent's Agent Script file.

# flags.all.summary

End all active preview sessions. Combine with --api-name or --authoring-bundle to limit to a specific agent, or use with only --target-org to end sessions for all agents found in the local session cache. Requires --target-org.

# flags.no-prompt.summary

Don't prompt for confirmation before ending sessions. Has an effect only when used with --all.

# error.exactlyOneRequired

Exactly one of the following must be provided: --api-name, --authoring-bundle

# error.noSession

No agent preview session found. Run "sf agent preview start" to start a new agent preview session.

# error.multipleSessions

Multiple preview sessions found for this agent. Use the --session-id flag to identify a specific session. Sessions: %s

# error.agentNotFound

Agent '%s' not found. Check that the API name is correct and that the agent exists in your org or project.

# error.sessionInvalid

Preview session '%s' is invalid or has expired.

# error.endFailed

Failed to end preview session: %s

# output.tracesPath

Session traces: %s

# output.noSessionsFound

No active preview sessions found.

# output.endedAll

Ended %s preview session(s).

# prompt.confirmAll

About to end %s preview session(s) for agent '%s'. Continue?

# prompt.confirmAllAgents

About to end %s preview session(s) across %s agent(s). Continue?

# examples

- End a preview session of a published agent by specifying its session ID and API name; use the default org:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID> --api-name My_Published_Agent

- Similar to previous example, but don't specify a session ID; you get an error if the published agent has more than one active session. Use the org with alias "my-dev-org":

  <%= config.bin %> <%= command.id %> --api-name My_Published_Agent --target-org my-dev-org

- End a preview session of an agent using its authoring bundle API name; you get an error if the agent has more than one active session.

  <%= config.bin %> <%= command.id %> --authoring-bundle My_Local_Agent

- End all active preview sessions for a specific agent without prompting:

  <%= config.bin %> <%= command.id %> --all --authoring-bundle My_Local_Agent --target-org <target_org> --no-prompt

- End all active preview sessions across every agent in the local session cache for an org:

  <%= config.bin %> <%= command.id %> --all --target-org <target_org>
