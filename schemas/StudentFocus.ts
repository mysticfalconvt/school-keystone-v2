import { integer, select, text, relationship, timestamp, checkbox, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { rules, isSignedIn } from '../access';

export const StudentFocus = list({
    access: {
        // create: isSignedIn,
        // read: () => true,
        // update: isSignedIn,
        // delete: isSignedIn,
    },
    fields: {

        comments: text({
            ui: {
                displayMode: 'textarea',
            },
        }),
        category: text(),
        student: relationship({
            ref: 'User.studentFocusStudent',
        }),
        teacher: relationship({
            ref: 'User.studentFocusTeacher',
        }),

        dateCreated: timestamp({
            validation: {isRequired: true},
            defaultValue: {kind: "now"},
        }),

    },
});
