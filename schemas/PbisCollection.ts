import { integer, select, text, relationship, timestamp, checkbox, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { rules, isSignedIn } from '../access';

export const PbisCollection = list({
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
            initialColumns: ['name', 'collectionDate' ],
            pageSize: 100,
        },
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
