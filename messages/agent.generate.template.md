# summary

Generate an agent template from an existing agent in your DX project so you can then package the template in a managed package.

# description

At a high-level, agents are defined by the Bot, BotVersion, and GenAiPlannerBundle metadata types. The GenAiPlannerBundle type in turn defines the agent's topics and actions. This command uses the metadata files for these three types, located in your local DX project, to generate a BotTemplate file for a specific agent (Bot). You then use the BotTemplate file, along with the GenAiPlannerBundle file that references the BotTemplate, to package the template in a managed package that you can share between orgs or on AppExchange.

Use the --agent-file flag to specify the relative or full pathname of the Bot metadata file, such as force-app/main/default/bots/My_Awesome_Agent/My_Awesome_Agent.bot-meta.xml. A single Bot can have multiple BotVersions, so use the --agent-version flag to specify the version. The corresponding BotVersion file must exist locally. For example, if you specify "--agent-version 4", then the file force-app/main/default/bots/My_Awesome_Agent/v4.botVersion-meta.xml must exist.

The new BotTemplate file is generated in the "botTemplates" directory in your local package directory, and has the name <Agent_API_name>_v<Version>_Template.botTemplate-meta.xml, such as force-app/main/default/botTemplates/My_Awesome_Agent_v4_Template.botTemplate-meta.xml. The command displays the full pathname of the generated files when it completes.

# examples

- Generate an agent template from a Bot metadata file in your DX project that corresponds to the My_Awesome_Agent agent; use version 1 of the agent.

  <%= config.bin %> <%= command.id %> --agent-file force-app/main/default/bots/My_Awesome_Agent/My_Awesome_Agent.bot-meta.xml --agent-version 1

# flags.agent-version.summary

Version of the agent (BotVersion).

# flags.agent-file.summary

Path to an agent (Bot) metadata file.

# error.invalid-agent-file

Invalid Agent file. Must be a Bot metadata file. Example: force-app/main/default/bots/MyBot/MyBot.bot-meta.xml

# error.no-entry-dialog

No entryDialog found in BotVersion file.

# error.invalid-bot-type

The 'type' attribute of this Bot metadata component XML file can't have a value of 'Bot', which indicates that it's an Einstein Bot and not an agent: %s.

# error.no-label

No label found in Agent (Bot) file: %s.

# error.no-ml-domain

No botMlDomain found in Agent (Bot) file: %s.
