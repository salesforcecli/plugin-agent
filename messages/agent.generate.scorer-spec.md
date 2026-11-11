# summary

Generate a custom scorer spec YAML file from a template.

# description

Generate a template-based YAML scorer spec file for a custom Agentforce scorer (AiAgentScorerDefinition). Unlike the test spec command, this command does not use an interactive interview — it writes a ready-to-edit starter template to disk.

Use the --data-type flag to choose between a numeric measurement scorer (Number) or a text classification scorer (Text). Edit the generated file to configure your scorer's prompt template, output values, and agent association.

When your scorer spec is ready, run the "agent scorer spec create" command to convert it to metadata XML and deploy it to your org.

# flags.output-file.summary

Name of the generated scorer spec YAML file. Default value is "specs/<SCORER_NAME>-scorerSpec.yaml".

# flags.force-overwrite.summary

Don't prompt for confirmation when overwriting an existing scorer spec YAML file.

# flags.name.summary

API name for the scorer. Sets the "name" and "label" fields in the generated YAML template.

# flags.agent-api-name.summary

API name of the agent to associate with the scorer. Sets the "agentApiName" field in the generated YAML template.

# flags.data-type.summary

Data type for the scorer: Number (measurement) or Text (multilabel classifier). Determines the starter template used.

# examples

- Generate a numeric scorer spec YAML file using the default template:

  <%= config.bin %> <%= command.id %>

- Generate a text classifier scorer spec and write it to a specific file:

  <%= config.bin %> <%= command.id %> --data-type Text --output-file specs/language_classifier-scorerSpec.yaml

- Overwrite an existing scorer spec without confirmation:

  <%= config.bin %> <%= command.id %> --output-file specs/my_scorer-scorerSpec.yaml --force-overwrite

# info.cancel

Operation canceled.
