import { graphql } from '@keystone-6/core';
import { captureError } from '../lib/bugsink';
import { CallerScopedGraphQL } from '../lib/communicator/graphqlExecutor';
import { getCommunicatorModel } from '../lib/communicator/lmStudio';
import { createQueryGenerator } from '../lib/communicator/queryGenerator';

const MAX_QUESTION_LENGTH = 2000;

export const queryCommunicator = (base: any) =>
  graphql.field({
    type: graphql.JSON,

    args: {
      question: graphql.arg({ type: graphql.nonNull(graphql.String) }),
      // Accepted but ignored. The model is configuration (COMMUNICATOR_MODEL)
      // rather than a user choice. Kept optional rather than removed so a
      // browser tab left open on the old page keeps working instead of failing
      // validation on an unknown argument; it can be deleted once no client
      // sends it.
      model: graphql.arg({ type: graphql.String }),
    },
    resolve: async (source, args, context) => {
      const session = await context.session;

      // Check if user is signed in
      if (!session) {
        throw new Error('You must be logged in to use the communicator');
      }
      // Check if user is staff
      if (!session.data.isStaff) {
        throw new Error('Only staff members can access the communicator');
      }

      // Check if user has communicator enabled
      if (!session.data.isCommunicatorEnabled) {
        throw new Error(
          'You do not have permission to use the communicator. Please contact an administrator.',
        );
      }

      // Configuration, not a user choice. args.model is ignored if supplied.
      const model = getCommunicatorModel();

      const question = args.question.trim();
      if (!question) {
        throw new Error('Please enter a question.');
      }
      if (question.length > MAX_QUESTION_LENGTH) {
        throw new Error(
          `Questions are limited to ${MAX_QUESTION_LENGTH} characters.`,
        );
      }

      // Get user details
      const user = await context.query.User.findOne({
        where: { id: session.itemId },
        query: 'id name email',
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Chats are written by this mutation only; generic create is disabled on
      // the list, so persistence runs with elevated access.
      const persist = (data: Record<string, any>) =>
        context.sudo().query.CommunicatorChat.createOne({
          data: { user: { connect: { id: user.id } }, ...data },
          query: 'id',
        });

      try {
        // The pipeline runs in this process and executes generated queries in
        // the caller's own Keystone context, so the model can only reach data
        // this user is allowed to see.
        const generator = createQueryGenerator(new CallerScopedGraphQL(context));

        const result = await generator.processQuery(
          question,
          model,
          String(user.id),
          user.name as string,
        );

        const chat = await persist({
          question,
          explanation: result.explanation || null,
          graphqlQuery: result.query || null,
          model,
          iterations: result.iterations || null,
          evaluationScore: result.evaluationScore || null,
          status: 'succeeded',
          hasError: 'false',
          rawData: result.data ?? null,
        });

        // Success and failure return the same key set so the client sees one
        // shape. The JSON scalar also rejects undefined, so optional values are
        // normalised to null.
        return {
          chatId: chat?.id ?? null,
          question,
          explanation: result.explanation ?? null,
          graphqlQuery: result.query ?? null,
          iterations: result.iterations ?? null,
          evaluationScore: result.evaluationScore ?? null,
          rawData: result.data ?? null,
          error: false,
          message: null,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to process the communicator request';

        console.error('Communicator Query Error:', errorMessage);
        captureError(error, {
          tags: { mutation: 'queryCommunicator', model },
          userId: String(user.id),
        });

        // Persist the failure so it shows up in history and in the failure
        // filter. A database problem here must not be reported as if the model
        // itself failed, so it is logged separately and the original error is
        // still returned.
        let chatId: string | null = null;
        try {
          const failedChat = await persist({
            question,
            model,
            status: 'failed',
            hasError: 'true',
            errorMessage,
            rawData: { error: errorMessage },
          });
          chatId = failedChat?.id ?? null;
        } catch (dbError) {
          console.error('Failed to save error to database:', dbError);
          captureError(dbError, {
            tags: { mutation: 'queryCommunicator', step: 'saveErrorToDb' },
          });
        }

        return {
          chatId,
          question,
          explanation: null,
          graphqlQuery: null,
          iterations: null,
          evaluationScore: null,
          rawData: null,
          error: true,
          message: errorMessage,
        };
      }
    },
  });
