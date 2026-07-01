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
import { SfError } from '@salesforce/core';

/**
 * Extract clean error messages from Connect API responses.
 * Connect API returns errors as: [{"errorCode": "INVALID_INPUT", "message": "..."}]
 * This helper extracts the errorCode and message, stripping Java stack traces.
 */
type ApiErrorEntry = { errorCode: string; message: string };

function isApiErrorArray(value: unknown): value is ApiErrorEntry[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof (value[0] as ApiErrorEntry).errorCode === 'string' &&
    typeof (value[0] as ApiErrorEntry).message === 'string'
  );
}

export function extractApiError(error: SfError): string | undefined {
  const errWithData = error as SfError & { data?: unknown };
  const causeWithData = error.cause as (Error & { data?: unknown }) | undefined;
  const body: unknown = errWithData.data ?? causeWithData?.data;

  if (isApiErrorArray(body)) {
    return `${body[0].errorCode}: ${body[0].message}`;
  }

  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body);
      if (isApiErrorArray(parsed)) {
        return `${parsed[0].errorCode}: ${parsed[0].message}`;
      }
    } catch {
      /* not JSON */
    }
  }

  const msg = error.message;
  const stackIdx = msg.indexOf('\n\tat ');
  if (stackIdx > 0) return msg.slice(0, stackIdx).trim();

  return undefined;
}
