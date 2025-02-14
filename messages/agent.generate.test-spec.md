# summary

Interactively generate a specification file for a AI evaluation test.

# description

This command will prompt you for the necessary information to create a new spec file (in yaml format). You can then create a new AI evaluation using "sf agent test create --spec <spec-file>".

# flags.from-definition.summary

The API name of the AIEvaluationDefinition that you want to convert to a spec file.

# flags.force-overwrite.summary

Don't prompt for confirmation when overwriting an existing test spec file.

# flags.output-file.summary

The name of the generated spec file. Defaults to "specs/<AGENT_API_NAME>-testSpec.yaml"

# examples

- <%= config.bin %> <%= command.id %>

# info.cancel

Operation canceled.
