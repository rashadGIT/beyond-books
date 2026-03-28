import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfkit'],
  // Expose server-side env vars at build time so they're available in
  // Amplify Gen 1 SSR Lambda (which doesn't pass Console env vars to runtime).
  // Next.js inlines these via webpack DefinePlugin into the server bundle.
  env: {
    DATABASE_URL: process.env.DATABASE_URL ?? '',
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID ?? '',
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID ?? '',
    COGNITO_DOMAIN: process.env.COGNITO_DOMAIN ?? '',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',
    QUICKBOOKS_CLIENT_ID: process.env.QUICKBOOKS_CLIENT_ID ?? '',
    QUICKBOOKS_CLIENT_SECRET: process.env.QUICKBOOKS_CLIENT_SECRET ?? '',
    QUICKBOOKS_REDIRECT_URI: process.env.QUICKBOOKS_REDIRECT_URI ?? '',
    QUICKBOOKS_ENVIRONMENT: process.env.QUICKBOOKS_ENVIRONMENT ?? '',
    BB_S3_BUCKET: process.env.BB_S3_BUCKET ?? '',
    CRON_SECRET: process.env.CRON_SECRET ?? '',
    SCHEDULER_TIMEZONE: process.env.SCHEDULER_TIMEZONE ?? 'America/Chicago',
    DISABLE_SCHEDULER: process.env.DISABLE_SCHEDULER ?? 'false',
    AI_PROVIDER: process.env.AI_PROVIDER ?? '',
    AI_API_KEY: process.env.AI_API_KEY ?? '',
    AI_MODEL: process.env.AI_MODEL ?? '',
    SES_FROM_EMAIL: process.env.SES_FROM_EMAIL ?? '',
    BB_SES_KEY_ID: process.env.BB_SES_KEY_ID ?? '',
    BB_SES_SECRET: process.env.BB_SES_SECRET ?? '',
  },
};

export default nextConfig;
