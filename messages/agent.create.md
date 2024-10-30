# summary

Create an Agent from an agent spec.

# description

Create an Agent from an agent spec. Agent metadata is created in the target org and retrieved to the local project.

# flags.planner.summary

The agent planner API name.

# flags.spec.summary

The path to an agent spec file.

# flags.spec.description

The agent spec file defines job descriptions for the agent and can be created using the `sf agent create spec` command.

# examples

- Create an Agent:

  <%= config.bin %> <%= command.id %> --planner MyAgentPlanner --spec ./agent-spec.json
