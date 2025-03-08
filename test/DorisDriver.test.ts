import { DorisDriver } from '../src/DorisDriver';

describe('DorisDriver', () => {
  let driver: DorisDriver;

  beforeAll(() => {
    driver = new DorisDriver({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: Number(process.env.TEST_DB_PORT) || 9030,
      user: process.env.TEST_DB_USER || 'root',
      password: process.env.TEST_DB_PASS || '',
      database: process.env.TEST_DB_NAME || 'test',
    });
  });

  afterAll(async () => {
    await driver.release();
  });

  test('should connect to database', async () => {
    const result = await driver.testConnection();
    expect(result).toBeDefined();
  });

  test('should execute query', async () => {
    const result = await driver.query('SELECT 1 as one', []);
    expect(result[0].one).toBe(1);
  });

  test('should map types correctly', () => {
    expect(driver.toGenericType('string')).toBe('text');
    expect(driver.toGenericType('bigint')).toBe('int');
    expect(driver.toGenericType('decimal')).toBe('decimal');
  });
}); 