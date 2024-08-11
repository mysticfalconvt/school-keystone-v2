import { graphql } from "@keystone-6/core";

const gql = String.raw;

type StaffMemberData = {
  email: string;
  name: string;
  hasta: boolean;
  hasclasses: boolean;
  isteacher: boolean;
};

type StaffMemberUpdate = {
  email?: string;
  name?: string;
  hasTa?: boolean;
  hasClasses?: boolean;
  isTeacher?: boolean;
  existed?: boolean;
  isStudent?: boolean;
  password?: string;
  canManageCalendar?: boolean;
  canSeeOtherUsers?: boolean;
  canManageUsers?: boolean;
  canManageRoles?: boolean;
  canManageLinks?: boolean;
  canManageDiscipline?: boolean;
  canSeeAllDiscipline?: boolean;
  canSeeAllTeacherEvents?: boolean;
  canSeeStudentEvents?: boolean;
  canSeeOwnCallback?: boolean;
  canSeeAllCallback?: boolean;
  hasTA?: boolean;
  isStaff?: boolean;
};

export const addStaff = (base: any) =>
  graphql.field({
    type: graphql.String,
    args: {
      staffData: graphql.arg({ type: graphql.JSON }),
    },
    resolve: async (source, args, context) => {
      // get JSON array of students and updated schedules
      console.log("Adding Staff");
      const allStaffUpdateResults: StaffMemberUpdate[] = [];
      if (!args.staffData || typeof args.staffData === "string") return null;
      const staffDataList = args.staffData as StaffMemberData[];
      //go through each student and update their schedule or create a new student
      await Promise.all(
        staffDataList.map(async (staffMember) => {
          const studentUpdateResults: StaffMemberUpdate = {};
          const studentInfo = await context.query.User.findMany({
            where: { email: { equals: staffMember.email.toLowerCase() } },
            query: gql`
              id
              email
              name
          `,
          });

          studentUpdateResults.email = staffMember.email.toLowerCase();

          //if user is new create new user
          if (!studentInfo[0]?.id) {
            console.log(`Creating new user ${staffMember.email}`);
            //get name as a string from email separated by .
            const nameArray = staffMember.email.split("@")[0].split(".");
            //join the names together
            studentUpdateResults.name = nameArray.join(" ");
            studentUpdateResults.isStudent = false;

            studentUpdateResults.canManageCalendar = true;
            studentUpdateResults.canSeeOtherUsers = true;
            studentUpdateResults.canManageUsers = true;
            studentUpdateResults.canManageRoles = true;
            studentUpdateResults.canManageLinks = true;
            studentUpdateResults.canManageDiscipline = false;
            studentUpdateResults.canSeeAllDiscipline = false;
            studentUpdateResults.canSeeAllTeacherEvents = true;
            studentUpdateResults.canSeeStudentEvents = false;
            studentUpdateResults.canSeeOwnCallback = true;
            studentUpdateResults.canSeeAllCallback = true;
            studentUpdateResults.hasTA = staffMember.hasta ? true : false;
            studentUpdateResults.hasClasses = staffMember.hasclasses
              ? true
              : false;
            studentUpdateResults.isStaff = true;
            studentUpdateResults.isTeacher = staffMember.isteacher
              ? true
              : false;

            studentUpdateResults.password = "notPassword";
            const createdStudent = await context.query.User.createOne({
              data: {
                ...studentUpdateResults,
              },
            });
          }

          //if user exists update their schedule
          // if (studentInfo[0]?.id) {
          //   console.log(`Updating user ${student.email}`);
          //   const updatedStudent = await context.lists.User.updateOne({
          //     id: studentInfo[0].id,
          //     data: {
          //       ...studentUpdateResults
          //     }
          //   });
          // }
          // save if student is new or updated and add data to array
          studentUpdateResults.existed = !!studentInfo[0];
          allStaffUpdateResults.push(studentUpdateResults);
        })
      );

      const name = JSON.stringify(allStaffUpdateResults);
      return name;
    },
  });
