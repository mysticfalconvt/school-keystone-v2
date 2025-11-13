import { text, relationship, timestamp, json, integer } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { ListAccessArgs } from '../types';

// Access control: only staff can query/create, only superadmin/canManagePbis can see all
function canManageCommunicatorChats({ session }: ListAccessArgs): boolean {
  if (!session) return false;
  return !!(session.data.isSuperAdmin || session.data.canManagePbis);
}

function isStaff({ session }: ListAccessArgs): boolean {
  if (!session) return false;
  return !!session.data.isStaff;
}

export const CommunicatorChat = list({
  access: {
    operation: {
      query: isStaff,
      create: isStaff,
      delete: canManageCommunicatorChats,
      update: canManageCommunicatorChats,
    },
    filter: {
      query: ({ session }) => {
        if (!session) return false;
        // If user can manage all chats, show everything
        if (session.data.isSuperAdmin || session.data.canManagePbis) {
          return true;
        }
        // Otherwise, only show their own chats
        return {
          user: { id: { equals: session.itemId } },
        };
      },
    },
  },
  ui: {
    listView: {
      initialColumns: ['user', 'question', 'createdAt'],
      pageSize: 50,
    },
  },
  fields: {
    user: relationship({
      ref: 'User.communicatorChats',
      ui: {
        displayMode: 'cards',
        cardFields: ['name', 'email'],
        inlineEdit: { fields: ['name', 'email'] },
        linkToItem: true,
        inlineCreate: { fields: ['name', 'email'] },
      },
    }),
    question: text({
      validation: { isRequired: true },
      ui: {
        displayMode: 'textarea',
      },
    }),
    explanation: text({
      ui: {
        displayMode: 'textarea',
      },
    }),
    graphqlQuery: text({
      ui: {
        displayMode: 'textarea',
      },
    }),
    errorMessage: text({
      ui: {
        displayMode: 'textarea',
      },
    }),
    hasError: text({
      defaultValue: 'false',
    }),
    model: text({
      validation: { isRequired: true },
    }),
    iterations: integer(),
    evaluationScore: integer(),
    userRating: integer({
      defaultValue: 0,
      validation: {
        min: 0,
        max: 10,
      },
    }),
    userComment: text({
      defaultValue: '',
      ui: {
        displayMode: 'textarea',
      },
    }),
    rawData: json({
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      },
    }),
    timestamp: timestamp(),
    createdAt: timestamp({
      defaultValue: { kind: 'now' },
    }),
  },
});
