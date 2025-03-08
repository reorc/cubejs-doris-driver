import { DorisDriver } from '../../src/DorisDriver';

describe('DorisDriver Integration', () => {
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

  test('should create and drop test table', async () => {
    const tableName = 'test_table';
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INT,
        name STRING,
        created_at DATETIME
      ) ENGINE = OLAP
      DUPLICATE KEY(id)
      DISTRIBUTED BY HASH(id) BUCKETS 1
      PROPERTIES (
        "replication_num" = "1"
      )
    `;

    await driver.query(createTableQuery, []);

    // Insert test data
    const insertQuery = `
      INSERT INTO ${tableName} (id, name, created_at)
      VALUES (1, 'test', '2024-01-01 00:00:00')
    `;
    await driver.query(insertQuery, []);

    // Query test data
    const selectQuery = `SELECT * FROM ${tableName}`;
    const result = await driver.query(selectQuery, []);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(1);
    expect(result[0].name).toBe('test');

    // Drop test table
    const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;
    await driver.query(dropQuery, []);
  });

  test('should handle time zones correctly', async () => {
    const query = `
      SELECT CONVERT_TZ('2024-01-01 00:00:00', '+00:00', '+08:00') as converted_time
    `;
    const result = await driver.query(query, []);
    expect(result[0].converted_time).toBe('2024-01-01 08:00:00');
  });

  test('should handle different data types', async () => {
    const tableName = 'test_types';
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        int_col INT,
        decimal_col DECIMAL(10,2),
        string_col STRING,
        bool_col BOOLEAN,
        datetime_col DATETIME
      ) ENGINE = OLAP
      DUPLICATE KEY(int_col)
      DISTRIBUTED BY HASH(int_col) BUCKETS 1
      PROPERTIES (
        "replication_num" = "1"
      )
    `;

    await driver.query(createTableQuery, []);

    const insertQuery = `
      INSERT INTO ${tableName}
      VALUES (
        42,
        123.45,
        'test string',
        true,
        '2024-01-01 12:34:56'
      )
    `;
    await driver.query(insertQuery, []);

    const selectQuery = `SELECT * FROM ${tableName}`;
    const result = await driver.query(selectQuery, []);
    expect(result.length).toBe(1);
    expect(result[0].int_col).toBe(42);
    expect(result[0].decimal_col).toBe('123.45');
    expect(result[0].string_col).toBe('test string');
    expect(result[0].bool_col).toBe(1);
    expect(result[0].datetime_col).toBe('2024-01-01 12:34:56');

    const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;
    await driver.query(dropQuery, []);
  });
}); 