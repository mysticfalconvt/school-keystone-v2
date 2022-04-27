import {  text, relationship, timestamp, checkbox, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import {  isSignedIn } from '../access';

export const BugReport = list({
    access: {
        operation: {
            query: isSignedIn,
            create: isSignedIn,
            delete: isSignedIn,
            update: isSignedIn,
        }
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
