import { Schema } from '@effect/schema';

const uuidv4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const userIDSchema = Schema.String.pipe(
  Schema.pattern(uuidv4Pattern)
).pipe(Schema.brand('UserID'));

export const userNameSchema = Schema.String.pipe(
  Schema.pattern(/^[a-zA-Z]{1,10}$/)
).pipe(Schema.brand('UserName'));

export const UserID = (value: unknown) =>
  Schema.decodeUnknownEither(userIDSchema)(value);
export const UserName = (value: unknown) =>
  Schema.decodeUnknownEither(userNameSchema)(value);

export type UserID = Schema.Schema.Type<typeof userIDSchema>;
export type UserName = Schema.Schema.Type<typeof userNameSchema>;
