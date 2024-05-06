import { graphql } from "@keystone-6/core";

const gql = String.raw;

export const recalculateCallback = (base: any) =>
  graphql.field({
    type: base.object("Callback"),
    args: {
      callbackId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    },
    resolve: async (source, args, context) => {
      const callbackID = args.callbackId;
      const callback = await context.query.Callback.findOne({
        where: { id: callbackID },
        query: gql`
      id
      teacher{
        id
      }
      student{
        id
      }
      `,
      });
      console.log(callback);
      const studentId = callback.student.id;
      const teacherId = callback.teacher.id;
      // const taTeacherId = callback.student.taTeacher.id

      //get student callback totals
      const student = await context.query.User.findOne({
        where: { id: studentId },
        query: gql`
                id
                 callbackTotal: callbackItemsCount
                 callbackToDo: callbackItemsCount(where:{dateCompleted:null})
                callbackItems(where: {NOT: {daysLate: null}}){
                  daysLate
                }
              
            `,
      });
      //get average days late for callback items
      // console.log(student)
      function getAvg(grades: any) {
        const total = grades.reduce((acc: number, c: number) => acc + c, 0);
        return total / grades.length;
      }
      const completedCallbacks = student.callbackItems;
      const listOfDaysLate = completedCallbacks.map(
        (item: any) => item.daysLate
      );
      const averageTimeToComplete = Math.round(getAvg(listOfDaysLate) || 0);
      // console.log(averageTimeToComplete)

      //get teacher callback totals
      const teacher = await context.query.User.findOne({
        where: { id: teacherId },
        query: gql`
                id
                 callbackTotal: callbackAssignedCount
                 callbackToDo: callbackAssignedCount(where:{dateCompleted:null})
              
            `,
      });
      // console.log(teacher)

      const updateStudentCallbacks = await context.query.User.updateOne({
        where: { id: studentId },
        data: {
          callbackCount: student.callbackToDo,
          totalCallbackCount: student.callbackTotal,
          averageTimeToCompleteCallback: Math.floor(averageTimeToComplete),
        },
      });
      const updateTeacherCallbacks = await context.query.User.updateOne({
        where: { id: teacherId },
        data: {
          callbackCount: teacher.callbackToDo,
          totalCallbackCount: teacher.callbackTotal,
        },
      });
      console.log(updateStudentCallbacks);
      console.log(updateTeacherCallbacks);

      return updateStudentCallbacks;
    },
  });

// resolve: async (source, args, context) => {
//   const callbackID = args.callbackId;
//   const callback = await context.query.Callback.findOne({
//     where: { id: callbackID },
//     query: gql`
//   id
//   teacher{
//     id
//   }
//   student{
//     id
//   }
//   `,
//   });
//   console.log("callback", callback);
//   const studentId = callback?.student?.id;
//   const teacherId = callback?.teacher?.id;
//   // const taTeacherId = callback.student.taTeacher.id
//   if (studentId || teacherId) return callbackID;
//   //get student callback totals
//   const student = await context.query.User.findOne({
//     where: { id: studentId },
//     query: gql`
//             id
//              callbackTotal: callbackItemsCount
//              callbackToDo: callbackItemsCount(where:{dateCompleted:null})
//             callbackItems(where: {NOT: {daysLate: null}}){
//               daysLate
//             }

//         `,
//   });
//   //get average days late for callback items
//   // console.log(student)
//   function getAvg(grades: any) {
//     const total = grades.reduce((acc: number, c: number) => acc + c, 0);
//     return total / grades.length;
//   }
//   const completedCallbacks = student.callbackItems;
//   const listOfDaysLate = completedCallbacks.map(
//     (item: any) => item.daysLate
//   );
//   const averageTimeToComplete = Math.round(getAvg(listOfDaysLate) || 0);
//   // console.log(averageTimeToComplete)

//   //get teacher callback totals
//   const teacher = await context.query.User.findOne({
//     where: { id: teacherId },
//     query: gql`
//             id
//              callbackTotal: callbackAssignedCount
//              callbackToDo: callbackAssignedCount(where:{dateCompleted:null})

//         `,
//   });
//   // console.log(teacher)

//   const updateStudentCallbacks = await context.query.User.updateOne({
//     where: { id: studentId },
//     data: {
//       callbackCount: student.callbackToDo,
//       totalCallbackCount: student.callbackTotal,
//       averageTimeToCompleteCallback: Math.floor(averageTimeToComplete),
//     },
//   });
//   const updateTeacherCallbacks = await context.query.User.updateOne({
//     where: { id: teacherId },
//     data: {
//       callbackCount: teacher.callbackToDo,
//       totalCallbackCount: teacher.callbackTotal,
//     },
//   });

//   return callback;
