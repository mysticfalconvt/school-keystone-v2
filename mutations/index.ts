// import { graphql } from "@keystone-6/core";
// import addToCart from './addToCart'
// import checkout from './checkout'
import recalculatePBIS from "./recalculatePBIS";
import recalculateCallback from "./recalculateCallback";
import updateStudentSchedules from "./updateStudentSchedules";
import addStaff from "./AddStaff";
import addEvents from "./addEvents";
import sendEmail from "./sendEmail";
import addBirthdays from "./addBirthdays";
import { mergeSchemas } from "@graphql-tools/schema";
import {
  GraphQLSchemaExtension,
  KeystoneGraphQLAPI,
} from "@keystone-6/core/types";
import { GraphQLSchemaExtensions } from "graphql";
// make a fake gql tagged template Literal
const graphql = String.raw;

export const extendGraphqlSchema = GraphQLSchemaExtensions({});
// schemas: [schema],
// typeDefs: graphql`
//   type Mutation {
//     recalculateCallback(callbackID: ID): User
//     recalculatePBIS(userId: ID): User
//     updateStudentSchedules(studentScheduleData: String): User
//     addStaff(staffData: String): User
//     addEvents(eventData: String): User
//     sendEmail(emailData: String): User
//     addBirthdays(birthdayData: String): Birthday
//   }
// `,
// resolvers: {
//   Mutation: {
//     recalculateCallback,
//     recalculatePBIS,
//     updateStudentSchedules,
//     addStaff,
//     addEvents,
//     sendEmail,
//     addBirthdays,
//   },
// },
