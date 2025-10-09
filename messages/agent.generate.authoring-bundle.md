# summary

Generate a local authoring bundle from an existing agent spec YAML file.

# description

Authoring bundles are metadata types that represent the next-gen Salesforce agents. Their exact metadata name is AiAuthoringBundle and they consist of a standard "\*-meta.xml" metadata file and an agent file (with extension ".agent") that fully describes the next-gen agent. Use this command to generate an authoring bundle based on an agent spec YAML file, which you create with the "agent create agent-spec" command.

By default, authoring bundles are generated in the force-app/main/default/aiAuthoringBundles/<api-name> directory. Use the --output-dir to generate them elsewhere.

# flags.spec.summary

Path to the agent spec YAML file.

# flags.output-dir.summary

Directory where the authoring bundle files are generated.

# flags.name.summary

Name (label) of the authoring bundle.

# flags.api-name.summary

API name of the new authoring bundle; if not specified, the API name is derived from the authoring bundle name (label); the API name can't exist in the org.

# flags.api-name.prompt

API name of the new authoring bundle

# examples

- Generate an authoring bundle from the "specs/agentSpec.yaml" agent spec YAML file and give it the label "My Authoring Bundle":

  <%= config.bin %> <%= command.id %> --spec-file specs/agentSpec.yaml --name "My Authoring Bundle"

- Same as previous example, but generate the files in the other-package-dir/main/default/aiAuthoringBundles directory:

  <%= config.bin %> <%= command.id %> --spec-file specs/agentSpec.yaml --name "My Authoring Bundle" --output-dir other-package-dir/main/default/aiAuthoringBundles

# error.no-spec-file

No agent spec YAML file found at the specified path.

# error.invalid-spec-file

The specified file is not a valid agent spec YAML file.

# error.failed-to-create-agent

Failed to create a next-gen agent from the agent spec YAML file.
