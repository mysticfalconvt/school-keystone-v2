import { integer, select, text, relationship, timestamp, checkbox, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { rules, isSignedIn } from '../access';

export const PbisCollection = list({
    access: {
        // create: isSignedIn,
        // read: isSignedIn,
        // update: isSignedIn,
        // delete: isSignedIn,
    },
    fields: {
        name: text(),

        collectionDate: timestamp({
            validation: {isRequired: true},
            defaultValue: {kind: "now"},
            
        }),
        personalLevelWinners: text(),
        randomDrawingWinners: text(),
        taTeamsLevels: text(),
        taTeamNewLevelWinners: text(),
        currentPbisTeamGoal: text({ defaultValue: '0',validation: { isRequired: true} }),
        collectedCards: text(),

        dateModified: timestamp({
            validation: {isRequired: true},
            defaultValue: {kind: "now"},
        }),
        lastModifiedBy: relationship({ ref: 'User' })

    },
});
