import { text, relationship, timestamp } from "@keystone-6/core/fields";
import { list } from "@keystone-6/core";
import { isSignedIn } from "../access";

export const PbisCollectionDate = list({
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
      initialColumns: ["collectionDate", "collectedCards"],
      pageSize: 100,
    },
  },
  fields: {
    collectionDate: timestamp({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
    }),
    randomDrawingWinners: relationship({
      ref: "RandomDrawingWin.collectionDate",
      many: true,
    }),
    personalLevelWinners: relationship({
      ref: "User",
      many: true,
    }),
    taNewLevelWinners: relationship({
      ref: "User",
      many: true,
    }),
    collectedCards: text(),
    lastModifiedBy: relationship({ ref: "User" }),
  },
});
