import { integer, select, text, relationship, timestamp, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { rules, isSignedIn } from '../access';

export const Calendar = list({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn,
  }
  },
  fields: {
    name: text({ validation: {isRequired: true} }),
    description: text({
      ui: {
        displayMode: 'textarea',
      },

    }),

    status: select({
      options: [
        { label: 'Teachers', value: 'Teachers' },
        { label: 'Students', value: 'Students' },
        { label: 'Both', value: 'Both' },
      ],
      defaultValue: 'Both',
     validation: { isRequired: true},
      ui: {
        displayMode: 'segmented-control',
        createView: { fieldMode: 'hidden' },
      },
    }),
    date: timestamp({
      validation: {isRequired: true},
      defaultValue: {kind: "now"},
    }),
    author: relationship({
      ref: 'User',
    }),
    dateCreated: timestamp({
      validation: {isRequired: true},
      defaultValue: {kind: "now"},
    }),
    link: text(),
    linkTitle: text(),
  },
});
