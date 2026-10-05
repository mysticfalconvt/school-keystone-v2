import { list } from '@keystone-6/core';
import {
  checkbox,
  integer,
  select,
  text,
  timestamp,
} from '@keystone-6/core/fields';
import { ListAccessArgs } from '../types';

function canViewEmailQueue({ session }: ListAccessArgs) {
  return !!(session?.data?.isSuperAdmin || session?.data?.canManagePbis);
}

const queueManagedField = {
  create: () => false,
  update: () => false,
};

export const EmailDelivery = list({
  access: {
    operation: {
      query: canViewEmailQueue,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: ({ session }: ListAccessArgs) => {
        if (session?.data?.isSuperAdmin) return true;
        if (session?.data?.canManagePbis) {
          return { lowPriority: { equals: true } };
        }
        return false;
      },
    },
  },
  ui: {
    isHidden: ({ session }) => !session?.data?.isSuperAdmin,
    listView: {
      initialColumns: [
        'recipient',
        'subject',
        'status',
        'lowPriority',
        'attempts',
        'createdAt',
        'sentAt',
      ],
      initialSort: { field: 'createdAt', direction: 'DESC' },
      pageSize: 50,
    },
  },
  fields: {
    recipient: text({
      validation: { isRequired: true },
      isIndexed: true,
      access: queueManagedField,
    }),
    replyTo: text({ access: queueManagedField }),
    subject: text({
      validation: { isRequired: true },
      access: queueManagedField,
    }),
    // The worker needs the rendered body while a delivery is pending. It is
    // never exposed through GraphQL and is erased after success/final failure.
    html: text({
      validation: { isRequired: true },
      graphql: { omit: true },
      ui: { itemView: { fieldMode: 'hidden' } },
      access: queueManagedField,
    }),
    kind: select({
      type: 'string',
      options: [
        { label: 'General', value: 'general' },
        { label: 'PBIS bulk', value: 'pbis-bulk' },
        { label: 'Magic link', value: 'magic-link' },
        { label: 'Password reset', value: 'password-reset' },
      ],
      defaultValue: 'general',
      validation: { isRequired: true },
      isIndexed: true,
      access: queueManagedField,
    }),
    lowPriority: checkbox({
      defaultValue: false,
      access: queueManagedField,
    }),
    batchId: text({ isIndexed: true, access: queueManagedField }),
    requestedById: text({ isIndexed: true, access: queueManagedField }),
    status: select({
      type: 'string',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Sending', value: 'processing' },
        { label: 'Retrying', value: 'retrying' },
        { label: 'Sent', value: 'sent' },
        { label: 'Failed', value: 'failed' },
      ],
      defaultValue: 'pending',
      validation: { isRequired: true },
      isIndexed: true,
      access: queueManagedField,
    }),
    attempts: integer({
      defaultValue: 0,
      validation: { isRequired: true },
      access: queueManagedField,
    }),
    maxAttempts: integer({
      defaultValue: 5,
      validation: { isRequired: true },
      access: queueManagedField,
    }),
    nextAttemptAt: timestamp({ isIndexed: true, access: queueManagedField }),
    lastAttemptAt: timestamp({ access: queueManagedField }),
    lockedAt: timestamp({ access: queueManagedField }),
    lockId: text({
      graphql: { omit: true },
      ui: { itemView: { fieldMode: 'hidden' } },
      access: queueManagedField,
    }),
    expiresAt: timestamp({ isIndexed: true, access: queueManagedField }),
    sentAt: timestamp({ isIndexed: true, access: queueManagedField }),
    providerMessageId: text({ access: queueManagedField }),
    lastError: text({
      ui: { displayMode: 'textarea' },
      access: queueManagedField,
    }),
    createdAt: timestamp({
      defaultValue: { kind: 'now' },
      isIndexed: true,
      access: queueManagedField,
    }),
  },
});
