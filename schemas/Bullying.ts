import {  select, text, relationship, timestamp,  } from '@keystone-6/core/fields';
import { list } from '@keystone-6/core';
import {  isSignedIn } from '../access';

export const Bullying = list({
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
            initialColumns: [ 'dateOfEvent' , 'studentOffender', 'teacherAuthor' ],
            initialSort: { field: 'dateOfEvent', direction: 'ASC' },
            pageSize: 100,
        },
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



    }, 
});
