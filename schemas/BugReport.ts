import {  text, relationship, timestamp, checkbox, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import {  isSignedIn } from '../access';
import { reportUserBug } from '../lib/bugsink';

export const BugReport = list({
    access: {
        operation: {
            query: isSignedIn,
            create: isSignedIn,
            delete: isSignedIn,
            update: isSignedIn,
        }
    },
    hooks: {
        // Mirror anything a user reports here into Bugsink so it lands in the
        // same place as the errors the server catches on its own. Never throws,
        // so a Bugsink outage cannot block someone filing a report.
        afterOperation: {
            create: async ({ item }) => {
                reportUserBug({
                    title: String(item.name),
                    description: item.description
                        ? String(item.description)
                        : undefined,
                    submittedById: item.submittedById
                        ? String(item.submittedById)
                        : undefined,
                });
            },
        },
    },
    ui: {
        listView: {
            initialColumns: [ 'name', 'description', 'submittedBy' ],
            initialSort: { field: 'date', direction: 'ASC' },
            pageSize: 100,
        },
    },
    fields: {
        name: text({ validation: { isRequired: true }}),
        description: text({
            ui: {
                displayMode: 'textarea',
            },

        }),

        submittedBy: relationship({
            ref: 'User',
        }),
        date: timestamp({
            validation:{ isRequired: true},
            defaultValue: {kind: "now"}
        }),
        read: checkbox({defaultValue: false}),

    },
});
