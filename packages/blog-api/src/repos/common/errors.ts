import { Data } from 'effect';

export class DataBaseUnknownError extends Data.TaggedError(
  'DataBaseUnknownError'
)<{
  error: unknown;
}> {}
