# summary

Create an Agent from an agent spec.

# description

Create an Agent from an agent spec. Agent metadata is created in the target org and retrieved to the local project.

# flags.job-spec.summary

The path to an agent spec file.

# flags.job-spec.description

The agent spec file defines job titles and descriptions for the agent and can be created using the `sf agent create spec` command.

# flags.name.summary

The name of the agent.

# examples

- Create an Agent:

  <%= config.bin %> <%= command.id %> --spec ./agent-spec.json
