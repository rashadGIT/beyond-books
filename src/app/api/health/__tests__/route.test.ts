// @jest-environment node
import { GET } from '../route';
import { prisma } from '../../../../__mocks__/prisma';

describe('GET /api/health', () => {
  it('returns 200 with status=ok when DB is reachable', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ '?column?': 1 }]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('connected');
    expect(body).toHaveProperty('env');
  });

  it('returns 503 with status=error when DB query throws', async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('error');
    expect(body.db).toBe('disconnected');
    expect(body.message).toBe('Connection refused');
  });
});
