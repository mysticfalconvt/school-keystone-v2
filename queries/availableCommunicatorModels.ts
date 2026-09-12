import { graphql } from '@keystone-6/core';
import { lmStudio } from '../lib/communicator/lmStudio';

// Model discovery, moved off the dashboard's public /api/communicator/models
// route. Gated by the same checks as queryCommunicator, so the inventory is not
// readable by users who cannot actually use the Communicator.
export const availableCommunicatorModels = (base: any) =>
  graphql.field({
    type: graphql.JSON,
    resolve: async (source, args, context) => {
      const session = await context.session;

      if (!session) {
        throw new Error('You must be logged in to use the communicator');
      }
      if (!session.data.isStaff) {
        throw new Error('Only staff members can access the communicator');
      }
      if (!session.data.isCommunicatorEnabled) {
        throw new Error(
          'You do not have permission to use the communicator. Please contact an administrator.',
        );
      }

      try {
        const models = await lmStudio.getModelsWithLimits();
        return models.map((m) => ({
          id: m.id,
          type: m.type ?? null,
          maxContextLength: m.max_context_length ?? null,
        }));
      } catch (error) {
        // getModelsWithLimits already falls back and swallows its own errors;
        // this catches a missing LM_STUDIO_ENDPOINT, which throws.
        const message =
          error instanceof Error ? error.message : 'Failed to list models';
        console.error('availableCommunicatorModels:', message);
        return { error: true, message, models: [] };
      }
    },
  });
