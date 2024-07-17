import { Data } from 'effect';

export class WorkflowUnknownError extends Data.TaggedError(
  'WorkflowUnknownError'
)<{
  error: unknown;
}> {}
