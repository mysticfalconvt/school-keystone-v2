import { list } from "@keystone-6/core";
import { integer, relationship, timestamp } from "@keystone-6/core/fields";
import { isSignedIn } from "../access";

// History of each weekly "callback reward" run. Mirrors PbisCollectionDate:
// one record per run, with the students who were eligible (got the reward =
// "yes") and those who were not (3+ active callbacks = "no").
export const CallbackRewardRun = list({
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
      initialColumns: ["runDate", "cardsAwarded"],
      initialSort: { field: "runDate", direction: "DESC" },
      pageSize: 100,
    },
  },
  fields: {
    runDate: timestamp({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
    }),
    // Students who received the reward this run ("yes").
    eligibleStudents: relationship({ ref: "User", many: true }),
    // Students skipped this run because of 3+ active callbacks ("no").
    ineligibleStudents: relationship({ ref: "User", many: true }),
    cardsAwarded: integer({ defaultValue: 0 }),
    lastModifiedBy: relationship({ ref: "User" }),
  },
});
