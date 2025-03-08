import { DorisDriver } from '../../src/DorisDriver';

describe('DorisDialect Integration', () => {
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

  describe('time functions', () => {
    const tableName = 'test_time_functions';

    beforeAll(async () => {
      // Create test table with various datetime columns
      await driver.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id INT,
          created_at DATETIME,
          updated_at DATETIME
        ) ENGINE = OLAP
        DUPLICATE KEY(id)
        DISTRIBUTED BY HASH(id) BUCKETS 1
        PROPERTIES (
          "replication_num" = "1"
        )
      `, []);

      // Insert test data
      await driver.query(`
        INSERT INTO ${tableName} VALUES
        (1, '2024-01-01 00:00:00', '2024-01-01 12:00:00'),
        (2, '2024-01-02 00:00:00', '2024-01-02 12:00:00'),
        (3, '2024-02-01 00:00:00', '2024-02-01 12:00:00'),
        (4, '2024-03-01 00:00:00', '2024-03-01 12:00:00')
      `, []);
    });

    afterAll(async () => {
      await driver.query(`DROP TABLE IF EXISTS ${tableName}`, []);
    });

    test('should handle DATE_FORMAT correctly', async () => {
      const result = await driver.query(`
        SELECT DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%S.000') as formatted_date
        FROM ${tableName}
        WHERE id = 1
      `, []);
      expect(result[0].formatted_date).toBe('2024-01-01T00:00:00.000');
    });

    test('should handle CONVERT_TZ correctly', async () => {
      const result = await driver.query(`
        SELECT CONVERT_TZ(created_at, '+00:00', '+08:00') as converted_time
        FROM ${tableName}
        WHERE id = 1
      `, []);
      expect(result[0].converted_time).toBe('2024-01-01 08:00:00');
    });

    test('should handle DATE_ADD correctly', async () => {
      const result = await driver.query(`
        SELECT DATE_ADD(created_at, INTERVAL 1 DAY) as next_day
        FROM ${tableName}
        WHERE id = 1
      `, []);
      expect(result[0].next_day).toBe('2024-01-02 00:00:00');
    });

    test('should handle DATE_SUB correctly', async () => {
      const result = await driver.query(`
        SELECT DATE_SUB(created_at, INTERVAL 1 DAY) as prev_day
        FROM ${tableName}
        WHERE id = 1
      `, []);
      expect(result[0].prev_day).toBe('2023-12-31 00:00:00');
    });

    test('should handle TIMESTAMPDIFF correctly', async () => {
      const result = await driver.query(`
        SELECT TIMESTAMPDIFF(HOUR, created_at, updated_at) as hours_diff
        FROM ${tableName}
        WHERE id = 1
      `, []);
      expect(result[0].hours_diff).toBe(12);
    });
  });

  describe('aggregation functions', () => {
    const tableName = 'test_aggregations';

    beforeAll(async () => {
      // Create test table with numeric columns
      await driver.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id INT,
          category STRING,
          amount DECIMAL(10,2),
          quantity INT
        ) ENGINE = OLAP
        DUPLICATE KEY(id)
        DISTRIBUTED BY HASH(id) BUCKETS 1
        PROPERTIES (
          "replication_num" = "1"
        )
      `, []);

      // Insert test data
      await driver.query(`
        INSERT INTO ${tableName} VALUES
        (1, 'A', 100.50, 2),
        (2, 'A', 200.75, 3),
        (3, 'B', 150.25, 1),
        (4, 'B', 300.00, 4)
      `, []);
    });

    afterAll(async () => {
      await driver.query(`DROP TABLE IF EXISTS ${tableName}`, []);
    });

    test('should handle GROUP BY with multiple aggregations', async () => {
      const result = await driver.query(`
        SELECT 
          category,
          COUNT(*) as count,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount,
          MIN(amount) as min_amount,
          MAX(amount) as max_amount
        FROM ${tableName}
        GROUP BY category
        ORDER BY category
      `, []);

      expect(result.length).toBe(2);
      expect(result[0].category).toBe('A');
      expect(result[0].count).toBe(2);
      expect(result[0].total_amount).toBe('301.25');
      expect(parseFloat(result[0].avg_amount)).toBeCloseTo(150.625, 3);
      expect(parseFloat(result[0].min_amount)).toBeCloseTo(100.50, 2);
      expect(parseFloat(result[0].max_amount)).toBeCloseTo(200.75, 2);
    });

    test('should handle HAVING clause', async () => {
      const result = await driver.query(`
        SELECT 
          category,
          SUM(amount) as total_amount
        FROM ${tableName}
        GROUP BY category
        HAVING total_amount > 300
        ORDER BY category
      `, []);

      expect(result.length).toBe(2);
      expect(result.map((r: { category: string }) => r.category)).toEqual(['A', 'B']);
    });
  });

  describe('joins and subqueries', () => {
    const ordersTable = 'test_orders';
    const itemsTable = 'test_items';

    beforeAll(async () => {
      // Create orders table
      await driver.query(`
        CREATE TABLE IF NOT EXISTS ${ordersTable} (
          order_id INT,
          customer_id INT,
          order_date DATETIME
        ) ENGINE = OLAP
        DUPLICATE KEY(order_id)
        DISTRIBUTED BY HASH(order_id) BUCKETS 1
        PROPERTIES (
          "replication_num" = "1"
        )
      `, []);

      // Create items table
      await driver.query(`
        CREATE TABLE IF NOT EXISTS ${itemsTable} (
          item_id INT,
          order_id INT,
          amount DECIMAL(10,2)
        ) ENGINE = OLAP
        DUPLICATE KEY(item_id)
        DISTRIBUTED BY HASH(item_id) BUCKETS 1
        PROPERTIES (
          "replication_num" = "1"
        )
      `, []);

      // Insert test data
      await driver.query(`
        INSERT INTO ${ordersTable} VALUES
        (1, 101, '2024-01-01 10:00:00'),
        (2, 102, '2024-01-02 11:00:00'),
        (3, 101, '2024-01-03 12:00:00')
      `, []);

      await driver.query(`
        INSERT INTO ${itemsTable} VALUES
        (1, 1, 100.00),
        (2, 1, 200.00),
        (3, 2, 150.00),
        (4, 3, 300.00)
      `, []);
    });

    afterAll(async () => {
      await driver.query(`DROP TABLE IF EXISTS ${ordersTable}`, []);
      await driver.query(`DROP TABLE IF EXISTS ${itemsTable}`, []);
    });

    test('should handle INNER JOIN', async () => {
      const result = await driver.query(`
        SELECT 
          o.order_id,
          COUNT(i.item_id) as item_count,
          SUM(i.amount) as total_amount
        FROM ${ordersTable} o
        INNER JOIN ${itemsTable} i ON o.order_id = i.order_id
        GROUP BY o.order_id
        ORDER BY o.order_id
      `, []);

      expect(result.length).toBe(3);
      expect(result[0].order_id).toBe(1);
      expect(result[0].item_count).toBe(2);
      expect(parseFloat(result[0].total_amount)).toBeCloseTo(300.00, 2);
    });

    test('should handle subqueries in WHERE clause', async () => {
      const result = await driver.query(`
        SELECT order_id, customer_id
        FROM ${ordersTable}
        WHERE customer_id IN (
          SELECT DISTINCT customer_id
          FROM ${ordersTable}
          GROUP BY customer_id
          HAVING COUNT(*) > 1
        )
        ORDER BY order_id
      `, []);

      expect(result.length).toBe(2);
      expect(result.map((r: { order_id: number }) => r.order_id)).toEqual([1, 3]);
      expect(result[0].customer_id).toBe(101);
    });
  });
}); 