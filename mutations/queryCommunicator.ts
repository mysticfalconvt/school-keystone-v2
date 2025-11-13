import { graphql } from '@keystone-6/core';

export const queryCommunicator = (base: any) =>
  graphql.field({
    type: graphql.JSON,

    args: {
      question: graphql.arg({ type: graphql.nonNull(graphql.String) }),
      model: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    },
    resolve: async (source, args, context) => {
      const session = await context.session;

      // Check if user is signed in
      if (!session) {
        throw new Error('You must be logged in to use the communicator');
      }
      console.log(session.data);
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

      const COMMUNICATOR_ENDPOINT = process.env.COMMUNICATOR_ENDPOINT;
      const COMMUNICATOR_API_KEY = process.env.COMMUNICATOR_API_KEY;

      if (!COMMUNICATOR_ENDPOINT || !COMMUNICATOR_API_KEY) {
        console.error('Communicator service configuration is missing');
        throw new Error('Communicator service is not configured');
      }

      // Get user details
      const user = await context.query.User.findOne({
        where: { id: session.itemId },
        query: 'id name email',
      });

      if (!user) {
        throw new Error('User not found');
      }

      try {
        // Make request to external communicator service
        const response = await fetch(`${COMMUNICATOR_ENDPOINT}/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': COMMUNICATOR_API_KEY,
          },
          body: JSON.stringify({
            question: args.question,
            model: args.model,
            includeRawData: true,
            userId: user.id,
            userName: user.name,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorDetails = errorText;

          // Try to parse error as JSON for better formatting
          try {
            const errorJson = JSON.parse(errorText);
            errorDetails = JSON.stringify(errorJson, null, 2);
          } catch {
            // Keep original text if not JSON
          }

          const errorMessage = `Communicator API error (${response.status} ${response.statusText}):\n${errorDetails}`;
          console.error(errorMessage);

          // Save error to database
          await context.query.CommunicatorChat.createOne({
            data: {
              user: { connect: { id: user.id } },
              question: args.question,
              model: args.model,
              hasError: 'true',
              errorMessage: errorMessage,
              rawData: { error: errorText, status: response.status },
            },
          });

          // Return error response to user
          return {
            error: true,
            message: `The communicator service returned an error: ${response.statusText}`,
            details: errorDetails,
            status: response.status,
          };
        }

        const data = await response.json();

        // Store the successful chat in the database
        await context.query.CommunicatorChat.createOne({
          data: {
            user: { connect: { id: user.id } },
            question: data.question || args.question,
            explanation: data.explanation || null,
            graphqlQuery: data.graphqlQuery || null,
            model: args.model,
            iterations: data.iterations || null,
            evaluationScore: data.evaluationScore || null,
            hasError: 'false',
            rawData: data.rawData || data,
            timestamp: data.timestamp || null,
          },
        });

        // Return the response to the user
        return data;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to query communicator service';

        console.error('Communicator Query Error:', error);

        // Save error to database
        try {
          await context.query.CommunicatorChat.createOne({
            data: {
              user: { connect: { id: user.id } },
              question: args.question,
              model: args.model,
              hasError: 'true',
              errorMessage: errorMessage,
              rawData: { error: errorMessage },
            },
          });
        } catch (dbError) {
          console.error('Failed to save error to database:', dbError);
        }

        // Return error response instead of throwing
        return {
          error: true,
          message: errorMessage,
        };
      }
    },
  });
