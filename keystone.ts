import './lib/loadEnv';

// Bugsink error reporting. Imported early so the SDK's uncaught-exception and
// unhandled-rejection handlers are installed before anything else runs.
import { bugsinkApolloPlugin } from './lib/bugsink';

// config from Keystone
import { config, graphql } from '@keystone-6/core';

// Look in the schema file for how we define our lists, and how users interact with them through graphql or the Admin UI

import { authSchema, session } from './auth';

// Schemas from individual files
import { Calendar } from './schemas/Calendar';
import { Callback } from './schemas/Callback';
import { CallbackRewardRun } from './schemas/CallbackRewardRun';
import { CellPhoneViolation } from './schemas/CellPhoneViolation';
import { CommunicatorChat } from './schemas/CommunicatorChat';
import { ChromebookCheck } from './schemas/ChromebookCheck';
import { Discipline } from './schemas/Discipline';
import { EmailDelivery } from './schemas/EmailDelivery';
import { Link } from './schemas/Link';
import { Message } from './schemas/Message';
import { PbisCard } from './schemas/PbisCard';
import { StaffPbisCard } from './schemas/StaffPbisCard';
import { PbisCollectionDate } from './schemas/PbisCollectionDate';
import { RandomDrawingWin } from './schemas/RandomDrawingWin';
import { StudentFocus } from './schemas/StudentFocus';
import { User } from './schemas/User';
import { AssignmentHistory } from './schemas/AssignmentHistory';
import { Birthday } from './schemas/Birthday';
import { BugReport } from './schemas/BugReport';
import { Bullying } from './schemas/Bullying';
import { SortingHatQuestion } from './schemas/SortingHatQuestion';
import { TrimesterAward } from './schemas/TrimesterAward';
import { Video } from './schemas/video';

import { PrismaPg } from '@prisma/adapter-pg';
import { resolveDatabaseUrl } from './lib/databaseUrl';

import { addStaff } from './mutations/AddStaff';
import { authenticateUserWithGoogle } from './mutations/authenticateWithGoogle';
import { authTokenSchema } from './mutations/authTokens';
import { impersonateUser } from './mutations/impersonateUser';
import { queryCommunicator } from './mutations/queryCommunicator';
import { recalculateCallback } from './mutations/recalculateCallback';
import { sendEmail } from './mutations/sendEmail';
import { updateStudentSchedules } from './mutations/updateStudentSchedules';
import { startEmailQueueWorker } from './lib/emailQueue';

export default config({
  db: {
    provider: 'postgresql',
    // Prisma 7 connects through a driver adapter; the URL comes from the
    // same resolver prisma.config.ts uses.
    prismaClientOptions: () => ({
      adapter: new PrismaPg({ connectionString: resolveDatabaseUrl() }),
    }),
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
    extendHttpServer: (server, context) => {
      startEmailQueueWorker(context, (stop) => server.on('close', stop));
    },
  },
  // This config allows us to set up features of the Admin UI https://keystonejs.com/docs/apis/config#ui
  ui: {
    // Super admins only. There is no sign-in page: signing in on the dashboard
    // sets this server's session cookie too (see auth.ts).
    isAccessAllowed: (context) => !!context.session?.data?.isSuperAdmin,
  },
  lists: {
    User,
    AssignmentHistory,
    Birthday,
    BugReport,
    Bullying,
    Callback,
    CallbackRewardRun,
    Calendar,
    CellPhoneViolation,
    ChromebookCheck,
    CommunicatorChat,
    Discipline,
    EmailDelivery,
    Link,
    Message,
    PbisCard,
    StaffPbisCard,
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
    apolloConfig: {
      // Keystone appends these to its own plugins, so the playground config
      // above is unaffected.
      plugins: [bugsinkApolloPlugin],
    },
    extendGraphqlSchema: graphql.extend((base) => {
      const auth = authSchema(base);
      const authTokens = authTokenSchema(base);
      return {
        query: {
          ...auth.query,
        },
        mutation: {
          ...auth.mutation,
          ...authTokens.mutation,
          recalculateCallback: recalculateCallback(base),
          sendEmail: sendEmail(base),
          updateStudentSchedules: updateStudentSchedules(base),
          addStaff: addStaff(base),
          queryCommunicator: queryCommunicator(base),
          authenticateUserWithGoogle: authenticateUserWithGoogle(base),
          impersonateUser: impersonateUser(base),
        },
      };
    }),
  },
});
