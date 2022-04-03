import { integer, select, text, relationship, timestamp, checkbox, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { rules, isSignedIn } from '../access';

export const Callback = list({
    access: {
        // create: isSignedIn,
        // read: isSignedIn,
        // update: isSignedIn,
        // delete: isSignedIn,
    },
    fields: {
        title: text(),
        description: text({
            ui: {
                displayMode: 'textarea',
            },
        }),
        // category: text(),
        student: relationship({
            ref: 'User.callbackItems',
        }),
        teacher: relationship({
            ref: 'User.callbackAssigned',
        }),

        dateAssigned: timestamp({
            validation: {isRequired: true},
            defaultValue: {kind: "now"},
        }),
        dateCompleted: timestamp({
            
        }),
        link: text(),
        messageFromTeacher: text(),
        messageFromTeacherDate: text(),
        messageFromStudent: text(),
        messageFromStudentDate: text(),
        daysLate: integer(),

    },
});
