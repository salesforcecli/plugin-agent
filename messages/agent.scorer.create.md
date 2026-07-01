# summary

Create an agent scorer definition using an interactive interview or a spec file.

# description

Creates an AiAgentScorerDefinition metadata XML file either interactively (prompting for each field) or from a YAML spec file.

Run with no flags to start the interactive interview. The command prompts you for the scorer's data type, input scope, engine type, output values, and agent associations.

Alternatively, provide a --spec flag pointing to a YAML file that defines the scorer. This is useful for repeatable automation or when the scorer has many output values.

Use --preview to see the generated XML without writing it to disk.

# flags.api-name.summary

API name of the scorer definition.

# flags.agent-api-name.summary

API name of the agent to associate with this scorer.

# flags.data-type.summary

Data type produced by the scorer (Text, Number, or OpenEnded).

# flags.label.summary

Display label for the scorer version.

# flags.description.summary

Description of what this scorer evaluates.

# flags.engine-type.summary

Engine type for scoring (Manual or PromptTemplate).

# flags.status.summary

Initial status of the scorer version (Available or Draft).

# flags.spec.summary

Path to a scorer spec YAML file. Bypasses interactive prompts.

# flags.output-dir.summary

Output directory for the generated metadata XML files (scorer definition and prompt template).

# flags.preview.summary

Preview the generated XML without writing to disk.

# examples

- Create a scorer interactively:

  <%= config.bin %> <%= command.id %>

- Create a scorer from a spec file:

  <%= config.bin %> <%= command.id %> --spec specs/expert-analysis-scorer.yaml

- Preview the XML that would be generated:

  <%= config.bin %> <%= command.id %> --spec specs/expert-analysis-scorer.yaml --preview

- Create a manual scorer with flags (non-interactive):

  <%= config.bin %> <%= command.id %> --api-name Expert_Analysis --data-type Text --engine-type Manual --label Expert_Analysis --agent-api-name My_Agent --status Available

- Create a prompt-based scorer (generates both scorer definition and prompt template):

  <%= config.bin %> <%= command.id %> --api-name sentiment_analysis --data-type Text --engine-type PromptTemplate --label sentiment_analysis --agent-api-name My_Agent

# error.missingRequiredFlags

Missing required flags: %s. When using --json, all required flags must be provided.
