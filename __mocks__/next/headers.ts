const cookieStore = new Map<string, string>();

export const cookies = jest.fn().mockReturnValue({
  get: jest.fn().mockImplementation((name: string) => {
    const value = cookieStore.get(name);
    return value ? { name, value } : undefined;
  }),
  set: jest.fn().mockImplementation((name: string, value: string) => {
    cookieStore.set(name, value);
  }),
  delete: jest.fn().mockImplementation((name: string) => {
    cookieStore.delete(name);
  }),
  getAll: jest.fn().mockReturnValue([]),
});

export const headers = jest.fn().mockReturnValue({
  get: jest.fn().mockImplementation((name: string) => {
    const map: Record<string, string> = {
      'x-user-id': 'test-user-id',
      'x-user-email': 'test@example.com',
      'x-user-name': 'Test User',
    };
    return map[name.toLowerCase()] ?? null;
  }),
  has: jest.fn().mockReturnValue(true),
  entries: jest.fn().mockReturnValue([]),
  keys: jest.fn().mockReturnValue([]),
  values: jest.fn().mockReturnValue([]),
  forEach: jest.fn(),
});
