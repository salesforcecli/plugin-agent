# summary

Create an Agent spec.

# description

Create an Agent spec, which is a list of job descriptions for the agent.

# flags.agent-type.summary

The type of agent to create.

# flags.role.summary

The role of the agent.

# flags.company-name.summary

The name of the company.

# flags.company-description.summary

The description of the company, containing details to be used when generating agent job descriptions.

# flags.company-website.summary

The website URL for the company.

# flags.output-dir.summary

The location within the project where the agent spec will be written.

# examples

- Create an Agent spec in the default location:

  <%= config.bin %> <%= command.id %> --agent-type customer-facing --role Support --company-name "Coral Cloud" --company-description "A meaningful description"
