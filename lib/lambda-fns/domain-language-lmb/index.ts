import { Context, EventBridgeEvent } from 'aws-lambda';
import { ComprehendClient, DetectDominantLanguageCommand,
    DetectDominantLanguageCommandInput,
    DetectDominantLanguageCommandOutput} from '@aws-sdk/client-comprehend';

const client = new ComprehendClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

export const handler = async(
    event: EventBridgeEvent<'text', {text:string}>,
    context: Context) => {

    console.log(event);

    const { text } = event.detail;
    let result = {};

    try {
        const params:DetectDominantLanguageCommandInput 
            = { Text: text };
        const command = new DetectDominantLanguageCommand(params);
        const data:DetectDominantLanguageCommandOutput 
            = await client.send(command);
        
        result = {
            message: text,
            language: data.Languages
        }
        console.log(result);
    } catch(err) {
        console.log(err);
    }

    return result;
}
