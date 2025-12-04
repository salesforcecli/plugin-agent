# summary

Interact with an agent to preview how it responds to your statements, questions, and commands (utterances).

# description

Use this command to have a natural language conversation with an agent while you code its Agent Script file. Previewing an agent works like an initial test to make sure it responds to your utterances as you expect. For example, you can test that the agent uses a particular topic when asked a question, and then whether it invokes the correct action associated with that topic. This command is the CLI-equivalent of the Preview panel in your org's Agentforce Builder UI.

This command uses the agent's local authoring bundle, which contains its Agent Script file. You can let the command provide a list of authoring bundles (labeled "(Agent Script)") to choose from or use the --authoring-bundle flag to specify a bundle's API name.

You can use these two modes when previewing an agent from its Agent Script file:

- Simulated mode (Default): Uses only the Agent Script file to converse, and it simulates (mocks) all the actions. Use this mode if none of the Apex classes, flows, and prompt templates that implement your actions are available yet. The LLM uses the information about topics in the Agent Script file to simulate what the action does or how it responds.
- Live mode: Uses the actual Apex classes, flows, and prompt templates in your development org in the agent preview. If you've changed the Apex classe, flows, or prompt templates in your local DX project, then you must deploy them to your development org if you want to use them in your live preview. You can use the Apex Replay Debugger to debug your Apex classes when using live mode.

The interface is simple: in the "Start typing..." prompt, enter a statement, question, or command; when you're done, enter Return. Your utterance is posted on the right along with a timestamp. The agent then responds on the left. To exit the conversation, hit ESC or Control+C.

When the session concludes, the command asks if you want to save the API responses and chat transcripts. By default, the files are saved to the "./temp/agent-preview" directory. Specify a new default directory with the --output-dir flag.

NOTE: You can also use this command to connect to a published and active agent, which are labeled "(Published)" if you let this command provide the list of agents to preview. That use case, however, requires additional security and configuration in both your org and your DX project. The examples in this help are for previewing an agent from its Agent Script file in your DX project and require only simple authorization of your org, such as with the "org login web" command. The --client-app and --api-name flags are used only for previewing published and active agents, they don't apply to Agent Script agents. See "Connect to a Published Agent" in the "Agentforce Developer Guide" for complete documentation: https://developer.salesforce.com/docs/einstein/genai/guide/agent-dx-preview.html.

# flags.api-name.summary

API name of the published and active agent you want to interact with.

# flags.authoring-bundle.summary

API name of the authoring bundle metadata component that contains the agent's Agent Script file.

# flags.client-app.summary

Name of the linked client app to use for the connection to the published and active agent.

# flags.output-dir.summary

Directory where conversation transcripts are saved.

# flags.use-live-actions.summary

Use real actions in the org; if not specified, preview uses AI to simulate (mock) actions.

# flags.apex-debug.summary

Enable Apex debug logging during the agent preview conversation.

# examples

- Preview an agent in simulated mode by choosing from a list of authoring bundles provided by the command; use the org with alias "my-dev-org":

  <%= config.bin %> <%= command.id %> --target-org my-dev-org

- Preview an agent in live mode by choosing from a list of authoring bundles. Save the conversation transcripts to the "./transcripts/my-preview" directory, enable the Apex debug logs, and use your default org:

  <%= config.bin %> <%= command.id %> --use-live-actions --apex-debug --output-dir transcripts/my-preview
