import { text, relationship, timestamp, checkbox, select, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { rules, isSignedIn } from '../access';

export const TrimesterAward = list({
    access: {
        create: isSignedIn,
        read: isSignedIn,
        update: isSignedIn,
        delete: isSignedIn,
    },
    fields: {
        howl: select({
            options: [
                { value: 'Respect', label: 'Respect' },
                { value: 'Responsibility', label: 'Responsibility' },
                { value: 'Perseverance', label: 'Perseverance' },
            ],

            isRequired: true,
        }),
        trimester: select({
            options: [
                { value: '1', label: '1' },
                { value: '2', label: '2' },
                { value: '3', label: '3' },
            ],
        }),

        date: timestamp({
            isRequired: true,
            defaultValue: () => new Date().toISOString(),

        }),

        student: relationship({
            ref: 'User',
        }),
        teacher: relationship({
            ref: 'User',
        }),


    },
});
