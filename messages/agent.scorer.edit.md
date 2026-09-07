# summary

Change the status or agent-association activation of a version of an existing agent scorer.

# description

Edits one version of a scorer in place: promote it (`--status Available`, so its rubric is served by default on the next run), archive it (`--status Archived`, so it can no longer be run), and/or turn its agent association on or off (`--activate` / `--deactivate`). Editing a scorer never authors content: a version's rubric is immutable once it exists — status and activation are the only fields that change. To add a new version with a refined rubric, use `sf agent scorer create --new-version`.

This command edits the scorer's local metadata XML only; it does not require an org connection. Deploy the updated scorer definition afterward for the org to reflect the change.

Platform activation rules (enforced on deploy): an active association (`--activate`) requires the version's status to be `Available`, and at most one version of a scorer may hold an active association.

# flags.api-name.summary

API name of the scorer to edit. Must match a scorer authored in this project's metadata.

# flags.version.summary

Version number to edit.

# flags.status.summary

New status for the version: Draft, Available (promote — served by default on the next run), or Archived (can no longer be run).

# flags.activate.summary

Activate the version's agent association (start scoring the associated agent's sessions). Requires the version's status to be Available.

# flags.deactivate.summary

Deactivate the version's agent association (stop scoring the associated agent's sessions).

# flags.output-dir.summary

Directory containing the scorer's metadata XML (where the scorer definition was authored).

# flags.preview.summary

Preview the resulting XML without writing to disk.

# examples

- Promote version 2 of a scorer to Available:

  <%= config.bin %> <%= command.id %> --api-name Resolution_Quality_Judge --version 2 --status Available

- Archive version 1 so it can no longer be run:

  <%= config.bin %> <%= command.id %> --api-name Resolution_Quality_Judge --version 1 --status Archived

- Promote a version and activate its agent association in a single command:

  <%= config.bin %> <%= command.id %> --api-name Resolution_Quality_Judge --version 2 --status Available --activate

- Deactivate the agent association on a version:

  <%= config.bin %> <%= command.id %> --api-name Resolution_Quality_Judge --version 2 --deactivate

- Preview a status change without writing to disk:

  <%= config.bin %> <%= command.id %> --api-name Resolution_Quality_Judge --version 2 --status Available --preview

# error.noChange

Specify at least one change: --status, --activate, or --deactivate.

# error.scorerNotFound

No scorer '%s' was found at %s. Author it first with `sf agent scorer create`.
