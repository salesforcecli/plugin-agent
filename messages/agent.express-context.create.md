# summary

Create an Agentforce Express Context library from files and add its retriever action to a subagent of a local authoring bundle.

# description

Creates an Express Context (AEC) library for one subagent of a local authoring bundle (a draft Agent Script agent that hasn't been published), uploads the files you specify, waits for them to be indexed, and then adds a retriever action for the library to the subagent in the bundle's .agent file.

You're prompted for the authoring bundle, the subagent, and the label and description of the retriever action before anything is created in the org. The library is named after the subagent's display name followed by "Express" (for example, "Acura Vehicles Express"). The platform creates the library's retriever and a global retriever action; the local action added to the subagent uses that global retriever action as its source.

Indexing status is checked every 2 seconds for up to 10 minutes. If only some files are indexed, or indexing times out, you can continue with the indexed files, retry once, or abort. If any step fails after the library is created, you're asked to confirm deletion of the library and its retriever action so no half-made library is left behind. With --json, there are no prompts: all of --authoring-bundle, --subagent, --action-label, and --action-description are required, and any failure or partial indexing aborts and cleans up.

The authoring bundle is only edited locally. Validate, preview, or publish it separately.

# examples

- Create a library for a subagent, prompting for the authoring bundle, subagent, and action details:

  <%= config.bin %> <%= command.id %> --file ./docs/fact-sheet.pdf --file ./docs/owners-manual.pdf --target-org myOrg

- Do the same without prompts:

  <%= config.bin %> <%= command.id %> --file ./docs/fact-sheet.pdf --authoring-bundle My_Agent --subagent acura_vehicles --action-label "Acura Management Action" --action-description "Answers questions about Acura models, pricing, and specifications." --target-org myOrg

# flags.file.summary

Path to a file to upload into the new library. Repeat the flag to upload multiple files (maximum 50, 100 MB each).

# flags.authoring-bundle.summary

API name of the local authoring bundle (draft Agent Script agent) to add the retriever action to. If omitted, you're prompted to pick one.

# flags.subagent.summary

Developer name of the subagent that gets the retriever action; the library is named after its display name. If omitted, you're prompted to pick one.

# flags.action-label.summary

Label of the retriever action added to the subagent.

# flags.action-description.summary

Description of the retriever action; the planner uses it to decide when to call the action. Also used as the library description.

# prompt.authoringBundle

Select the authoring bundle to add the retriever action to

# prompt.subagent

Select the subagent that will use the retriever action

# prompt.actionLabel

Label of the retriever action

# prompt.actionDescription

Description of the retriever action

# prompt.proceed

Create the library, upload the files, and update the authoring bundle?

# prompt.cleanup

Delete library "%s" (%s) and its retriever action?

# summary.plan

About to:

- Create Express Context library "%s" (%s)
- Upload and index %s file(s)
- Add retriever action to authoring bundle %s, subagent "%s" (%s), labeled "%s"

# created

Created Express Context library "%s" (%s).

# success

Added retriever action "%s" to subagent "%s" in %s.

# nextSteps

The authoring bundle has only been edited locally. Validate it with "sf agent validate authoring-bundle --api-name %s", then preview or publish it when ready.

# cleanup.failed

Library creation didn't complete: %s

# cleanup.kept

Kept library %s and retriever action %s. Delete them with "sf agent express-context delete" and by removing the GenAiFunctionDefinition when you're done.

# cleanup.deleted

Deleted %s.

# cleanup.partial

Some records couldn't be deleted; remove them manually:
%s

# error.missingFlags

Missing required flags in --json mode: %s.

# error.emptyValue

Value can't be empty.

# error.noProject

This command must run inside a Salesforce DX project that contains the authoring bundle.

# error.bundleNotFound

Authoring bundle "%s" wasn't found in the project's package directories.

# error.noSubagents

Authoring bundle "%s" doesn't define any subagents.

# error.subagentNotFound

Subagent "%s" wasn't found in authoring bundle "%s". Available subagents: %s.

# error.actionExists

Subagent "%s" already has an action named "%s".

# error.cancelled

Cancelled. Nothing was created.

# error.libraryExists

An Express Context library named "%s" already exists (%s).

# error.libraryExists.actions

- Add files to it with "sf agent express-context upload --library-id %s".

# error.noRetriever

Library %s has no retriever, so a retriever action can't be added.

# error.notIndexed

Not all files were indexed.
