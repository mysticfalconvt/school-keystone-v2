/*
Welcome to Keystone! This file is what keystone uses to start the app.

It looks at the default export, and expects a Keystone config object.

You can find all the config options in our docs here: https://keystonejs.com/docs/apis/config
*/
// dotenv
import 'dotenv/config';

// config from Keystone
import { config } from '@keystone-6/core';

// Look in the schema file for how we define our lists, and how users interact with them through graphql or the Admin UI
import { lists } from './schema';

// Keystone auth is configured separately - check out the basic auth setup we are importing from our auth file.
import { withAuth, session } from './auth';

// Schemas from individual files
import { User } from './schemas/User';
import { Calendar } from './schemas/Calendar'
import { Link } from './schemas/Link'
import { Message } from './schemas/Message'
import { PbisCard } from './schemas/PbisCard'
import { PbisTeam } from './schemas/PbisTeam'
import { StudentFocus } from './schemas/StudentFocus'
import { CellPhoneViolation } from './schemas/CellPhoneViolation'
import { Callback } from './schemas/Callback'
import { Discipline } from './schemas/Discipline'
import { PbisCollection } from './schemas/PbisCollection'
import { SchoolPbisInfo } from './schemas/SchoolPbisInfo'
import { Birthday } from './schemas/Birthday'
import { BugReport } from './schemas/BugReport'
import { Bullying } from './schemas/Bullying'
import { SortingHatQuestion } from './schemas/SortingHatQuestion';
import { TrimesterAward } from './schemas/TrimesterAward';

// database URL is set in .env file
const databaseURL =  process.env.DATABASE_URL ;

// extend gql with custom mutations
import { extendGraphqlSchema } from './mutations';


export default withAuth(
  // Using the config function helps typescript guide you to the available options.
  config({
    // the db sets the database provider - we're using sqlite for the fastest startup experience
    db: {
      provider: 'postgresql',
      url: databaseURL,
    },
    // server options
    server: {
      // the port to run the server on
      port: Number(process.env.PORT) || 4000,
      cors: { origin: true, 
      credentials: true },
    },
    // This config allows us to set up features of the Admin UI https://keystonejs.com/docs/apis/config#ui
    ui: {
      // For our starter, we check that someone has session data before letting them see the Admin UI.
      isAccessAllowed: (context) => !!context.session?.data,
    },
    lists:{
      User,
      Birthday,
      BugReport,
      Bullying,
      Callback,
      Calendar,
      CellPhoneViolation,
      Discipline,
      Link,
      Message,
      PbisCard,
      PbisCollection,
      PbisTeam,
      SchoolPbisInfo,
      SortingHatQuestion,
      StudentFocus,
      TrimesterAward,

    },
    session,
    extendGraphqlSchema,
    
  })
);
