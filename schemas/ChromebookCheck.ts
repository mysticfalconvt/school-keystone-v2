import {
  text,
  relationship,
  timestamp,
  checkbox,
} from "@keystone-6/core/fields";
import { list } from "@keystone-6/core";
import { isSignedIn } from "../access";

export const ChromebookCheck = list({
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
      initialColumns: ["time", "student", "classroom"],
      pageSize: 100,
    },
  },
  fields: {
    time: timestamp({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
    }),
    student: relationship({
      ref: "User.chromebookCheck",
    }),
    // The teacher whose classroom the chromebook lives in. Checks are done by
    // the classroom teacher, not by the student's TA.
    classroom: relationship({
      ref: "User.classroomChromebookChecks",
    }),
    message: text(),
  },
});
