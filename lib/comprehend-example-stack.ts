import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Integration, IntegrationOptions, IntegrationType, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { EventBus, IEventBus, Rule } from 'aws-cdk-lib/aws-events';
import { SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';
import { PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Code, Function, IFunction, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { StateMachine, Wait, WaitTime } from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { Action, PolicyStatementFactory } from 'iam-policy-generator';
import { Effect } from 'iam-policy-generator/lib/PolicyFactory';
import { join } from 'path';

export class ComprehendExampleStack extends Stack {

  domainLanguageLambda: IFunction;
  eventBus: IEventBus;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const awsSDKV3Layer = new LayerVersion(this, 'AWSSDKV3', {
      code: Code.fromAsset(join(__dirname, './layer')),
      compatibleRuntimes: [Runtime.NODEJS_14_X]
    });

    const domainLanguageStatement = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: ['*'],
      actions: [
        'comprehend:DetectDominantLanguage'
      ]
    });

    // const domainLanguageStatement = new PolicyStatementFactory()
    //   .setEffect(Effect.ALLOW)
    //   .addResource('*')
    //   .addAction(Action.COMPREHEND.DETECT_DOMINANT_LANGUAGE)
    //   .build();

    this.domainLanguageLambda = new Function(this, 'MyDomainLanguageLambda', {
      //entry: join(__dirname, './lambda-fns/domain-language-lmb/index.ts'),
      code: Code.fromAsset('lib/lambda-fns/domain-language-lmb'),
      handler: 'index.handler',
      runtime: Runtime.NODEJS_14_X,
      layers: [awsSDKV3Layer]
      // bundling: {
      //   minify: true
      // }
    });
    this.domainLanguageLambda.addToRolePolicy(domainLanguageStatement);

    const waitTask = new Wait(this, 'WaitUntil', {
      time: WaitTime.duration(Duration.seconds(10))//.timestampPath('$.detail.at')
    });
    const lambdaTask = new LambdaInvoke(this, 'LambdaInvoke', {
      lambdaFunction: this.domainLanguageLambda,
      outputPath: '$.Payload'
    });

    const stateMachine = new StateMachine(this, 'TextStateMachine', {
      definition: waitTask.next(lambdaTask)
    });

    this.eventBus = new EventBus(this, 'TextEventBus', { 
      eventBusName: 'TextEventBus' 
    });
    new Rule(this, 'LambdaProcessorRule', {
      eventBus: this.eventBus,
      eventPattern: {source:['apigateway'], detailType:['text']},
      targets: [
        new SfnStateMachine(stateMachine)
      ]
    });
    const apigwEventBusRole = new Role(this, 'ApiGatewayEventBusRole', {
      assumedBy: new ServicePrincipal('apigateway'),
      inlinePolicies: {
        putEvents: new PolicyDocument({
          statements: [new PolicyStatement({
            actions: ['events:PutEvents'],
            resources: [this.eventBus.eventBusArn]
          })]
        })
      }
    });

    const options:IntegrationOptions = {
      credentialsRole: apigwEventBusRole,
      requestParameters: {
        "integration.request.header.X-Amz-Target": "'AWSEvents.PutEvents'",
        "integration.request.header.Content-Type": "'application/x-amz-json-1.1'"
      },
      requestTemplates: {
        "application/json": `{"Entries": [
          {"Source": "apigateway", 
          "Detail": "$util.escapeJavaScript($input.body)", 
          "DetailType": "text", 
          "EventBusName": "${this.eventBus.eventBusName}"}]}`
      },
      integrationResponses: [{
        statusCode: "200",
        responseTemplates: {"application/json": ""}
      },
      {
        statusCode: "400",
        responseTemplates: {"application/json": JSON.stringify(
          { state: 'error', message: "$util.escapeJavaScript($input.path('$.errorMessage'))" })}
      }]
    };
    const gw = new RestApi(this, 'TextApiGateway', {deployOptions: {stageName: 'dev'}});
    gw.root.addMethod('POST', new Integration({
        type: IntegrationType.AWS,
        uri: 'arn:aws:apigateway:us-east-1:events:path//',
        integrationHttpMethod: 'POST',
        options:options
      }),
      {
        methodResponses: [{statusCode: "200"}, {statusCode: "400"}]
      }
    );
  }
}
