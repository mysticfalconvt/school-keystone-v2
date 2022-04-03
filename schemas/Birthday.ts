import { text, relationship, timestamp, checkbox, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { rules, isSignedIn } from '../access';

export const Birthday = list({
    access: {
        // create: isSignedIn,
        // read: isSignedIn,
        // update: isSignedIn,
        // delete: isSignedIn,
    },
    fields: {
        cakeType: text(),
        date: timestamp({
            validation: {isRequired: true},
        }),
        hasChosen: checkbox({
            defaultValue: false,
            label: 'Has Chosen a Cake',
        }),
        hasDelivered: checkbox({
            defaultValue: false,
            label: 'Has gotten their cake',
        }),

        student: relationship({
            ref: 'User.birthday',
        }),


    },
});
