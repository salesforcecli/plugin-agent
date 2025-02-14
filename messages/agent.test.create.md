# summary

Convert a test spec file into an AiEvaluationDefinition and deploy it to your org.

# description

This command will convert a test spec file into an AiEvaluationDefinition and deploy it to your org. The spec file must be in yaml format.

Use the --preview flag to see the metadata that will be deployed without actually deploying it.

# flags.spec.summary

The path to the spec file.

# flags.preview.summary

Preview the test metadata without deploying to your org.

# flags.force-overwrite.summary

Don't prompt for confirmation when overwriting an existing test.

# flags.test-api-name.summary

The API name of the AiEvaluationDefinition.

# examples

- <%= config.bin %> <%= command.id %>

# prompt.confirm

An AiEvaluationDefinition with the name %s already exists in the org. Do you want to overwrite it?

# info.success

AiEvaluationDefinition created at %s and deployed to %s

# info.preview-success

Preview of AiEvaluationDefinition created at %s

# error.missingRequiredFlags

Missing required flags: %s.

# info.cancel

Operation canceled.
