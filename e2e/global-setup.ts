import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

export default async function globalSetup() {
  const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
  });

  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  if (!userPoolId) {
    console.warn('COGNITO_USER_POOL_ID not set — skipping E2E user setup');
    return;
  }

  const username = 'e2e@beyondbooks.test';
  const password = 'E2eTestPass1!';

  // Check if user already exists
  try {
    await client.send(
      new AdminGetUserCommand({ UserPoolId: userPoolId, Username: username }),
    );
    console.log('E2E test user already exists');
    return;
  } catch (e: any) {
    if (e.name !== 'UserNotFoundException') throw e;
  }

  // Create and confirm user
  await client.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: username,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: username },
        { Name: 'email_verified', Value: 'true' },
      ],
    }),
  );

  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: username,
      Password: password,
      Permanent: true,
    }),
  );

  console.log('E2E test user created:', username);
}
