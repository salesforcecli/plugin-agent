# summary

Generate an agent test spec, which is a YAML file that lists the test cases for testing a specific agent.

# description

The first step when using Salesforce CLI to create an agent test in your org is to use this interactive command to generate a local YAML-formatted test spec file. The test spec YAML file contains information about the agent being tested, such as its API name, and then one or more test cases. This command uses the metadata components in your DX project when prompting for information, such as the agent API name; it doesn't look in your org.

To generate a specific agent test case, this command prompts you for this information; when possible, the command provides a list of options for you to choose from:

- Utterance: Natural language statement, question, or command used to test the agent.
- Expected topic: API name of the topic you expect the agent to use when responding to the utterance.
- Expected actions: One or more API names of the expection actions the agent takes.
- Expected outcome: Natural language description of the outcome you expect.
- (Optional) Custom evaluation: Test an agent's response for specific strings or numbers.
- (Optional) Conversation history: Boilerplate for additional context you can add to the test in the form of a conversation history.

You can manually add contextVariables to test cases in the generated YAML file to inject contextual data (such as CaseId or RoutableId) into agent sessions. This is useful for testing agent behavior with different contextual information.

When your test spec is ready, you then run the "agent test create" command to actually create the test in your org and synchronize the metadata with your DX project. The metadata type for an agent test is `AiEvaluationDefinition` (legacy testing-center) or `AiTestingDefinition` (Agentforce Studio / NGT), selected via --test-runner.

If you have an existing AiEvaluationDefinition or AiTestingDefinition metadata XML file in your DX project, you can generate its equivalent YAML test spec file with the --from-definition flag. The runner is inferred from the file extension; pass --test-runner to override.

# flags.from-definition.summary

Filepath to an AiEvaluationDefinition or AiTestingDefinition metadata XML file in your DX project that you want to convert to a test spec YAML file.

# flags.force-overwrite.summary

Don't prompt for confirmation when overwriting an existing test spec YAML file.

# flags.output-file.summary

Name of the generated test spec YAML file. Default value is "specs/<AGENT_API_NAME>-testSpec.yaml" (legacy) or "specs/<AGENT_API_NAME>-ngtTestSpec.yaml" (Agentforce Studio).

# flags.test-runner.summary

Explicitly specify which test runner to use (agentforce-studio or testing-center).

# flags.test-runner.description

By default, the command automatically detects which test runner to use based on the test definition metadata type in your org. Use this flag to explicitly specify the runner type. 'agentforce-studio' uses AiTestingDefinition metadata. 'testing-center' uses AiEvaluationDefinition metadata.

# examples

- Generate an agent test spec YAML file interactively:

  <%= config.bin %> <%= command.id %>

- Generate an Agentforce Studio (NGT) test spec YAML file interactively:

  <%= config.bin %> <%= command.id %> --test-runner agentforce-studio

- Generate an agent test spec YAML file and specify a name for the new file; if the file exists, overwrite it without confirmation:

  <%= config.bin %> <%= command.id %> --output-file specs/Resort_Manager-new-version-testSpec.yaml --force-overwrite

- Generate an agent test spec YAML file from an existing AiEvaluationDefinition metadata XML file in your DX project:

  <%= config.bin %> <%= command.id %> --from-definition force-app/main/default/aiEvaluationDefinitions/Resort_Manager_Tests.aiEvaluationDefinition-meta.xml

- Generate an Agentforce Studio (NGT) test spec YAML file from an existing AiTestingDefinition metadata XML file:

  <%= config.bin %> <%= command.id %> --from-definition force-app/main/default/aiTestingDefinitions/Returns_Checkout_Tests.aiTestingDefinition-meta.xml

# info.cancel

Operation canceled.

# warning.NoConversationHistoryForTaskResolution

Test case #%s uses the 'task_resolution' scorer, which requires `conversationHistory` on at least one input. Add conversationHistory by hand to the YAML before running 'agent test create', or accept the boilerplate prompt.

# error.InvalidAiEvaluationDefinition

File must be an AiEvaluationDefinition metadata XML file.

# error.UnknownDefinitionExtension

File must be an AiEvaluationDefinition or AiTestingDefinition metadata XML file (ends with `.aiEvaluationDefinition-meta.xml` or `.aiTestingDefinition-meta.xml`). Found: %s

# error.RunnerMismatch

--test-runner=%s contradicts the metadata file extension, which implies %s. Drop --test-runner, or pick the matching value.

# error.NoAgentsFound

No published agents ('GenAiPlannerBundle', 'GenAiPlugin', 'Bot') found in %s.
