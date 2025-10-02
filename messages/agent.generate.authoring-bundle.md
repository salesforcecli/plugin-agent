# summary

Generate an authoring bundle from an agent specification.

# description

Generates an authoring bundle containing AFScript and its meta.xml file from an agent specification file.

# flags.spec.summary

Path to the agent specification file.

# flags.output-dir.summary

Directory where the authoring bundle files will be generated.

# flags.name.summary

Name (label) of the authoring bundle. If not provided, you will be prompted for it.

# flags.name.prompt

Name (label) of the authoring bundle

# examples

- Generate an authoring bundle from a specification file:
  <%= config.bin %> <%= command.id %> --spec-file path/to/spec.yaml --name "My Authoring Bundle"

- Generate an authoring bundle with a custom output directory:
  <%= config.bin %> <%= command.id %> --spec-file path/to/spec.yaml --name "My Authoring Bundle" --output-dir path/to/output

# error.no-spec-file

No agent specification file found at the specified path.

# error.invalid-spec-file

The specified file is not a valid agent specification file.

# error.failed-to-create-afscript

Failed to create AFScript from the agent specification.
