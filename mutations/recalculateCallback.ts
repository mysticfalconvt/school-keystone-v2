import { KeystoneContext, SessionStore } from '@keystone-6/core/types';
import { Session } from '../types';
import { UserUpdateInput, PbisTeamUpdateInput } from '../.keystone/schema-types';
import { User } from '../schemas/User'
import { Callback } from '../schemas/Callback';



const graphql = String.raw;

async function recalculateCallback(root: any,
  { callbackID }: { callbackID: string },

  context: KeystoneContext
): Promise<UserUpdateInput> {
  // console.log('Updating Callback Count');
  // console.log(`callback: ${callbackID}`)
  const callback = await context.query.Callback.findOne({
    where: { id: callbackID }, 
    query: graphql`
  id
  teacher{
    id
  }
  student{
    id
  }
  `})
  // console.log(callback)
  const studentId = callback.student.id
  const teacherId = callback.teacher.id
  // const taTeacherId = callback.student.taTeacher.id

  //get student callback totals
  const student = await context.query.User.findOne({
    where: { id: studentId },
    query: graphql`
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
  function getAvg(grades : any) {
    const total = grades.reduce((acc: number, c: number) => acc + c, 0);
    return total / grades.length;
  }
  const completedCallbacks = student.callbackItems
  const listOfDaysLate = completedCallbacks.map((item) => item.daysLate)
  const averageTimeToComplete = Math.round(getAvg(listOfDaysLate) || 0)
  // console.log(averageTimeToComplete)


  //get teacher callback totals
  const teacher = await context.query.User.findOne({
    where: { id: teacherId },
    query: graphql`
            id
             callbackTotal: callbackAssignedCount
             callbackToDo: callbackAssignedCount(where:{dateCompleted:null})
          
        `,
  });
  // console.log(teacher)

  const updateStudentCallbacks = await context.query.User.updateOne({
    where: {id: studentId},
    data: {
      callbackCount: student.callbackToDo,
      totalCallbackCount: student.callbackTotal,
      averageTimeToCompleteCallback: Math.floor(averageTimeToComplete),
    },
  });
  const updateTeacherCallbacks = await context.query.User.updateOne({
    where: {id: teacherId},
    data: {
      callbackCount: teacher.callbackToDo,
      totalCallbackCount: teacher.callbackTotal
    },
  });


}

export default recalculateCallback;