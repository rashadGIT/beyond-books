import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  GlobalSignOutCommand,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { JwksClient } from 'jwks-rsa';
import jwt from 'jsonwebtoken';

const REGION = process.env.AWS_REGION!;
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

export const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

const jwksClient = new JwksClient({
  jwksUri: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
});

export interface CognitoUser {
  sub: string;
  email: string;
  name?: string;
}

export async function signIn(email: string, password: string) {
  const command = new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: CLIENT_ID,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  });
  return cognitoClient.send(command);
}

export async function signUp(email: string, password: string, name: string) {
  const command = new SignUpCommand({
    ClientId: CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'name', Value: name },
    ],
  });
  return cognitoClient.send(command);
}

export async function confirmSignUp(email: string, code: string) {
  const command = new ConfirmSignUpCommand({
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
  });
  return cognitoClient.send(command);
}

export async function signOut(accessToken: string) {
  const command = new GlobalSignOutCommand({ AccessToken: accessToken });
  return cognitoClient.send(command);
}

export async function verifyToken(token: string): Promise<CognitoUser | null> {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded.header !== 'object') return null;

    const kid = decoded.header.kid as string;
    const key = await jwksClient.getSigningKey(kid);
    const signingKey = key.getPublicKey();

    const verified = jwt.verify(token, signingKey, {
      algorithms: ['RS256'],
      issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
    }) as jwt.JwtPayload;

    return {
      sub: verified.sub as string,
      email: verified.email as string,
      name: verified.name as string | undefined,
    };
  } catch {
    return null;
  }
}

export async function getUserFromAccessToken(accessToken: string): Promise<CognitoUser | null> {
  try {
    const command = new GetUserCommand({ AccessToken: accessToken });
    const result = await cognitoClient.send(command);

    const sub = result.UserAttributes?.find(a => a.Name === 'sub')?.Value;
    const email = result.UserAttributes?.find(a => a.Name === 'email')?.Value;
    const name = result.UserAttributes?.find(a => a.Name === 'name')?.Value;

    if (!sub || !email) return null;
    return { sub, email, name };
  } catch {
    return null;
  }
}
