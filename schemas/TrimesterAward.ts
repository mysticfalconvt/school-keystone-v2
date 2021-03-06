import { text, relationship, timestamp, checkbox, select, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { isSignedIn } from '../access';

export const TrimesterAward = list({
    access: {
        operation: {
            query: isSignedIn,
            create: isSignedIn,
            delete: isSignedIn,
            update: isSignedIn,
        }
    },
    ui: {
        labelField: "teacher",
        listView: {
            initialColumns: ['howl', 'teacher', 'student', 'trimester' ],
            pageSize: 100,
        },
    },
    fields: {
        howl: select({
            options: [
                { value: 'Respect', label: 'Respect' },
                { value: 'Responsibility', label: 'Responsibility' },
                { value: 'Perseverance', label: 'Perseverance' },
            ],

           validation:{ isRequired: true},
        }),
        trimester: select({
            options: [
                { value: '1', label: '1' },
                { value: '2', label: '2' },
                { value: '3', label: '3' },
            ],
            isIndexed: true,
        }),

        date: timestamp({
            validation: {isRequired: true}, 
            defaultValue: {kind: "now"},
        }),

        student: relationship({
            ref: 'User',
        }),
        teacher: relationship({
            ref: 'User',
        }),


    },
});
