import { integer, select, text, relationship, timestamp, checkbox, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { rules, isSignedIn } from '../access';

export const BugReport = list({
    access: {
        // create: isSignedIn,
        // read: isSignedIn,
        // update: isSignedIn,
        // delete: isSignedIn,
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
