# summary

Create an agent scorer definition using an interactive interview or a spec file.

# description

Creates an AiAgentScorerDefinition metadata XML file either interactively (prompting for each field) or from a YAML spec file.

Run with no flags to start the interactive interview. The command prompts you for the scorer's lightning type, optional output labels, engine type, and agent associations.

Alternatively, provide a --spec flag pointing to a YAML file that defines the scorer. This is useful for repeatable automation or when the scorer has many output values.

Use --preview to see the generated XML without writing it to disk.

# flags.api-name.summary

API name of the scorer definition.

# flags.agent-api-name.summary

API name of the agent to associate with this scorer.

# flags.lightning-type.summary

Lightning type the scorer's value conforms to (for example, lightning__textType or lightning__numberType).

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

# flags.spec-schema.summary

Output the JSON Schema for the --spec YAML file and exit.

# flags.new-version.summary

Add a new version to an existing scorer instead of erroring. The new version is numbered one higher than the current highest; if a new prompt rubric is supplied, the prompt template's active version is updated too.

# flags.promote-version.summary

Promote the given version number of an existing scorer to Available (its rubric is served on the next run). Requires --api-name; authors no content.

# flags.archive-version.summary

Archive the given version number of an existing scorer so it can no longer be run. Requires --api-name; authors no content.

# flags.output-dir.summary

Output directory for the generated metadata XML files (scorer definition and prompt template).

# flags.preview.summary

Preview the generated XML without writing to disk.

# examples

- Show the JSON Schema for the spec YAML file:

  <%= config.bin %> <%= command.id %> --spec-schema

- Create a scorer interactively:

  <%= config.bin %> <%= command.id %>

- Create a scorer from a spec file:

  <%= config.bin %> <%= command.id %> --spec specs/expert-analysis-scorer.yaml

- Preview the XML that would be generated:

  <%= config.bin %> <%= command.id %> --spec specs/expert-analysis-scorer.yaml --preview

- Create a manual scorer with flags (non-interactive):

  <%= config.bin %> <%= command.id %> --api-name Expert_Analysis --lightning-type lightning__textType --engine-type Manual --label Expert_Analysis --agent-api-name My_Agent --status Available

- Create a prompt-based scorer (generates both scorer definition and prompt template):

  <%= config.bin %> <%= command.id %> --api-name sentiment_analysis --lightning-type lightning__textType --engine-type PromptTemplate --label sentiment_analysis --agent-api-name My_Agent

# error.missingRequiredFlags

Missing required flags: %s. When using --json, all required flags must be provided.

# error.invalidSpecYaml

Could not parse the --spec file as YAML: %s

# error.invalidSpecShape

The --spec file must define a YAML object matching the scorer spec schema (see --spec-schema). Received: %s

# error.noAgentsInOrg

No agents found in the org. Deploy an agent first, or specify one with --agent-api-name.

# error.scorerExists

A scorer named '%s' already exists in this project. To refine it, add a new version with --new-version; to change a version's status use --promote-version or --archive-version; or use --preview to see the generated XML without writing.

# error.transitionNeedsApiName

--promote-version and --archive-version require --api-name to identify which scorer to update.
