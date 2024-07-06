import "dotenv/config";

// config from Keystone
import { config, graphql } from "@keystone-6/core";

// Look in the schema file for how we define our lists, and how users interact with them through graphql or the Admin UI

import { withAuth, session } from "./auth";

// Schemas from individual files
import { User } from "./schemas/User";
import { Calendar } from "./schemas/Calendar";
import { Link } from "./schemas/Link";
import { Message } from "./schemas/Message";
import { PbisCard } from "./schemas/PbisCard";
import { PbisTeam } from "./schemas/PbisTeam";
import { PbisCollectionDate } from "./schemas/PbisCollectionDate";
import { RandomDrawingWin } from "./schemas/RandomDrawingWin";
import { StudentFocus } from "./schemas/StudentFocus";
import { CellPhoneViolation } from "./schemas/CellPhoneViolation";
import { Callback } from "./schemas/Callback";
import { ChromebookCheck } from "./schemas/ChromebookCheck";
import { ChromebookAssignment } from "./schemas/ChromebookAssignment";
import { Discipline } from "./schemas/Discipline";
import { PbisCollection } from "./schemas/PbisCollection";
// import { SchoolPbisInfo } from './schemas/SchoolPbisInfo'
import { Birthday } from "./schemas/Birthday";
import { BugReport } from "./schemas/BugReport";
import { Bullying } from "./schemas/Bullying";
import { SortingHatQuestion } from "./schemas/SortingHatQuestion";
import { TrimesterAward } from "./schemas/TrimesterAward";
import { Video } from "./schemas/video";

// database URL is set in .env file
const databaseURL =
  process.env.LOCAL_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/postgres";
if (databaseURL.includes("local")) console.log(databaseURL);

import { recalculateCallback } from "./mutations/recalculateCallback";
import recalculatePbis from "./mutations/recalculatePBIS";
import { updateStudentSchedules } from "./mutations/updateStudentSchedules";
import { addStaff } from "./mutations/AddStaff";
import addEvents from "./mutations/addEvents";
import { sendEmail } from "./mutations/sendEmail";
import addBirthdays from "./mutations/addBirthdays";

export default withAuth(
  config({
    db: {
      provider: "postgresql",
      url: databaseURL,
    },
    // server options
    server: {
      // the port to run the server on
      port: Number(process.env.PORT) || 4000,
      cors: {
        origin: [
          "http://localhost:3000",
          "http://localhost:7777",
          "https://ncujhs.tech",
          "https://www.ncujhs.tech",
          "https://www.ncujhs.tech/",
        ],
        credentials: true,
      },
    },
    // This config allows us to set up features of the Admin UI https://keystonejs.com/docs/apis/config#ui
    ui: {
      // For our starter, we check that someone has session data before letting them see the Admin UI.
      isAccessAllowed: (context) => !!context.session?.data?.isSuperAdmin,
    },
    lists: {
      User,
      Birthday,
      BugReport,
      Bullying,
      Callback,
      Calendar,
      CellPhoneViolation,
      ChromebookCheck,
      ChromebookAssignment,
      Discipline,
      Link,
      Message,
      PbisCard,
      PbisCollection,
      PbisTeam,
      PbisCollectionDate,
      RandomDrawingWin,
      SortingHatQuestion,
      StudentFocus,
      TrimesterAward,
      Video,
    },
    session,
    graphql: {
      playground: process.env.NODE_ENV === "development",
      extendGraphqlSchema: graphql.extend((base) => {
        return {
          mutation: {
            recalculateCallback: recalculateCallback(base),
            sendEmail: sendEmail(base),
            updateStudentSchedules: updateStudentSchedules(base),
            addStaff: addStaff(base),
          },
        };
      }),
    },
  })
);
