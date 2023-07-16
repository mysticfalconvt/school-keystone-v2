import { text, relationship, timestamp } from "@keystone-6/core/fields";
import { list } from "@keystone-6/core";
import { isSignedIn } from "../access";

export const RandomDrawingWin = list({
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
      initialColumns: ["student", "collectionDate"],
      pageSize: 100,
    },
  },
  fields: {
    student: relationship({
      ref: "User.randomDrawingWins",
    }),
    collectionDate: relationship({
      ref: "PbisCollectionDate.randomDrawingWinners",
      many: false,
    }),
    lastModifiedBy: relationship({ ref: "User" }),
  },
});
