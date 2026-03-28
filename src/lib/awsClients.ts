import { S3Client } from '@aws-sdk/client-s3';
import { SESClient } from '@aws-sdk/client-ses';

const credentials = process.env.BB_AWS_KEY_ID && process.env.BB_AWS_SECRET_KEY
  ? { credentials: { accessKeyId: process.env.BB_AWS_KEY_ID, secretAccessKey: process.env.BB_AWS_SECRET_KEY } }
  : {};

export const s3Client = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1', ...credentials });
export const sesClient = new SESClient({ region: process.env.AWS_REGION ?? 'us-east-1', ...credentials });
