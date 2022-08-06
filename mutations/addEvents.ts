import { KeystoneContext, SessionStore } from '@keystone-next/types';
import { Session } from '../types';
import { CalendarUpdateInput } from '../.keystone/schema-types';
import { Calendar } from '../schemas/User'



const graphql = String.raw;

async function addEvents(root: any,
  { eventData }: { eventData: string },

  context: KeystoneContext
): Promise<CalendarUpdateInput> {

  // get JSON array of students and updated schedules
  console.log('Adding Events');
  const eventUpdateResults = [];
  const eventList = JSON.parse(eventData);
  console.log('eventList', eventList);
  //go through each student and update their schedule or create a new student
  await Promise.all(eventList.map(async event => {

    const createdEvent = await context.query.Calendar.createOne({
      data: {
        ...event
      },
      resolveFields: 'id'
    })

    eventUpdateResults.push(createdEvent);
  }))

  const name = JSON.stringify(eventUpdateResults);
  return { name }
}

export default addEvents;