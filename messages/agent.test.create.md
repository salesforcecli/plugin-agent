# summary

Create an agent test in your org using a local test spec YAML file.

# description

To run this command, you must have an agent test spec file, which is a YAML file that lists the test cases for testing a specific agent. Use the "agent generate test-spec" CLI command to generate a test spec file. Then specify the file to this command with the --spec flag, or run this command with no flags to be prompted.

When this command completes, your org contains the new agent test, which you can view and edit using the Testing Center UI. This command also retrieves the metadata component (AiEvaluationDefinition) associated with the new test to your local Salesforce DX project and displays its filename.

After you've created the test in the org, use the "agent test run" command to run it.

# flags.spec.summary

Path to the test spec YAML file.

# flags.preview.summary

Preview the test metadata file (AiEvaluationDefinition) without deploying to your org.

# flags.force-overwrite.summary

Don't prompt for confirmation when overwriting an existing test (based on API name) in your org.

# flags.api-name.summary

API name of the new test; the API name must not exist in the org.

# examples

- Create an agent test interactively and be prompted for the test spec and API name of the test in the org; use the default org:

  <%= config.bin %> <%= command.id %>

- Create an agent test and use flags to specify all required information; if a test with same API name already exists in the org, overwrite it without confirmation. Use the org with alias "my-org":

  <%= config.bin %> <%= command.id %> --spec specs/Resort_Manager-testSpec.yaml --api-name Resort_Manager_Test --force-overwrite --target-org my-org

- Preview what the agent test metadata (AiEvaluationDefinition) looks like without deploying it to your default org:

  <%= config.bin %> <%= command.id %> --spec specs/Resort_Manager-testSpec.yaml --api-name Resort_Manager_Test --preview

# prompt.confirm

A test with the API name %s already exists in the org. Do you want to overwrite it?

# info.success

Local AiEvaluationDefinition metadata XML file created at %s and agent test deployed to %s.

# info.preview-success

Preview of of the test created at %s.

# error.missingRequiredFlags

Missing required flags: %s.

# info.cancel

Operation canceled.
