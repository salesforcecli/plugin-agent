# summary

Generate an agent spec, which is the list of jobs that the agent performs.

# description

When using Salesforce CLI to create an agent in your org, the first step is to generate the local JSON-formatted agent spec file with this command.

An agent spec is a list of jobs and descriptions that capture what the agent can do. Use flags such as --role and --company-description to provide details about your company and the role that the agent plays in your company; you can also enter the information interactively if you prefer. When you then execute this command, the large language model (LLM) associated with your org uses the information to generate the list of jobs that the agent most likely performs. We recommend that you provide good details for --role, --company-description, etc, so that the LLM can generate the best and most relevant list of jobs and descriptions. Once generated, you can edit the spec file; for example, you can remove jobs that don't apply to your agent.

When your agent spec is ready, you then create the agent in your org by specifying the agent spec file to the --job-spec flag of the "agent create" CLI command.

# flags.type.summary

Type of agent to create.

# flags.role.summary

Role of the agent.

# flags.company-name.summary

Name of your company.

# flags.company-description.summary

Description of your company.

# flags.company-website.summary

Website URL of your company.

# flags.output-dir.summary

Directory where the agent spec file is written; can be an absolute or relative path.

# flags.file-name.summary

Name of the generated agent spec file.

# examples

- Create an agent spec for your default org in the default location and use flags to specify the agent's role and your company details:

  <%= config.bin %> <%= command.id %> --type customer --role "Assist users in navigating and managing bookings" --company-name "Coral Cloud" --company-description "Resort that manages guests and their reservations and experiences"

- Create an agent spec by being prompted for role and company details interactively; write the generated file to the "specs" directory and use the org with alias "my-org":

  <%= config.bin %> <%= command.id %> --output-dir specs --target-org my-org
