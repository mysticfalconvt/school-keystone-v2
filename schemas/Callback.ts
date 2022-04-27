import { integer, select, text, relationship, timestamp, checkbox, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { isSignedIn } from '../access';

export const Callback = list({
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
            initialColumns: [ 'dateAssigned' , 'teacher', 'student', 'title' ],
            initialSort: { field: 'dateAssigned', direction: 'ASC' },
            pageSize: 100,
        },
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
            isIndexed: true,
        }),
        link: text(),
        messageFromTeacher: text(),
        messageFromTeacherDate: text(),
        messageFromStudent: text(),
        messageFromStudentDate: text(),
        daysLate: integer(),

    },
});
