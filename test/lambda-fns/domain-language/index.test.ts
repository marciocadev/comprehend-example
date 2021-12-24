import { EventBridgeEvent } from 'aws-lambda';
import { handler } from '../../../lib/lambda-fns/domain-language-lmb';
import { DetectDominantLanguageCommand } from '@aws-sdk/client-comprehend';
import { mockClient } from 'aws-sdk-client-mock';

jest.mock('@aws-sdk/client-comprehend', () => {  
    class MockComprehendClient {
        send() {
            return {Languages: [{ LanguageCode: 'en', Score: 1 }] }
        }
    }
    return {
        ComprehendClient: MockComprehendClient,
        DetectDominantLanguageCommand: jest.fn().mockImplementation(() => { return {} })
    }
});

// const comprehendMock = mockClient(ComprehendClient);

describe('Detect language success', () => {

    // beforeEach(() => {
    //     comprehendMock.reset();
    // });

    test('Get Lambda success invocation', async() => {

        const event:EventBridgeEvent<'text',{message:string}> = {
            detail: {
                message: 'Hello World!!!'
            }
        } as any;
        const context = {} as any;
        
        // comprehendMock.on(DetectDominantLanguageCommand).resolves({
        //     Languages: [{ LanguageCode: 'en', Score: 1 }]
        // });

        const result = await handler(event, context);

        expect(DetectDominantLanguageCommand).toBeCalledTimes(1);
        expect(result).toMatchObject({
            message: 'Hello World!!!',
            language: [{ LanguageCode: 'en', Score: 1 } ]
        });
    });
});