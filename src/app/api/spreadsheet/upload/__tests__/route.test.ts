// @jest-environment node
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

jest.mock('@/lib/awsClients', () => ({
  s3Client: {
    send: jest.fn().mockResolvedValue({}),
  },
}));

function makeRequest(headers: Record<string, string> = {}, body: FormData = new FormData()) {
  return new NextRequest('http://localhost/api/spreadsheet/upload', {
    method: 'POST',
    headers,
    body,
  });
}

describe('POST /api/spreadsheet/upload', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file is provided', async () => {
    const res = await POST(makeRequest({ 'x-user-id': 'user-1' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/No file/);
  });

  it('returns 400 when file type is invalid', async () => {
    const fd = new FormData();
    fd.append('file', new File(['data'], 'doc.pdf', { type: 'application/pdf' }));
    const res = await POST(makeRequest({ 'x-user-id': 'user-1' }, fd));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/CSV and Excel/);
  });

  it('returns 400 when file is too large', async () => {
    const mockLargeFile = {
      name: 'big.csv',
      size: 11 * 1024 * 1024,
      type: 'text/csv',
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
    };
    const mockFormData = { get: jest.fn().mockReturnValue(mockLargeFile) };
    const req = new NextRequest('http://localhost/api/spreadsheet/upload', {
      method: 'POST',
      headers: { 'x-user-id': 'user-1' },
    });
    jest.spyOn(req, 'formData').mockResolvedValueOnce(mockFormData as unknown as FormData);
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/too large/);
  });

  it('returns 200 with fileId on successful upload', async () => {
    (prisma.user.upsert as jest.Mock).mockResolvedValueOnce({});
    (prisma.processedFile.create as jest.Mock).mockResolvedValueOnce({ id: 'file-42', filename: 'data.csv' });

    const fd = new FormData();
    fd.append('file', new File(['a,b\n1,2'], 'data.csv', { type: 'text/csv' }));
    const res = await POST(makeRequest({ 'x-user-id': 'user-1' }, fd));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fileId).toBe('file-42');
  });

  it('returns 500 when Prisma throws', async () => {
    (prisma.user.upsert as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

    const fd = new FormData();
    fd.append('file', new File(['a,b\n1,2'], 'data.csv', { type: 'text/csv' }));
    const res = await POST(makeRequest({ 'x-user-id': 'user-1' }, fd));
    expect(res.status).toBe(500);
  });
});
