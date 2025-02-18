# summary

Generate an agent spec, which is a YAML file that captures what an agent can do.

# description

The first step in creating an agent in your org with Salesforce CLI is to generate an agent spec using this command. An agent spec is a YAML-formatted file that contains information about the agent, such as its role and company description, and then an AI-generated list of topics based on this information. Topics define the range of jobs your agent can handle.

Use flags, such as --role and --company-description, to provide details about your company and the role that the agent plays in your company. If you prefer, you can also be prompted for the basic information; use --full-interview to be prompted for all required and optional properties. Upon command execution, the large language model (LLM) associated with your org uses the provided information to generate a list of topics for the agent. Because the LLM uses the company and role information to generate the topics, we recommend that you provide accurate, complete, and specific details so the LLM generates the best and most relevant topics. Once generated, you can edit the spec file; for example, you can remove topics that don't apply or change a topic's description.

You can also iterate the spec generation process by using the --spec flag to pass an existing agent spec file to this command, and then using the --role, --company-description, etc, flags to refine your agent properties. Iteratively improving the description of your agent allows the LLM to generate progressively better topics.

You can also specify other agent properties, such as a custom prompt template, how to ground the prompt template to add context to the agent's prompts, the tone of the prompts, and the username of a user in the org to assign to the agent.

When your agent spec is ready, you then create the agent in your org by running the "agent create" CLI command and specifying the spec with the --spec flag.

# flags.type.summary

Type of agent to create. Internal types are copilots used internally by your company and customer types are the agents you create for your customers.

# flags.type.prompt

Type of agent to create.

# flags.role.summary

Role of the agent.

# flags.company-name.summary

Name of your company.

# flags.company-description.summary

Description of your company.

# flags.company-website.summary

Website URL of your company.

# flags.output-file.summary

Path for the generated YAML agent spec file; can be an absolute or relative path.

# flags.max-topics.summary

Maximum number of topics to generate in the agent spec; default is 5.

# flags.max-topics.prompt

Max number of topics to generate (1-30)

# flags.prompt-template.summary

API name of a customized prompt template to use instead of the default prompt template.

# flags.grounding-context.summary

Context information and personalization that's added to your prompts when using a custom prompt template.

# flags.spec.summary

Agent spec file, in YAML format, to use as input to the command.

# flags.full-interview.summary

Prompt for both required and optional flags.

# flags.agent-user.summary

Username of a user in your org to assign to your agent; determines what your agent can access and do.

# flags.agent-user.prompt

Username for agent

# flags.enrich-logs.summary

Adds agent conversation data to event logs so you can view all agent session activity in one place.

# flags.enrich-logs.prompt

Enrich event logs

# flags.tone.summary

Conversational style of the agent, such as how it expresses your brand personality in its messages through word choice, punctuation, and sentence structure.

# flags.tone.prompt

Agent conversation tone

# flags.primary-language.summary

Language the agent uses in conversations.

# flags.force-overwrite.summary

Don't prompt the user to confirm that an existing spec file will be overwritten.

# examples

- Generate an agent spec in the default location and use flags to specify the agent properties, such as its role and your company details; use your default org:

  <%= config.bin %> <%= command.id %> --type customer --role "Field customer complaints and manage employee schedules." --company-name "Coral Cloud Resorts" --company-description "Provide customers with exceptional destination activities, unforgettable experiences, and reservation services."

- Generate an agent spec by being prompted for the required agent properties and generate a maxiumum of 5 topics; write the generated file to the "specs/resortManagerSpec.yaml" file and use the org with alias "my-org":

  <%= config.bin %> <%= command.id %> --max-topics 5 --output-file specs/resortManagerAgent.yaml --target-org my-org

- Be prompted for all required and optional agent properties; use your default org:

  <%= config.bin %> <%= command.id %> --full-interview

- Specify an existing agent spec file called "specs/resortManagerAgent.yaml", and then overwrite it with a new version that contains newly AI-generated topics based on the updated role information passed in with the --role flag:

  <%= config.bin %> <%= command.id %> --spec specs/resortManagerAgent.yaml --output-file specs/resortManagerAgent.yaml --role "Field customer complaints, manage employee schedules, and ensure all resort operations are running smoothly"

- Specify that the conversational tone of the agent is formal and to attach the "resortmanager@myorg.com" username to it; be prompted for the required properties and use your default org:

  <%= config.bin %> <%= command.id %> --tone formal --agent-user resortmanager@myorg.com

# error.missingRequiredFlags

Missing required flags: %s

# confirmSpecOverwrite

Confirm overwrite of spec file %s?

# commandCanceled

Command canceled by user confirmation.
