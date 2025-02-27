# summary

Generate an agent test spec, which is a YAML file that lists the test cases for testing a specific agent.

# description

The first step when using Salesforce CLI to create an agent test in your org is to use this interactive command to generate a local YAML-formatted test spec file. The test spec YAML file contains information about the agent being tested, such as its API name, and then one or more test cases. This command uses the metadata components in your DX project when prompting for information, such as the agent API name; it doesn't look in your org.

To generate a specific agent test case, this command prompts you for this information; when possible, the command provides a list of options for you to choose from:

- Utterance: Natural language statement, question, or command used to test the agent.
- Expected topic: API name of the topic you expect the agent to use when responding to the utterance.
- Expected actions: One or more API names of the expection actions the agent takes.
- Expected outcome: Natural language description of the outcome you expect.

When your test spec is ready, you then run the "agent test create" command to actually create the test in your org and synchronize the metadata with your DX project. The metadata type for an agent test is AiEvaluationDefinition.

If you have an existing AiEvaluationDefinition metadata XML file in your DX project, you can generate its equivalent YAML test spec file with the --from-definition flag.

# flags.from-definition.summary

Filepath to the AIEvaluationDefinition metadata XML file in your DX project that you want to convert to a test spec YAML file.

# flags.force-overwrite.summary

Don't prompt for confirmation when overwriting an existing test spec YAML file.

# flags.output-file.summary

Name of the generated test spec YAML file. Default value is "specs/<AGENT_API_NAME>-testSpec.yaml".

# examples

- Generate an agent test spec YAML file interactively:

  <%= config.bin %> <%= command.id %>

- Generate an agent test spec YAML file and specify a name for the new file; if the file exists, overwrite it without confirmation:

  <%= config.bin %> <%= command.id %> --output-file specs/Resort_Manager-new-version-testSpec.yaml --force-overwrite

- Generate an agent test spec YAML file from an existing AiEvaluationDefinition metadata XML file in your DX project:

  <%= config.bin %> <%= command.id %> --from-definition force-app//main/default/aiEvaluationDefinitions/Resort_Manager_Tests.aiEvaluationDefinition-meta.xml

# info.cancel

Operation canceled.

# error.InvalidAiEvaluationDefinition

File must be an AiEvaluationDefinition metadata XML file.

# error.NoAgentsFound

No agents found in %s.
