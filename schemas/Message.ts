import {  text, relationship, timestamp, checkbox, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import {  isSignedIn } from '../access';

export const Message = list({
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
            initialColumns: ['subject', 'receiver', 'sent' ],
            pageSize: 100,
        },
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
