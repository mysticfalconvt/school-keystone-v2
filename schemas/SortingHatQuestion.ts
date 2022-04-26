import { integer, select, text, relationship, timestamp, checkbox, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { rules, isSignedIn } from '../access';

export const SortingHatQuestion = list({
    access: {
        operation: {
            query: isSignedIn,
            create: isSignedIn,
            delete: isSignedIn,
            update: isSignedIn,
        }
    },
    fields: {

        question: text({
            ui: {
                displayMode: 'textarea',
            },
        }),
        gryffindorChoice: text(),
        hufflepuffChoice: text(),
        ravenclawChoice: text(),
        slytherinChoice: text(),

        createdBy: relationship({
            ref: 'User',
        }),

    },
    ui: {
        listView: {
            initialColumns: ['question'],
        },
    },
});
