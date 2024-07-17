import { Data, Effect, pipe } from 'effect';
import type { DataBaseUnknownError } from '../../../repos/common/errors';
import type { UserID } from '../../models/user';

export class NotFoundUserError extends Data.TaggedError('NotFoundUserError')<{
  userID: string;
}> {}

export const checkUserWorkflow =
  (
    getUser: (
      userID: UserID
    ) => Effect.Effect<
      { userID: string; userName: string } | undefined,
      DataBaseUnknownError,
      never
    >
  ) =>
  (params: { userID: UserID }) =>
    pipe(
      getUser(params.userID),
      Effect.flatMap((user) =>
        user
          ? Effect.succeed({
              isLoggedIn: true,
              user: {
                userName: user.userName,
              },
            })
          : Effect.fail(new NotFoundUserError({ userID: params.userID }))
      )
    );
