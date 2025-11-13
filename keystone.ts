import 'dotenv/config';

// config from Keystone
import { config, graphql } from '@keystone-6/core';

// Look in the schema file for how we define our lists, and how users interact with them through graphql or the Admin UI

import { session, withAuth } from './auth';

// Schemas from individual files
import { Calendar } from './schemas/Calendar';
import { Callback } from './schemas/Callback';
import { CellPhoneViolation } from './schemas/CellPhoneViolation';
import { ChromebookAssignment } from './schemas/ChromebookAssignment';
import { CommunicatorChat } from './schemas/CommunicatorChat';
import { ChromebookCheck } from './schemas/ChromebookCheck';
import { Discipline } from './schemas/Discipline';
import { Link } from './schemas/Link';
import { Message } from './schemas/Message';
import { PbisCard } from './schemas/PbisCard';
import { PbisCollection } from './schemas/PbisCollection';
import { PbisCollectionDate } from './schemas/PbisCollectionDate';
import { PbisTeam } from './schemas/PbisTeam';
import { RandomDrawingWin } from './schemas/RandomDrawingWin';
import { StudentFocus } from './schemas/StudentFocus';
import { User } from './schemas/User';
// import { SchoolPbisInfo } from './schemas/SchoolPbisInfo'
import { Birthday } from './schemas/Birthday';
import { BugReport } from './schemas/BugReport';
import { Bullying } from './schemas/Bullying';
import { SortingHatQuestion } from './schemas/SortingHatQuestion';
import { TrimesterAward } from './schemas/TrimesterAward';
import { Video } from './schemas/video';

// database URL is set in .env file
const databaseURL =
  process.env.LOCAL_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/postgres';
if (databaseURL.includes('local')) console.log(databaseURL);

import { addStaff } from './mutations/AddStaff';
import { queryCommunicator } from './mutations/queryCommunicator';
import { recalculateCallback } from './mutations/recalculateCallback';
import { sendEmail } from './mutations/sendEmail';
import { updateStudentSchedules } from './mutations/updateStudentSchedules';

export default withAuth(
  config({
    db: {
      provider: 'postgresql',
      url: databaseURL,
    },
    // server options
    server: {
      // the port to run the server on
      port: Number(process.env.PORT) || 4000,
      cors: {
        origin: [
          /^https?:\/\/localhost:\d+$/,
          'https://ncujhs.tech',
          'https://www.ncujhs.tech',
          'https://www.ncujhs.tech/',
          'https://old.ncujhs.tech',
          'https://old.ncujhs.tech/',
          'http://10.0.0.23:7979',
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
      CommunicatorChat,
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
      playground: process.env.NODE_ENV === 'development',
      extendGraphqlSchema: graphql.extend((base) => {
        return {
          mutation: {
            recalculateCallback: recalculateCallback(base),
            sendEmail: sendEmail(base),
            updateStudentSchedules: updateStudentSchedules(base),
            addStaff: addStaff(base),
            queryCommunicator: queryCommunicator(base),
          },
        };
      }),
    },
  }),
);
