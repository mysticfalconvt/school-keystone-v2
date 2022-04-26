import { integer, select, text, relationship, timestamp, checkbox, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { rules, isSignedIn } from '../access';

export const Link = list({
    access: {
        operation: {
            query: isSignedIn,
            create: isSignedIn,
            delete: isSignedIn,
            update: isSignedIn,
        }
    },
    fields: {
        name: text({ validation: {isRequired: true }}),
        description: text({
            ui: {
                displayMode: 'textarea',
            },

        }),

        forTeachers: checkbox({
            defaultValue: false,
            label: 'Teachers can view',
        }),
        forStudents: checkbox({
            defaultValue: false,
            label: 'Students can view',
        }),
        forParents: checkbox({
            defaultValue: false,
            label: 'Parents can view',
        }),
        onHomePage: checkbox({
            defaultValue: false,
            label: 'Display on the home page'
        }),
        forPbis: checkbox({
            defaultValue: false,
            label: 'Display on the PBIS page'
        }),

        modifiedBy: relationship({
            ref: 'User',
        }),
        modified: timestamp({
            validation: {isRequired: true},
            defaultValue: {kind: "now"},
        }),
        link: text(),

    },
});
