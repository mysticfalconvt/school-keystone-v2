import { integer, select, text, relationship, timestamp, checkbox, } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import { check } from 'prettier';
import { rules, isSignedIn } from '../access';

export const Bullying = list({
    access: {
        // create: isSignedIn,
        // read: isSignedIn,
        // update: isSignedIn,
        // delete: isSignedIn,
    },
    fields: {

        studentOffender: relationship({
            ref: 'User',
        }),
        teacherAuthor: relationship({
            ref: 'User',
        }),

        dateReported: timestamp({
            validation: {isRequired: true},
            defaultValue: {kind: "now"},
        }),
        dateOfEvent: timestamp({
            validation: {isRequired: true},
         defaultValue: {kind: "now"},
        }),
        investigationDate: timestamp({
            validation: {isRequired: true},
            defaultValue: {kind: "now"},
        }),

        studentReporter: text(),
        employeeWitness: text(),
        studentWitness: text(),
        studentsInterviewed: text(),
        initialActions: text(),
        nextSteps: text(),
        reporter: text(),
        description: text(),
        determination: select({
            options: [
                { value: 'No', label: 'No' },
                { value: 'Yes', label: 'Yes' },
            ],
        }),
        determinationDate: timestamp({
            validation: {isRequired: true},
            defaultValue: {kind: "now"},
        }),
        determinationExplanation: text(),
        assignmentInvestigator: text(),



    }, ui: {
        listView: {
            initialColumns: ['studentOffender', 'teacherAuthor', 'dateReported'],
            initialSort: { field: 'dateReported', direction: "ASC" },
        }
    }
});
