/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { EOL } from 'node:os';
import { SfError } from '@salesforce/core';
import { CompilationError } from '@salesforce/agents';

/**
 * Utility function to generate SfError when there are agent compilation errors.
 *
 * @param compilationErrors - The compilation errors as strings, CompilationError objects, or array of either
 * @throws SfError - Always throws a Salesforce CLI error
 */
export function throwAgentCompilationError(compilationErrors: CompilationError[]): never {
  if (compilationErrors.length === 0) {
    throw SfError.create({
      name: 'CompileAgentScriptError',
      message: 'Unknown compilation error occurred',
      data: compilationErrors,
    });
  }

  const errors = compilationErrors;

  throw SfError.create({
    name: 'CompileAgentScriptError',
    message: errors.map((e) => `${e.errorType}: ${e.description} [Ln ${e.lineStart}, Col ${e.colStart}]`).join(EOL),
    data: { errors },
  });
}
