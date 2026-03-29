// Note: awsClients creates singleton instances at module load time,
// so we must use jest.resetModules() + require() inside each test to pick up
// the correct env vars.  We re-mock the AWS clients after every module reset.

describe('awsClients — credential inclusion', () => {
  const originalEnv = process.env;
  let mockS3Send: jest.Mock;
  let mockSESSend: jest.Mock;
  let S3ClientMock: jest.Mock;
  let SESClientMock: jest.Mock;

  function setupMocks() {
    mockS3Send = jest.fn().mockResolvedValue({});
    mockSESSend = jest.fn().mockResolvedValue({});
    S3ClientMock = jest.fn().mockImplementation(() => ({ send: mockS3Send }));
    SESClientMock = jest.fn().mockImplementation(() => ({ send: mockSESSend }));

    jest.mock('@aws-sdk/client-s3', () => ({
      S3Client: S3ClientMock,
      PutObjectCommand: jest.fn(),
      GetObjectCommand: jest.fn(),
    }));

    jest.mock('@aws-sdk/client-ses', () => ({
      SESClient: SESClientMock,
      SendEmailCommand: jest.fn(),
    }));
  }

  beforeEach(() => {
    jest.resetModules();
    setupMocks();
    process.env.AWS_REGION = 'us-east-1';
    delete process.env.BB_SES_KEY_ID;
    delete process.env.BB_SES_SECRET;
  });

  afterEach(() => {
    // Restore only the vars we touched
    if (originalEnv.BB_SES_KEY_ID !== undefined) process.env.BB_SES_KEY_ID = originalEnv.BB_SES_KEY_ID;
    else delete process.env.BB_SES_KEY_ID;
    if (originalEnv.BB_SES_SECRET !== undefined) process.env.BB_SES_SECRET = originalEnv.BB_SES_SECRET;
    else delete process.env.BB_SES_SECRET;
    if (originalEnv.AWS_REGION !== undefined) process.env.AWS_REGION = originalEnv.AWS_REGION;
    else delete process.env.AWS_REGION;
  });

  it('getS3Client includes explicit credentials when BB_SES_KEY_ID and BB_SES_SECRET are set', () => {
    process.env.BB_SES_KEY_ID = 'AKIATEST123';
    process.env.BB_SES_SECRET = 'secretKeyTest';
    process.env.AWS_REGION = 'us-west-2';

    const { getS3Client } = require('../awsClients');
    getS3Client();

    expect(S3ClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'us-west-2',
        credentials: {
          accessKeyId: 'AKIATEST123',
          secretAccessKey: 'secretKeyTest',
        },
      })
    );
  });

  it('getS3Client does not include credentials when env vars are not set', () => {
    const { getS3Client } = require('../awsClients');
    getS3Client();

    const callArg = S3ClientMock.mock.calls[S3ClientMock.mock.calls.length - 1][0];
    expect(callArg).not.toHaveProperty('credentials');
  });

  it('getSESClient includes explicit credentials when BB_SES_KEY_ID and BB_SES_SECRET are set', () => {
    process.env.BB_SES_KEY_ID = 'AKIATEST456';
    process.env.BB_SES_SECRET = 'anotherSecret';
    process.env.AWS_REGION = 'eu-west-1';

    const { getSESClient } = require('../awsClients');
    getSESClient();

    expect(SESClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'eu-west-1',
        credentials: {
          accessKeyId: 'AKIATEST456',
          secretAccessKey: 'anotherSecret',
        },
      })
    );
  });

  it('getSESClient does not include credentials when env vars are not set', () => {
    const { getSESClient } = require('../awsClients');
    getSESClient();

    const callArg = SESClientMock.mock.calls[SESClientMock.mock.calls.length - 1][0];
    expect(callArg).not.toHaveProperty('credentials');
  });

  it('defaults to us-east-1 region when AWS_REGION is not set', () => {
    delete process.env.AWS_REGION;

    const { getS3Client } = require('../awsClients');
    getS3Client();

    const callArg = S3ClientMock.mock.calls[S3ClientMock.mock.calls.length - 1][0];
    expect(callArg.region).toBe('us-east-1');
  });

  it('uses provided AWS_REGION for both S3 and SES clients', () => {
    process.env.AWS_REGION = 'ap-southeast-1';

    const { getS3Client, getSESClient } = require('../awsClients');
    getS3Client();
    getSESClient();

    const s3Arg = S3ClientMock.mock.calls[S3ClientMock.mock.calls.length - 1][0];
    const sesArg = SESClientMock.mock.calls[SESClientMock.mock.calls.length - 1][0];
    expect(s3Arg.region).toBe('ap-southeast-1');
    expect(sesArg.region).toBe('ap-southeast-1');
  });
});
