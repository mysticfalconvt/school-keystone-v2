import { integer, select, text, relationship, timestamp, checkbox, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { rules, isSignedIn } from '../access';

export const CellPhoneViolation = list({
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
            initialColumns: [ 'dateGiven' , 'teacher', 'student' ],
            initialSort: { field: 'dateGiven', direction: 'ASC' },
            pageSize: 100,
        },
    },
    fields: {

        description: text({
            ui: {
                displayMode: 'textarea',
            },
        }),

        student: relationship({
            ref: 'User.studentCellPhoneViolation',
        }),
        teacher: relationship({
            ref: 'User.teacherCellPhoneViolation',
        }),
        dateGiven: timestamp({
            validation:  {isRequired: true},
            defaultValue:{kind: "now"},
            isIndexed: true,
        }),

    },
});
