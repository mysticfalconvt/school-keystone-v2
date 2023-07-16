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

export const SortingHatQuestion = list({
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
      initialColumns: ["createdBy", "question"],
      pageSize: 100,
    },
  },
  fields: {
    question: text({
      ui: {
        displayMode: "textarea",
      },
    }),
    gryffindorChoice: text(),
    hufflepuffChoice: text(),
    ravenclawChoice: text(),
    slytherinChoice: text(),

    createdBy: relationship({
      ref: "User",
    }),
  },
});
