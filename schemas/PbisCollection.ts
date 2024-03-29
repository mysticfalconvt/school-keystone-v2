import { text, relationship, timestamp } from "@keystone-6/core/fields";
import { list } from "@keystone-6/core";
import { isSignedIn } from "../access";

export const PbisCollection = list({
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
      initialColumns: ["name", "collectionDate"],
      pageSize: 100,
    },
  },
  fields: {
    name: text(),

    collectionDate: timestamp({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
    }),
    personalLevelWinners: text({
      ui: {
        itemView: {
          fieldMode: "hidden",
        },
        listView: {
          fieldMode: "hidden",
        },
      },
    }),
    randomDrawingWinners: text({
      ui: {
        itemView: {
          fieldMode: "hidden",
        },
        listView: {
          fieldMode: "hidden",
        },
      },
    }),
    taTeamsLevels: text({
      ui: {
        itemView: {
          fieldMode: "hidden",
        },
        listView: {
          fieldMode: "hidden",
        },
      },
    }),
    taTeamNewLevelWinners: text({
      ui: {
        itemView: {
          fieldMode: "hidden",
        },
        listView: {
          fieldMode: "hidden",
        },
      },
    }),
    currentPbisTeamGoal: text({
      defaultValue: "0",
      validation: { isRequired: true },
    }),
    collectedCards: text(),

    dateModified: timestamp({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
    }),
    lastModifiedBy: relationship({ ref: "User" }),
  },
});
