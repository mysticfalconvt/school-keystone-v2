import {
  integer,
  select,
  text,
  relationship,
  timestamp,
  checkbox,
} from "@keystone-6/core/fields";
import { list } from "@keystone-6/core";
import { isSignedIn } from "../access";

export const Discipline = list({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["date", "teacher", "student"],
      initialSort: { field: "date", direction: "ASC" },
      pageSize: 100,
    },
  },
  fields: {
    teacherComments: text({
      ui: {
        displayMode: "textarea",
      },
    }),
    adminComments: text({
      ui: {
        displayMode: "textarea",
      },
    }),
    classType: select({
      options: [
        { label: "Math", value: "Math" },
        { label: "Language Arts", value: "Language Arts" },
        { label: "Science", value: "Science" },
        { label: "Social Studies", value: "Social Studies" },
        { label: "Trimester", value: "Trimester" },
        { label: "TA", value: "TA" },
        { label: "Lunch", value: "Lunch" },
        { label: "Break", value: "Break" },
        { label: "Other", value: "Other" },
      ],
      ui: {
        displayMode: "segmented-control",
        // createView: { fieldMode: 'hidden' },
      },
    }),
    location: select({
      options: [
        { label: "Classroom", value: "Classroom" },
        { label: "Gym", value: "Gym" },
        { label: "Library", value: "Library" },
        { label: "Cafeteria", value: "Cafeteria" },
        { label: "Hallway", value: "Hallway" },
        { label: "Bus", value: "Bus" },
        { label: "Outdoor Classroom", value: "Outdoor Classroom" },
        { label: "Other Location", value: "Other Location" },
        { label: "Break", value: "Break" },
      ],
      ui: {
        displayMode: "segmented-control",
        // createView: { fieldMode: 'hidden' },
      },
    }),
    timeOfDay: select({
      options: [
        { label: "Morning TA", value: "Morning TA" },
        { label: "Block 1", value: "Block 1" },
        { label: "Block 2", value: "Block 2" },
        { label: "Block 3", value: "Block 3" },
        { label: "Block 4", value: "Block 4" },
        { label: "Block 5", value: "Block 5" },
        { label: "block 6", value: "Block 6" },
        { label: "block 7", value: "Block 7" },
        { label: "block 8", value: "Block 8" },
        { label: "block 9", value: "Block 9" },
        { label: "block 10", value: "Block 10" },
        { label: "Lunch", value: "Lunch" },
        { label: "Guided Study", value: "Guided Study" },
        { label: "Afternoon TA", value: "Afternoon TA" },
      ],
      ui: {
        displayMode: "select",
        // createView: { fieldMode: 'hidden' },
      },
      isIndexed: true,
    }),
    student: relationship({
      ref: "User.studentDiscipline",
    }),
    teacher: relationship({
      ref: "User.teacherDiscipline",
    }),

    date: timestamp({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
    }),
    addressed: timestamp({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
    }),
    inappropriateLanguage: checkbox(),
    physicalConduct: checkbox(),
    nonCompliance: checkbox(),
    disruption: checkbox(),
    propertyMisuse: checkbox(),
    otherConduct: checkbox(),
    // Teacher Actions
    VerbalWarning: checkbox(),
    buddyRoom: checkbox(),
    conferenceWithStudent: checkbox(),
    ParentContact: checkbox(),
    PlanningRoomReferral: checkbox(),
    FollowupPlan: checkbox(),
    LossOfPrivilege: checkbox(),
    DetentionWithTeacher: checkbox(),
    IndividualizedInstruction: checkbox(),
    GuidanceReferral: checkbox(),
    ReferToAdministrator: checkbox(),
    OtherAction: checkbox(),
    // Others Involved
    none: checkbox(),
    peers: checkbox(),
    teacherInvolved: checkbox(),
    substitute: checkbox(),
    unknown: checkbox(),
    othersInvolved: checkbox(),
  },
});
