import { integer, select, text, relationship, timestamp, checkbox, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { rules, isSignedIn } from '../access';

export const SchoolPbisInfo = list({
    access: {
        // create: isSignedIn,
        // read: isSignedIn,
        // update: isSignedIn,
        // delete: isSignedIn,
    },
    fields: {

        teamName: text(),


        uncountedCards: integer({ defaultValue: 0 }),
        countedCards: integer({ defaultValue: 0 }),
        currentLevel: integer({ defaultValue: 0 }),
        numberOfStudents: integer(),
        averageCardsPerStudent: integer({ defaultValue: 0 }),


        dateModified: timestamp({
            validation: {isRequired: true},
            defaultValue: {kind: "now"},
        }),


    },
});
