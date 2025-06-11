# summary

Interact with an active agent to preview how the agent responds to your statements, questions, and commands (utterances).

# description

Use this command to have a natural language conversation with an active agent in your org, as if you were an actual user. The interface is simple: in the "Start typing..." prompt, enter a statement, question, or command; when you're done, enter Return. Your utterance is posted on the right along with a timestamp. The agent then responds on the left. To exit the conversation, hit ESC or Control+C.

This command is useful to test if the agent responds to your utterances as you expect. For example, you can test that the agent uses a particular topic when asked a question, and then whether it invokes the correct action associated with that topic. This command is the CLI-equivalent of the Conversation Preview panel in your org's Agent Builder UI.

When the session concludes, the command asks if you want to save the API responses and chat transcripts. By default, the files are saved to the "./temp/agent-preview" directory. Specify a new default directory by setting the environment variable "SF_AGENT_PREVIEW_OUTPUT_DIR" to the directory. Or you can pass the directory to the --output-dir flag.

Find the agent's API name in its main details page in your org's Agent page in Setup.

Before you use this command, you must complete these steps:

1. Create a connected app in your org as described in the "Create a Connected App" section here: https://developer.salesforce.com/docs/einstein/genai/guide/agent-api-get-started.html#create-a-connected-app. Do these four additional steps:

   a. When specifying the connected app's Callback URL, add this second callback URL on a new line: "http://localhost:1717/OauthRedirect".

   b. When adding the scopes to the connected app, add "Manage user data via Web browsers (web)".

   c. Ensure that the "Require Secret for Web Server Flow" option is not selected.

   d. Make note of the user that you specified as the "Run As" user when updating the Client Credentials Flow section.

2. Add the connected app to your agent as described in the "Add Connected App to Agent" section here: https://developer.salesforce.com/docs/einstein/genai/guide/agent-api-get-started.html#add-connected-app-to-agent.

3. Copy the consumer key from your connected app as described in the "Obtain Credentials" section here: https://developer.salesforce.com/docs/einstein/genai/guide/agent-api-get-started.html#obtain-credentials.

4. Link the connected app to your authenticated user with the required API scopes using the web server flow:

```
sf org login web --client-app agent-app --username <username> --client-id <consumer-key> --scopes "sfap_api chatbot_api api refresh_token api web"
```

IMPORTANT: You must use the "--client-id <CONNECTED-APP-CONSUMER-KEY>" flag of "org login web", where CONNECTED-APP-CONSUMER-KEY is the consumer key you previously copied. This step ensures that the "org login web" command uses your custom connected app, and not the default CLI connected app.

Press Enter to skip sharing the client secret.

5. When you run this command to interact with an agent, specify the org username and linked connected app with the --target-org and --client-app flags.

# flags.api-name.summary

API name of the agent you want to interact with.

# flags.client-app.summary

Name of the linked client app to use for the agent connection.

# flags.output-dir.summary

Directory where conversation transcripts are saved.

# flags.apex-debug.summary

Enable Apex debug logging during the agent preview conversation.

# examples

- Interact with an agent with API name "Resort_Manager" in the org with alias "my-org" and the linked "agent-app" connected app.

  <%= config.bin %> <%= command.id %> --api-name "Resort_Manager" --target-org my-org --client-app agent-app

- Same as the preceding example, but this time save the conversation transcripts to the "./transcripts/my-preview" directory rather than the default "./temp/agent-preview":

  <%= config.bin %> <%= command.id %> --api-name "Resort_Manager" --target-org my-org --client-app agent-app --output-dir "transcripts/my-preview"
