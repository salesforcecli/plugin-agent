# summary

Generate an agent spec, which is a YAML file that captures what an agent can do.

# description

Before you use Salesforce CLI to create an agent in your org, you must first generate an agent spec with this command. An agent spec is a YAML-formatted file that contains information about the agent, such as its role and company description, and then an AI-generated list of topics based on this information. Topics define the range of jobs your agent can handle.

Use flags, such as --role and --company-description, to provide details about your company and the role that the agent plays in your company. If you prefer, you can also be prompted for the information. Upon command execution, the large language model (LLM) associated with your org uses the information you provided to generate a list of topics for the agent. Because the LLM uses the company and role information to generate the topics, we recommend that you provide accurate and specific details so the LLM generates the best and most relevant topics. Once generated, you can edit the spec file; for example, you can remove topics that don't apply to your agent or change the description of a particular topic.

You can iterate the spec generation process by using the --spec flag to pass an existing agent spec file to this command, and then using the --role, --company-description, etc, flags to refine your agent properties. Iteratively improving the description of your agent allows the LLM to generate progressively better topics.

You can also specify a custom prompt template that the agent uses, and ground the prompt template to add context and personalization to the agent's prompts.

When your agent spec is ready, you then create the agent in your org by running the "agent create" CLI command and specifying the spec with the --spec flag.

# flags.output-file.summary

Pathname for the generated YAML agent spec file; can be an absolute or relative path.

# flags.max-topics.summary

Maximum number of topics to generate in the agent spec; default is 10.

# flags.prompt-template.summary

API name of a customized prompt template to use instead of the default prompt template.

# flags.grounding-context.summary

Context information and personalization that's added to your prompts when using a custom prompt template.

# flags.spec.summary

Agent spec file, in YAML format, to use as input to the command.

# examples

- Generate an agent spec in the default location and use flags to specify the agent properties, such as its role and your company details; use your default org:

  <%= config.bin %> <%= command.id %> --type customer --role "Field customer complaints and manage employee schedules." --company-name "Coral Cloud Resorts" --company-description "Provide customers with exceptional destination activities, unforgettable experiences, and reservation services."

- Generate an agent spec by being prompted for the required agent properties and generate a maxiumum of 5 topics; write the generated file to the "specs/resortManagerSpec.yaml" file and use the org with alias "my-org":

  <%= config.bin %> <%= command.id %> --max-topics 5 --output-file specs/resortManagerAgent.yaml --target-org my-org

- Specify an existing agent spec file called "specs/resortManagerAgent.yaml", and then overwrite it with a new version that contains newly AI-generated topics based on the updated role information passed in with the --role flag:

  <%= config.bin %> <%= command.id %> --spec specs/resortManagerAgent.yaml --output-file specs/resortManagerAgent.yaml --role "Field customer complaints, manage employee schedules, and ensure all resort operations are running smoothly" --target-org my-org

# error.missingRequiredFlags

Missing required flags: %s
