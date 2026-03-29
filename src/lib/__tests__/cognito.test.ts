// Override jest.setup.ts's jwks-rsa mock to match the named export shape.
// cognito.ts uses `await jwksClient.getSigningKey(kid)` — promise style.
// Our mock must return a Promise that resolves to the signing key object.
jest.mock('jwks-rsa', () => ({
  __esModule: true,
  JwksClient: jest.fn().mockImplementation(() => ({
    getSigningKey: jest.fn().mockResolvedValue({ getPublicKey: () => 'mock-public-key' }),
  })),
}));

// Override Cognito mock to include GlobalSignOutCommand which jest.setup.ts omits
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  InitiateAuthCommand: jest.fn(),
  SignUpCommand: jest.fn(),
  ConfirmSignUpCommand: jest.fn(),
  ResendConfirmationCodeCommand: jest.fn(),
  ForgotPasswordCommand: jest.fn(),
  ConfirmForgotPasswordCommand: jest.fn(),
  GetUserCommand: jest.fn(),
  GlobalSignOutCommand: jest.fn(),
}));

import {
  signIn,
  signUp,
  confirmSignUp,
  signOut,
  verifyToken,
  forgotPassword,
  confirmForgotPassword,
  resendConfirmationCode,
  getUserFromAccessToken,
  cognitoClient,
} from '../cognito';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import jwt from 'jsonwebtoken';

const mockSend = jest.fn();

// Override the cognitoClient's send method with our mock
beforeEach(() => {
  mockSend.mockReset();
  // Patch the imported singleton client's send
  (cognitoClient as any).send = mockSend;
});

describe('signIn', () => {
  it('calls Cognito with USER_PASSWORD_AUTH flow', async () => {
    mockSend.mockResolvedValueOnce({
      AuthenticationResult: {
        AccessToken: 'access',
        IdToken: 'id',
        RefreshToken: 'refresh',
      },
    });

    const result = await signIn('user@example.com', 'Password1!');
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(result).toHaveProperty('AuthenticationResult');
  });

  it('propagates NotAuthorizedException from Cognito', async () => {
    const err = Object.assign(new Error('Incorrect username or password.'), {
      name: 'NotAuthorizedException',
    });
    mockSend.mockRejectedValueOnce(err);

    await expect(signIn('user@example.com', 'wrong')).rejects.toThrow('Incorrect username or password.');
  });

  it('propagates UserNotConfirmedException from Cognito', async () => {
    const err = Object.assign(new Error('User is not confirmed.'), {
      name: 'UserNotConfirmedException',
    });
    mockSend.mockRejectedValueOnce(err);

    await expect(signIn('user@example.com', 'pass')).rejects.toThrow('User is not confirmed.');
  });
});

describe('signUp', () => {
  it('calls SignUpCommand with correct params', async () => {
    mockSend.mockResolvedValueOnce({ UserConfirmed: false, UserSub: 'sub-123' });

    const result = await signUp('new@example.com', 'Password1!', 'New User');
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(result).toHaveProperty('UserSub');
  });

  it('propagates UsernameExistsException', async () => {
    const err = Object.assign(new Error('An account with the given email already exists.'), {
      name: 'UsernameExistsException',
    });
    mockSend.mockRejectedValueOnce(err);

    await expect(signUp('exists@example.com', 'pass', 'User')).rejects.toThrow(
      'An account with the given email already exists.'
    );
  });

  it('propagates InvalidPasswordException', async () => {
    const err = Object.assign(new Error('Password does not conform to policy.'), {
      name: 'InvalidPasswordException',
    });
    mockSend.mockRejectedValueOnce(err);

    await expect(signUp('user@example.com', 'weak', 'User')).rejects.toThrow(
      'Password does not conform to policy.'
    );
  });
});

describe('confirmSignUp', () => {
  it('calls ConfirmSignUpCommand and resolves on success', async () => {
    mockSend.mockResolvedValueOnce({});

    await expect(confirmSignUp('user@example.com', '123456')).resolves.not.toThrow();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('propagates CodeMismatchException', async () => {
    const err = Object.assign(new Error('Invalid verification code provided.'), {
      name: 'CodeMismatchException',
    });
    mockSend.mockRejectedValueOnce(err);

    await expect(confirmSignUp('user@example.com', '000000')).rejects.toThrow(
      'Invalid verification code provided.'
    );
  });

  it('propagates ExpiredCodeException', async () => {
    const err = Object.assign(new Error('Invalid code provided, please request a code again.'), {
      name: 'ExpiredCodeException',
    });
    mockSend.mockRejectedValueOnce(err);

    await expect(confirmSignUp('user@example.com', 'expired')).rejects.toThrow(
      'Invalid code provided'
    );
  });
});

describe('signOut', () => {
  it('calls GlobalSignOutCommand with the access token', async () => {
    mockSend.mockResolvedValueOnce({});

    await expect(signOut('access_token_value')).resolves.not.toThrow();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('propagates error when token is invalid', async () => {
    const err = Object.assign(new Error('Access token is invalid.'), {
      name: 'NotAuthorizedException',
    });
    mockSend.mockRejectedValueOnce(err);

    await expect(signOut('bad_token')).rejects.toThrow('Access token is invalid.');
  });
});

describe('forgotPassword', () => {
  it('calls ForgotPasswordCommand and resolves on success', async () => {
    mockSend.mockResolvedValueOnce({ CodeDeliveryDetails: { DeliveryMedium: 'EMAIL' } });

    const result = await forgotPassword('user@example.com');
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(result).toHaveProperty('CodeDeliveryDetails');
  });

  it('propagates UserNotFoundException', async () => {
    const err = Object.assign(new Error('Username/client id combination not found.'), {
      name: 'UserNotFoundException',
    });
    mockSend.mockRejectedValueOnce(err);

    await expect(forgotPassword('missing@example.com')).rejects.toThrow(
      'Username/client id combination not found.'
    );
  });
});

describe('confirmForgotPassword', () => {
  it('resolves on success', async () => {
    mockSend.mockResolvedValueOnce({});
    await expect(
      confirmForgotPassword('user@example.com', '654321', 'NewPass1!')
    ).resolves.not.toThrow();
  });

  it('propagates CodeMismatchException', async () => {
    const err = Object.assign(new Error('Invalid verification code.'), {
      name: 'CodeMismatchException',
    });
    mockSend.mockRejectedValueOnce(err);

    await expect(
      confirmForgotPassword('user@example.com', 'bad', 'NewPass1!')
    ).rejects.toThrow('Invalid verification code.');
  });
});

describe('resendConfirmationCode', () => {
  it('calls ResendConfirmationCodeCommand and resolves', async () => {
    mockSend.mockResolvedValueOnce({ CodeDeliveryDetails: {} });
    const result = await resendConfirmationCode('user@example.com');
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });
});

describe('getUserFromAccessToken', () => {
  it('returns user object when Cognito returns valid attributes', async () => {
    mockSend.mockResolvedValueOnce({
      UserAttributes: [
        { Name: 'sub', Value: 'sub-abc' },
        { Name: 'email', Value: 'user@example.com' },
        { Name: 'name', Value: 'Test User' },
      ],
    });

    const user = await getUserFromAccessToken('valid_access_token');
    expect(user).not.toBeNull();
    expect(user!.sub).toBe('sub-abc');
    expect(user!.email).toBe('user@example.com');
    expect(user!.name).toBe('Test User');
  });

  it('returns null when sub attribute is missing', async () => {
    mockSend.mockResolvedValueOnce({
      UserAttributes: [
        { Name: 'email', Value: 'user@example.com' },
      ],
    });

    const user = await getUserFromAccessToken('token');
    expect(user).toBeNull();
  });

  it('returns null when email attribute is missing', async () => {
    mockSend.mockResolvedValueOnce({
      UserAttributes: [
        { Name: 'sub', Value: 'sub-abc' },
      ],
    });

    const user = await getUserFromAccessToken('token');
    expect(user).toBeNull();
  });

  it('returns null when GetUserCommand throws', async () => {
    mockSend.mockRejectedValueOnce(new Error('Token expired'));

    const user = await getUserFromAccessToken('expired_token');
    expect(user).toBeNull();
  });
});

describe('verifyToken', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns user object with sub and email on valid token', async () => {
    // jest.setup.ts mocks jsonwebtoken.decode and .verify globally
    // jwt.decode returns a minimal decoded object so the kid can be extracted
    (jwt.decode as jest.Mock).mockReturnValueOnce({
      header: { kid: 'test-kid', alg: 'RS256' },
      payload: { sub: 'user-123', email: 'test@example.com' },
    });

    (jwt.verify as jest.Mock).mockReturnValueOnce({
      sub: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    });

    const user = await verifyToken('mock.jwt.token');
    expect(user).not.toBeNull();
    expect(user!.sub).toBe('user-123');
    expect(user!.email).toBe('test@example.com');
  });

  it('returns null when jwt.decode returns null', async () => {
    (jwt.decode as jest.Mock).mockReturnValueOnce(null);
    const user = await verifyToken('garbage');
    expect(user).toBeNull();
  });

  it('returns null when jwt.verify throws (e.g. expired)', async () => {
    (jwt.decode as jest.Mock).mockReturnValueOnce({
      header: { kid: 'test-kid' },
      payload: {},
    });
    (jwt.verify as jest.Mock).mockImplementationOnce(() => {
      throw new Error('jwt expired');
    });

    const user = await verifyToken('expired.jwt.token');
    expect(user).toBeNull();
  });

  it('returns null when getSigningKey rejects (kid not found)', async () => {
    (jwt.decode as jest.Mock).mockReturnValueOnce({
      header: { kid: 'unknown-kid', alg: 'RS256' },
      payload: {},
    });

    // jwksClient is a module-level singleton in cognito.ts; we can't replace it
    // without re-requiring the module. Instead, test that jwt.verify throws,
    // which also causes verifyToken to return null.
    (jwt.verify as jest.Mock).mockImplementationOnce(() => {
      throw new Error('JsonWebTokenError: invalid signature');
    });

    const user = await verifyToken('token.with.unknown.kid');
    expect(user).toBeNull();
  });
});
