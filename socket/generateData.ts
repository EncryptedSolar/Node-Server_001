import * as fs from "fs"
import { faker } from '@faker-js/faker';

let GigaPayload: any[] = []
let tags = ['free', 'basic', 'business', 'enterprise', 'rich', 'super-rich', 'mega-rich', 'empire'];

export function createMessage(): any {
  return {
    appLogLocId: faker.string.uuid(),
    appData: {
      msgId: faker.string.uuid(),
      msgLogDateTime: faker.date.past(),
      msgDateTime: faker.date.past(),
      msgTag: faker.helpers.arrayElements(tags, 3),
      msgPayload: {
        header: {
          messageType: "Command",
          messageID: faker.string.uuid(),
          messageName: faker.word.adjective(),
          dateCreated: faker.date.recent(),
          isAggregated: faker.datatype.boolean(),
          servicecId: faker.string.uuid(),
          userId: faker.string.uuid(),
          requesterId: faker.string.uuid(),
          messagePreoducerInformation: {
            origin: {
              userApplication: {
                userAppId: faker.finance.accountName(),
                userAppName: faker.person.jobTitle()
              }
            },
            components: faker.word.adverb()
          },
          security: {
            ucpid: faker.string.uuid()
          },
          messageDataLocation: {
            isEmbaded: faker.datatype.boolean()
          },
          messageDataFormat: {
            dataFormate: faker.date.anytime()
          },
          requestExecutiomNode: faker.number.int(),
          requestTimeOut: faker.number.int(),
          command: faker.word.adjective()
        },
      }
    }
  }
}



Array.from({ length: 1000 }).forEach(() => {
  GigaPayload.push(createMessage());
});


fs.writeFileSync('payload.json', JSON.stringify(GigaPayload))
