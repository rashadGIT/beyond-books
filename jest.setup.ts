import '@testing-library/jest-dom';
import { mockReset } from 'jest-mock-extended';
import { prisma } from './__mocks__/prisma';

// Reset Prisma mock state before every test to prevent cross-test pollution
beforeEach(() => {
  mockReset(prisma);
});

// ─── External SDK mocks ────────────────────────────────────────────────────

jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'mock response' }],
        stop_reason: 'end_turn',
      }),
    },
  })),
}));

jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'mock response', tool_calls: undefined } }],
        }),
      },
    },
  })),
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      startChat: jest.fn().mockReturnValue({
        sendMessage: jest.fn().mockResolvedValue({
          response: {
            candidates: [{ content: { parts: [{ text: 'mock response' }] } }],
          },
        }),
      }),
    }),
  })),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  SendEmailCommand: jest.fn(),
}));

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
  AdminCreateUserCommand: jest.fn(),
  AdminSetUserPasswordCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-presigned-url.s3.amazonaws.com/test.pdf'),
}));

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ error: null }),
    },
  })),
}));

jest.mock('puppeteer-core', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf')),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('@sparticuz/chromium-min', () => ({
  default: {
    args: ['--no-sandbox'],
    executablePath: jest.fn().mockResolvedValue('/usr/bin/chromium'),
  },
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue({ stop: jest.fn() }),
  validate: jest.fn().mockReturnValue(true),
}));

jest.mock('jwks-rsa', () => ({
  default: jest.fn().mockReturnValue({
    getSigningKey: jest.fn().mockImplementation((_kid, cb) => {
      cb(null, { getPublicKey: () => 'mock-public-key' });
    }),
  }),
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ sub: 'test-user-id', email: 'test@example.com', name: 'Test User' }),
  decode: jest.fn().mockReturnValue({ sub: 'test-user-id', email: 'test@example.com' }),
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
}));

// ─── Global fetch mock ─────────────────────────────────────────────────────
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: jest.fn().mockResolvedValue({}),
  text: jest.fn().mockResolvedValue(''),
});
