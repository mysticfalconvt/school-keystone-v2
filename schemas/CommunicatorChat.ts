import { list } from '@keystone-6/core';
import {
  integer,
  json,
  relationship,
  select,
  text,
  timestamp,
} from '@keystone-6/core/fields';
import { ListAccessArgs } from '../types';

// Chat administration is its own capability. It used to piggyback on
// canManagePbis, which gave PBIS managers unrelated authority over other
// people's chat history and gave communicator moderators none.
function canManageCommunicatorChats({ session }: ListAccessArgs): boolean {
  if (!session) return false;
  return !!(session.data.isSuperAdmin || session.data.canManageCommunicator);
}

function isStaff({ session }: ListAccessArgs): boolean {
  if (!session) return false;
  return !!session.data.isStaff;
}

// Owners may update their own chat, but only the rating/comment fields - the
// field-level rules below keep the question, result and audit fields read-only
// for them, so a chat record cannot be edited after the fact.
function canUpdateChat({ session }: ListAccessArgs): boolean {
  if (!session) return false;
  return !!(session.data.isStaff || session.data.isSuperAdmin);
}

// Only the owner or a manager may touch a given row.
function updateFilter({ session }: ListAccessArgs) {
  if (!session) return false;
  if (session.data.isSuperAdmin || session.data.canManageCommunicator) {
    return true;
  }
  return { user: { id: { equals: session.itemId } } };
}

// Result and audit fields are written by the queryCommunicator mutation (which
// runs with elevated access) and must never be writable through the generic
// GraphQL API, or a user could forge their own audit trail.
const resultFieldAccess = {
  create: () => false,
  update: () => false,
};

export const CommunicatorChat = list({
  access: {
    operation: {
      query: isStaff,
      // Chats are created only by the queryCommunicator mutation, which uses
      // an elevated context. Disabling the generic create keeps users from
      // fabricating history.
      create: () => false,
      delete: canManageCommunicatorChats,
      update: canUpdateChat,
    },
    filter: {
      query: ({ session }: ListAccessArgs) => {
        if (!session) return false;
        // If user can manage all chats, show everything
        if (session.data.isSuperAdmin || session.data.canManageCommunicator) {
          return true;
        }
        // Otherwise, only show their own chats
        return {
          user: { id: { equals: session.itemId } },
        };
      },
      update: updateFilter,
      delete: updateFilter,
    },
  },
  ui: {
    listView: {
      initialColumns: ['user', 'question', 'status', 'createdAt'],
      pageSize: 50,
    },
  },
  fields: {
    user: relationship({
      ref: 'User.communicatorChats',
    }),
    question: text({
      validation: { isRequired: true },
      ui: {
        displayMode: 'textarea',
      },
      access: resultFieldAccess,
    }),
    explanation: text({
      ui: {
        displayMode: 'textarea',
      },
      access: resultFieldAccess,
    }),
    graphqlQuery: text({
      ui: {
        displayMode: 'textarea',
      },
      access: resultFieldAccess,
    }),
    errorMessage: text({
      ui: {
        displayMode: 'textarea',
      },
      access: resultFieldAccess,
    }),
    // Replaced hasError, which was text holding the strings 'true'/'false'.
    // The backfill in sql/2026-09-12-communicator-chat-backfill.sql has run and
    // been verified, so this is now the only record of the outcome.
    status: select({
      type: 'string',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Succeeded', value: 'succeeded' },
        { label: 'Failed', value: 'failed' },
      ],
      defaultValue: 'pending',
      validation: { isRequired: true },
      isIndexed: true,
      access: resultFieldAccess,
    }),
    model: text({
      validation: { isRequired: true },
      access: resultFieldAccess,
    }),
    iterations: integer({ access: resultFieldAccess }),
    evaluationScore: integer({ access: resultFieldAccess }),
    // The two fields an owner is allowed to write, via the generic update.
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
    // Raw model/query payloads can contain broad student and staff records.
    // Readable only by chat managers, and never writable through the API.
    rawData: json({
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      },
      access: {
        read: canManageCommunicatorChats,
        create: () => false,
        update: () => false,
      },
    }),
    createdAt: timestamp({
      defaultValue: { kind: 'now' },
      isIndexed: true,
      access: resultFieldAccess,
    }),
  },
});
