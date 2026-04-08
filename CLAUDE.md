# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Test Commands

### Development Setup

```bash
# Install dependencies
yarn install

# Build the plugin
yarn build

# Link plugin for local testing
sf plugins link .
```

### Testing

```bash
# Run all tests (unit + integration + linting)
yarn test

# Run only unit tests
yarn test:only

# Run NUT (non-unit tests / integration tests)
yarn test:nuts

# Run specific test file
yarn mocha test/path/to/file.test.ts

# Lint code
yarn lint

# Format code
yarn format
```

### Local Command Execution

```bash
# Run commands using local dev build
./bin/dev.js agent <subcommand>

# Example: preview an agent locally
./bin/dev.js agent preview
```

## Architecture Overview

### Plugin Structure

This is an oclif plugin (`@salesforce/plugin-agent`) that provides CLI commands for Salesforce Agentforce development. Commands are namespaced under `sf agent` and organized into functional groups:

- **Lifecycle**: `activate`, `deactivate`, `create`
- **Generation**: `generate agent-spec`, `generate authoring-bundle`, `generate test-spec`, `generate template`
- **Development**: `preview`, `validate authoring-bundle`
- **Publishing**: `publish authoring-bundle`
- **Testing**: `test create`, `test run`, `test resume`, `test results`, `test list`

### Core Library Integration

Commands heavily integrate with the `@salesforce/agents` library, which provides:

- `Agent` class for agent initialization and management
- `AgentTest` class for test operations
- `ScriptAgent` and `ProductionAgent` types for different agent sources
- `CompilationError` and validation utilities

### Messages System

All user-facing text must be externalized in markdown files under `messages/`:

- Each command has a corresponding `messages/<command.path>.md` file
- Shared messages are in `messages/shared.md`
- Load messages with: `Messages.loadMessages('@salesforce/plugin-agent', 'command.name')`
- Access with: `messages.getMessage('key')` or `messages.createError('key', [args])`

### Interactive Components

Commands use React/Ink for rich terminal UIs:

- `src/components/agent-preview-react.tsx` - Main preview interface
- Uses `@inquirer/prompts` for user input (select, autocomplete, input)
- Custom theme defined in `src/inquirer-theme.ts`

### Common Utilities (src/flags.ts & src/common.ts)

**Flag Patterns**:

- `makeFlags()` - Creates oclif flags from `FlaggablePrompt` definitions
- Enables dual-mode: flags for automation, prompts for interactive use
- Common flags: `resultFormatFlag`, `testOutputDirFlag`, `verboseFlag`

**Prompt Utilities**:

- `promptForFlag()` - Interactive prompts with validation
- `promptForYamlFile()` - File picker with autocomplete
- `promptForAgentFiles()` - Browse project authoring bundles
- `promptForAiEvaluationDefinitionApiName()` - Select from org's test definitions

**Validation Functions**:

- `validateAgentType()`, `validateMaxTopics()`, `validateTone()`
- `validateAgentUser()` - Validates username exists in org
- All validators throw descriptive `SfError` instances

### Data Translation Layer

**YAML ↔ Eval API** (`src/yamlSpecTranslator.ts`):

- Converts human-friendly YAML test specs to/from internal Eval API format
- Maps JSONPath expressions (`$.generatedData.topic` → `{gs.response.planner_response.lastExecution.topic}`)
- Handles custom evaluation types (string_comparison, numeric_comparison)
- Use `isYamlTestSpec()` to detect format, `translateYamlToEval()` to convert

**Test Result Formatting** (`src/evalFormatter.ts` & `src/evalNormalizer.ts`):

- Normalizes test results from Eval API
- Formats for multiple output types: human-readable tables, JSON, JUnit, TAP
- `handleTestResults()` in `src/handleTestResults.ts` orchestrates formatting

### Caching & Session Management

**AgentTestCache** (`src/agentTestCache.ts`):

- TTL-based cache for test runs (7 day expiry)
- Stores runId, name, outputDir, resultFormat
- Global state in `.sf/` directory

**PreviewSessionStore** (`src/previewSessionStore.ts`):

- Manages programmatic preview sessions
- Tracks session IDs for `preview start/send/end` commands

### Error Handling Patterns

- Use `SfError.create()` for CLI errors with exit codes
- Agent compilation errors: `throwAgentCompilationError()` from `src/common.ts`
- Exit codes from `@salesforce/agents`: `COMPILATION_API_EXIT_CODES`
- When rethrowing errors, always set `cause` property to preserve stack trace

### Testing Patterns

**Unit Tests** (test/\*.test.ts):

- Use Chai for assertions
- Sinon for stubbing/mocking
- Import from command files to test exported functions
- Test files mirror source structure

**NUTs** (test/nuts/\*.nut.ts):

- Integration tests against real orgs
- Use `@salesforce/cli-plugins-testkit`
- Some tests prefixed with `z0`, `z1`, etc. to control execution order
- Timeout: 600s (10 minutes)

### JSON Schemas

Each command with `--json` output has a schema in `schemas/`:

- Named after command path with `__` for spaces: `agent-publish-authoring__bundle.json`
- Validated automatically by `test:json-schema` wireit task
- Update schemas when changing command output structure

## Project-Specific Conventions

### Command Messages

- Command summaries, descriptions, examples, and flag text MUST come from messages files
- Never hardcode user-facing strings in command classes
- Error messages should be descriptive and actionable

### Authoring Bundles

- Metadata type: `aiAuthoringBundle`
- Contains Agent Script file (`.agent` extension)
- Directory structure: `force-app/main/default/aiAuthoringBundles/<API_NAME>/`
- Must be validated before publishing

### Agent Script Files

- Blueprint language for agents
- Compiled and validated via `@salesforce/agents` library
- Syntax errors show line/column numbers: `[Ln X, Col Y]`

### Exit Code Contract

- Respect exit codes from `COMPILATION_API_EXIT_CODES`:
  - 404 → exit code 2
  - 500 → exit code 3
- General errors → exit code 1

## PR Review Checklist (from .cursor/skills/agent-pr-review)

When reviewing code changes:

- Verify command messages are in messages directory
- Check error handling: errors not swallowed, rethrown errors set original as cause
- Validate tests cover changes
- Ensure `--json` output has proper schema
- Look for code reuse opportunities
- Check input validation for API calls
- Verify no security issues (command injection, XSS, SQL injection)
