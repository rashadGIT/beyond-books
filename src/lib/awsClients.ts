import { S3Client } from '@aws-sdk/client-s3';
import { SESClient } from '@aws-sdk/client-ses';

function getCredentials() {
  const keyId = process.env.BB_AWS_KEY_ID;
  const secretKey = process.env.BB_AWS_SECRET_KEY;
  return keyId && secretKey
    ? { credentials: { accessKeyId: keyId, secretAccessKey: secretKey } }
    : {};
}

export function getS3Client() {
  return new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1', ...getCredentials() });
}

export function getSESClient() {
  return new SESClient({ region: process.env.AWS_REGION ?? 'us-east-1', ...getCredentials() });
}

// Singleton exports for backwards compat — created at first import (runtime)
export const s3Client = getS3Client();
export const sesClient = getSESClient();
