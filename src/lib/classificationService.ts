/**
 * Classification Service — uses a lightweight AI call to classify donations as
 * RESTRICTED (designated to a specific fund/program) or GENERAL (unrestricted).
 *
 * Uses AI_CLASSIFICATION_MODEL env var (default: claude-haiku-4-5-20251001) to
 * keep costs low. Batches 25 transactions per call (~$0.001 per 500 donations).
 */

import { generateAIResponse, type AIMessage, type AIOverride } from './aiProviders';

export interface ClassificationInput {
  id: string;
  donorName: string;
  description: string;
  grossAmount: number;
}

export interface ClassificationResult {
  id: string;
  classification: 'RESTRICTED' | 'GENERAL';
  restrictedFund: string | null;
  confidence: number;
}

const SYSTEM_PROMPT = `You are a nonprofit donation classifier. For each donation, output JSON only — no explanation.

Classification rules:
- RESTRICTED: memo/description mentions a specific program, fund, project, grant, or named campaign
- GENERAL: unrestricted gift, "where most needed", no designation, generic "donation"

Return a JSON array: [{ "id": "...", "classification": "RESTRICTED"|"GENERAL", "restrictedFund": "fund name or null", "confidence": 0.0-1.0 }]`;

const BATCH_SIZE = 25;

function getOverride(): AIOverride {
  const model = process.env.AI_CLASSIFICATION_MODEL ?? 'claude-haiku-4-5-20251001';
  const provider = (process.env.AI_PROVIDER ?? 'anthropic') as AIOverride['provider'];
  const apiKey = process.env.AI_API_KEY ?? '';
  return { provider, apiKey, model };
}

export async function classifyDonations(
  transactions: ClassificationInput[]
): Promise<ClassificationResult[]> {
  if (transactions.length === 0) return [];

  const results: ClassificationResult[] = [];
  const override = getOverride();

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    const payload = batch.map(tx => ({
      id: tx.id,
      donorName: tx.donorName,
      description: tx.description,
      amount: tx.grossAmount,
    }));

    const messages: AIMessage[] = [
      { role: 'user', content: JSON.stringify(payload) },
    ];

    try {
      const response = await generateAIResponse(SYSTEM_PROMPT, messages, [], override);
      // Extract JSON array from the response content
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found in classification response');
      const parsed: ClassificationResult[] = JSON.parse(jsonMatch[0]);
      results.push(...parsed);
    } catch (err) {
      // On batch failure fall back to UNCLASSIFIED (safe default)
      console.error('[Classification] Batch failed:', err);
      for (const tx of batch) {
        results.push({ id: tx.id, classification: 'GENERAL', restrictedFund: null, confidence: 0 });
      }
    }
  }

  return results;
}
