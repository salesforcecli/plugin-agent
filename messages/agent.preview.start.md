# summary

Start a programmatic agent preview session. 

# description

This command outputs a session ID that you then use with the "agent preview send" command to send an utterance to the agent.  Use the "agent preview sessions" command to list all active sessions and the "agent preview end" command to end a specific session.

Identify the agent you want to start previewing with either the --authoring-bundle flag to specify a local authoring bundle's API name or --api-name to specify an activated published agent's API name.  To find either API name, navigate to your package directory in your DX project. The API name of an authoring bundle is the same as its directory name under the "aiAuthoringBundles" metadata directory.  Similarly, the published agent's API name is the same as its directory name under the "Bots" metadata directory. 

When starting a preview session using the authoring bundle, which contains the agent's Agent Script file, the preview uses mocked actions by default.  Specify --use-live-actions for live mode, which uses the real Apex classes, flows, etc, in the org for the actions.

# flags.api-name.summary

API name of the activated published agent you want to preview.

# flags.authoring-bundle.summary

API name of the authoring bundle metadata component that contains the agent's Agent Script file.

# flags.use-live-actions.summary

Use real actions in the org; if not specified, preview uses AI to simulate (mock) actions.

# output.sessionId

Session ID: %s

# examples

- Start a programmatic agent preview session by specifying an authoring bundle; uses mocked actions by default. Use the org with alias "my-dev-org":

    <%= config.bin %> <%= command.id %> --authoring-bundle My_Agent_Bundle --target-org my-dev-org

- Similar to previous example but use live actions and the default org:

    <%= config.bin %> <%= command.id %> --authoring-bundle My_Agent_Bundle --use-live-actions

- Start a preview session with an activated published agent:

    <%= config.bin %> <%= command.id %> --api-name My_Published_Agent
