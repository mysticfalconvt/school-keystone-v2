import { integer, select, text, relationship, timestamp, checkbox, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { rules, isSignedIn } from '../access';

export const PbisCard = list({
    access: {
        // create: isSignedIn,
        // read: isSignedIn,
        // update: isSignedIn,
        // delete: isSignedIn,
    },
    fields: {
        category: text({
            isIndexed: true,
        }),
        cardMessage: text({
            ui: {
                displayMode: 'textarea',
            },
            isIndexed: true,
        }),

        student: relationship({
            ref: 'User.studentPbisCards',
            
        }),
        teacher: relationship({
            ref: 'User.teacherPbisCards',
        }),
        dateGiven: timestamp({
            validation:  {isRequired: true},
            defaultValue:{kind: "now"},
        }),
        counted: checkbox({ defaultValue: false, label: 'Counted' }),
    },
});
