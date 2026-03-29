import { classifyDonations, type ClassificationInput } from '../classificationService';
import { generateAIResponse } from '../aiProviders';

jest.mock('../aiProviders');

const mockGenerateAIResponse = jest.mocked(generateAIResponse);

const makeTx = (id: string, description: string, grossAmount = 100): ClassificationInput => ({
  id,
  donorName: 'Test Donor',
  description,
  grossAmount,
});

describe('classifyDonations', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty array for empty input', async () => {
    const result = await classifyDonations([]);
    expect(result).toEqual([]);
    expect(mockGenerateAIResponse).not.toHaveBeenCalled();
  });

  it('returns classified results for a batch of transactions', async () => {
    const mockResults = [
      { id: 'tx-1', classification: 'GENERAL', restrictedFund: null, confidence: 0.95 },
      { id: 'tx-2', classification: 'RESTRICTED', restrictedFund: 'Scholarship Fund', confidence: 0.88 },
    ];

    mockGenerateAIResponse.mockResolvedValueOnce({
      content: JSON.stringify(mockResults),
      toolCalls: [],
    });

    const transactions = [
      makeTx('tx-1', 'General donation'),
      makeTx('tx-2', 'For the scholarship fund'),
    ];

    const result = await classifyDonations(transactions);
    expect(result).toHaveLength(2);
    expect(result[0].classification).toBe('GENERAL');
    expect(result[1].classification).toBe('RESTRICTED');
    expect(result[1].restrictedFund).toBe('Scholarship Fund');
  });

  it('extracts JSON array embedded in larger response text', async () => {
    const mockResults = [
      { id: 'tx-3', classification: 'GENERAL', restrictedFund: null, confidence: 0.9 },
    ];

    mockGenerateAIResponse.mockResolvedValueOnce({
      content: `Here are the classifications:\n${JSON.stringify(mockResults)}\nThat's all.`,
      toolCalls: [],
    });

    const result = await classifyDonations([makeTx('tx-3', 'Unrestricted gift')]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tx-3');
  });

  it('falls back to GENERAL classification when AI response has no JSON array', async () => {
    mockGenerateAIResponse.mockResolvedValueOnce({
      content: 'Sorry, I cannot classify these right now.',
      toolCalls: [],
    });

    const transactions = [makeTx('tx-4', 'Some donation'), makeTx('tx-5', 'Another donation')];
    const result = await classifyDonations(transactions);

    expect(result).toHaveLength(2);
    result.forEach(r => {
      expect(r.classification).toBe('GENERAL');
      expect(r.restrictedFund).toBeNull();
      expect(r.confidence).toBe(0);
    });
  });

  it('falls back to GENERAL classification when AI call throws', async () => {
    mockGenerateAIResponse.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const transactions = [makeTx('tx-6', 'Donation'), makeTx('tx-7', 'Another')];
    const result = await classifyDonations(transactions);

    expect(result).toHaveLength(2);
    result.forEach(r => {
      expect(r.classification).toBe('GENERAL');
    });
  });

  it('processes transactions in batches of 25', async () => {
    // Create 30 transactions to force 2 batches
    const transactions = Array.from({ length: 30 }, (_, i) => makeTx(`tx-${i}`, `Donation ${i}`));

    // First batch response (25 items)
    const firstBatch = Array.from({ length: 25 }, (_, i) => ({
      id: `tx-${i}`,
      classification: 'GENERAL' as const,
      restrictedFund: null,
      confidence: 0.9,
    }));

    // Second batch response (5 items)
    const secondBatch = Array.from({ length: 5 }, (_, i) => ({
      id: `tx-${i + 25}`,
      classification: 'GENERAL' as const,
      restrictedFund: null,
      confidence: 0.9,
    }));

    mockGenerateAIResponse
      .mockResolvedValueOnce({ content: JSON.stringify(firstBatch), toolCalls: [] })
      .mockResolvedValueOnce({ content: JSON.stringify(secondBatch), toolCalls: [] });

    const result = await classifyDonations(transactions);

    expect(mockGenerateAIResponse).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(30);
  });

  it('uses the AI_CLASSIFICATION_MODEL env var when set', async () => {
    const originalModel = process.env.AI_CLASSIFICATION_MODEL;
    process.env.AI_CLASSIFICATION_MODEL = 'claude-3-5-haiku-20241022';

    mockGenerateAIResponse.mockResolvedValueOnce({
      content: JSON.stringify([{ id: 'tx-a', classification: 'GENERAL', restrictedFund: null, confidence: 0.8 }]),
      toolCalls: [],
    });

    await classifyDonations([makeTx('tx-a', 'test')]);

    // The override passed to generateAIResponse should include the custom model
    expect(mockGenerateAIResponse).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      [], // empty tools
      expect.objectContaining({ model: 'claude-3-5-haiku-20241022' })
    );

    process.env.AI_CLASSIFICATION_MODEL = originalModel;
  });

  it('handles malformed JSON in AI response by falling back gracefully', async () => {
    mockGenerateAIResponse.mockResolvedValueOnce({
      content: '[{ invalid json }]',
      toolCalls: [],
    });

    const transactions = [makeTx('tx-bad', 'test')];
    const result = await classifyDonations(transactions);

    // Should fall back to GENERAL on JSON parse error
    expect(result).toHaveLength(1);
    expect(result[0].classification).toBe('GENERAL');
  });
});
