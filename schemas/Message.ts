import { integer, select, text, relationship, timestamp, checkbox, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { rules, isSignedIn } from '../access';

export const Message = list({
    access: {
        // create: isSignedIn,
        // read: isSignedIn,
        // update: isSignedIn,
        // delete: isSignedIn,
    },
    fields: {
        subject: text(),
        message: text({
            ui: {
                displayMode: 'textarea',
            },
        }),

        sender: relationship({
            ref: 'User.messageSender',
        }),
        receiver: relationship({
            ref: 'User.messageReceiver',
        }),
        sent: timestamp({
            validation: {isRequired: true},
            defaultValue: {kind: "now"},
        }),
        read: checkbox({ defaultValue: false,  label: 'Read' }),
        link: text(),
    },
});
