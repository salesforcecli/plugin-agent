# summary

Scaffold an AiAgentScorerDefinition metadata XML file (an agent scorer), interactively or from a spec file. This is a one-time starter, not the source of truth: once the AiAgentScorerDefinition XML is created (or retrieved from an org), edit it directly.

# description

Creates an AiAgentScorerDefinition metadata XML file either interactively (prompting for each field) or from a YAML spec file.

Run with no flags to start the interactive interview. The command prompts you for the scorer's lightning type, optional output labels, engine type, and agent associations.

Alternatively, provide a --spec flag pointing to a YAML file that defines the scorer. This is useful for repeatable automation or when the scorer has many output values.

Use --preview to see the generated XML without writing it to disk.

This command is a one-shot scaffolding helper: it generates the scorer definition (and, for PromptTemplate scorers, its prompt template) metadata XML to give you a fast start. The generated XML — not this command and not the spec — is the source of truth. Once a definition exists locally, whether you created it here or retrieved it from an org, it has no connection back to the spec: make every further change (add a version, promote or archive a version, toggle an agent association, or edit the prompt rubric) directly in the metadata XML. If you already know the XML structure you can author it by hand and skip this command entirely; it exists because the XML is intricate and encodes rules the spec cannot fully capture.

# flags.api-name.summary

API name of the scorer definition.

# flags.agent-api-name.summary

API name of the agent to associate with this scorer.

# flags.lightning-type.summary

Lightning type the scorer's value conforms to (for example, lightning**textType or lightning**numberType).

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

  <%= config.bin %> <%= command.id %> --api-name Expert_Analysis --lightning-type lightning\_\_textType --engine-type Manual --label Expert_Analysis --agent-api-name My_Agent --status Available

- Create a prompt-based scorer (generates both scorer definition and prompt template):

  <%= config.bin %> <%= command.id %> --api-name sentiment_analysis --lightning-type lightning\_\_textType --engine-type PromptTemplate --label sentiment_analysis --agent-api-name My_Agent

# error.missingRequiredFlags

Missing required flags: %s. When using --json, all required flags must be provided.

# error.invalidSpecYaml

Could not parse the --spec file as YAML: %s

# error.invalidSpecShape

The --spec file must define a YAML object matching the scorer spec schema (see --spec-schema). Received: %s

# error.noAgentsInOrg

No agents found in the org. Deploy an agent first, or specify one with --agent-api-name.

# error.scorerExists

A scorer named '%s' already exists in this project. `generate-metadata-file` only scaffolds a new scorer and never overwrites an existing one. Edit its metadata XML directly instead (%s) — that is where you add a new version, promote or archive a version, toggle an agent association, or change the prompt rubric. To scaffold a different scorer, choose a new API name.

# info.scaffoldIntro

Heads up: this command only scaffolds the scorer's AiAgentScorerDefinition metadata XML to get you started — the generated file, not this interview, is the source of truth. After it's written, make any further changes directly in the AiAgentScorerDefinition XML.

# info.editXmlDirectly

Done. This scorer is now defined by its metadata XML, which is the source of truth from here on — the spec is no longer connected to it. Make any further change (add a version, promote or archive a version, toggle an agent association, or edit the prompt rubric) directly in the generated XML file.
