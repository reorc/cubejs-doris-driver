// Mock moment-range before any imports
jest.mock('moment-range', () => ({
  extendMoment: jest.fn((moment) => {
    moment.range = jest.fn();
    return moment;
  })
}));

// Mock required dependencies for schema compilation
jest.mock('@cubejs-backend/schema-compiler', () => {
  class BaseMockQuery {
    protected readonly compiler: any;
    protected readonly options: any;

    constructor(compiler: any, options: any) {
      this.compiler = compiler;
      this.options = options;
    }

    public get timezone() {
      return this.options.timezone;
    }

    public preAggregationTableName(cube: string, preAggregationName: string, skipSchema: boolean) {
      return skipSchema ? `${cube}_${preAggregationName}` : `pre_aggregations.${cube}_${preAggregationName}`;
    }

    public sqlTemplates() {
      return {
        quotes: {},
        expressions: {},
        types: {}
      };
    }
  }

  return {
    MysqlQuery: BaseMockQuery
  };
});

jest.mock('moment-timezone', () => {
  const momentMock = () => ({
    tz: () => ({
      format: () => '+08:00'
    })
  });
  momentMock.tz = () => ({
    format: () => '+08:00'
  });
  return momentMock;
});

import { DorisDriver } from '../../src/DorisDriver';
import { DorisQuery } from '../../src/DorisQuery';

describe('DorisQuery Dialect Integration', () => {
  let driver: DorisDriver;
  let query: DorisQuery;

  beforeAll(async () => {
    console.log('Starting test setup...');
    
    try {
      driver = new DorisDriver({
        host: process.env.TEST_DB_HOST || 'localhost',
        port: Number(process.env.TEST_DB_PORT) || 9030,
        user: process.env.TEST_DB_USER || 'root',
        password: process.env.TEST_DB_PASS || '',
        database: process.env.TEST_DB_NAME || 'test'
      });

      console.log('Testing connection...');
      await driver.testConnection();
      console.log('Connection successful');

      const mockCompiler = {
        compilerCache: {
          getQueryCache: () => ({
            cache: (_key: string[], fn: () => any) => fn()
          })
        },
        contextQuery: () => ({})
      };

      query = new DorisQuery({
        compilers: { test: mockCompiler },
        compiler: mockCompiler,
      }, {
        contextToAppId: () => 'TEST_APP',
        contextToOrchestratorId: () => 'TEST_ORCHESTRATOR',
        timezone: 'UTC',
        preAggregationsSchema: () => 'pre_aggregations',
        queryClass: () => DorisQuery
      });
      
      console.log('Setup complete');
    } catch (error) {
      console.error('Setup failed:', error);
      throw error;
    }
  }, 30000);

  afterAll(async () => {
    try {
      console.log('Starting cleanup...');
      await driver.release();
      console.log('Cleanup complete');
    } catch (error) {
      console.error('Cleanup failed:', error);
      throw error;
    }
  });

  describe('time functions', () => {
    const tableName = 'test_query_time_functions';

    beforeAll(async () => {
      try {
        console.log('Dropping existing table if any...');
        await driver.query(`DROP TABLE IF EXISTS ${tableName}`, [])
          .catch(err => console.log('Drop table error (can be ignored if table did not exist):', err.message));

        console.log('Creating test table...');
        await driver.query(`
          CREATE TABLE ${tableName} (
            id INT,
            created_at DATETIME,
            updated_at DATETIME
          ) ENGINE = OLAP
          DUPLICATE KEY(id)
          DISTRIBUTED BY HASH(id) BUCKETS 1
        `, []);
        console.log('Table created successfully');

        console.log('Inserting test data...');
        await driver.query(`
          INSERT INTO ${tableName} (id, created_at, updated_at)
          VALUES 
            (1, '2024-01-01 00:00:00', '2024-01-01 12:00:00'),
            (2, '2024-01-15 00:00:00', '2024-01-15 12:00:00'),
            (3, '2024-02-01 00:00:00', '2024-02-01 12:00:00'),
            (4, '2024-03-01 00:00:00', '2024-03-01 12:00:00'),
            (5, '2024-04-01 00:00:00', '2024-04-01 12:00:00')
        `, []);
        console.log('Test data inserted');
      } catch (error) {
        console.error('Table setup failed:', error);
        await driver.query(`DROP TABLE IF EXISTS ${tableName}`, [])
          .catch(() => {});
        throw error;
      }
    }, 30000);

    afterAll(async () => {
      try {
        console.log('Dropping test table...');
        await driver.query(`DROP TABLE IF EXISTS ${tableName}`, []);
        console.log('Test table dropped');
      } catch (error) {
        console.error('Table cleanup failed:', error);
      }
    }, 30000);

    test('should handle convertTz correctly', async () => {
      const sql = `
        SELECT ${query.convertTz('created_at')} as converted_time
        FROM ${tableName}
        WHERE id = 1
      `;
      const result = await driver.query(sql, []);
      expect(result[0].converted_time).toBe('2024-01-01 00:00:00');
    });

    test('should handle timeGroupedColumn for all granularities', async () => {
      const testCases = [
        {
          granularity: 'day',
          expected: '2024-01-01 00:00:00'
        },
        {
          granularity: 'week',
          expected: '2024-01-01 00:00:00' // First day of the week
        },
        {
          granularity: 'hour',
          expected: '2024-01-01 00:00:00'
        },
        {
          granularity: 'minute',
          expected: '2024-01-01 00:00:00'
        },
        {
          granularity: 'second',
          expected: '2024-01-01 00:00:00'
        },
        {
          granularity: 'month',
          expected: '2024-01-01 00:00:00'
        },
        {
          granularity: 'quarter',
          expected: '2024-01-01 00:00:00'
        },
        {
          granularity: 'year',
          expected: '2024-01-01 00:00:00'
        }
      ];

      for (const { granularity, expected } of testCases) {
        const sql = `
          SELECT ${query.timeGroupedColumn(granularity, 'created_at')} as grouped_date
          FROM ${tableName}
          WHERE id = 1
        `;
        const result = await driver.query(sql, []);
        expect(result[0].grouped_date).toBe(expected);
      }
    });

    test('should throw error for invalid granularity', () => {
      expect(() => query.timeGroupedColumn('invalid', 'created_at'))
        .toThrow('Unsupported granularity: invalid');
    });

    test('should handle subtractInterval correctly', async () => {
      const testCases = [
        {
          interval: '1 DAY',
          expected: '2023-12-31 00:00:00'
        },
        {
          interval: '1 MONTH',
          expected: '2023-12-01 00:00:00'
        },
        {
          interval: '1 YEAR',
          expected: '2023-01-01 00:00:00'
        }
      ];

      for (const { interval, expected } of testCases) {
        const sql = `
          SELECT ${query.subtractInterval('created_at', interval)} as result_date
          FROM ${tableName}
          WHERE id = 1
        `;
        const result = await driver.query(sql, []);
        expect(result[0].result_date).toBe(expected);
      }
    });

    test('should handle addInterval correctly', async () => {
      const testCases = [
        {
          interval: '1 DAY',
          expected: '2024-01-02 00:00:00'
        },
        {
          interval: '1 MONTH',
          expected: '2024-02-01 00:00:00'
        },
        {
          interval: '1 YEAR',
          expected: '2025-01-01 00:00:00'
        }
      ];

      for (const { interval, expected } of testCases) {
        const sql = `
          SELECT ${query.addInterval('created_at', interval)} as result_date
          FROM ${tableName}
          WHERE id = 1
        `;
        const result = await driver.query(sql, []);
        expect(result[0].result_date).toBe(expected);
      }
    });
  });

  describe('table name handling', () => {
    test('should handle normal table names', () => {
      const result = query.preAggregationTableName('orders', 'daily_sales', true);
      expect(result).toBe('orders_daily_sales');
      expect(result.length).toBeLessThanOrEqual(64);
    });

    test('should throw error for long table names', () => {
      const longCubeName = 'a'.repeat(32);
      const longAggName = 'b'.repeat(33);
      expect(() => query.preAggregationTableName(longCubeName, longAggName, true))
        .toThrow(/Doris cannot work with table names longer than 64 symbols/);
    });
  });

  describe('SQL templates', () => {
    test('should return correct Doris-specific templates', () => {
      const templates = query.sqlTemplates();
      
      // Verify quote settings
      expect(templates.quotes.identifiers).toBe('`');
      expect(templates.quotes.escape).toBe('\\`');

      // Verify type mappings
      expect(templates.types.string).toBe('VARCHAR');
      expect(templates.types.text).toBe('STRING');
      expect(templates.types.boolean).toBe('BOOLEAN');
      expect(templates.types.timestamp).toBe('DATETIME');
      expect(templates.types.binary).toBe('STRING');
      expect(templates.types.interval).toBeUndefined();

      // Verify expressions
      expect(templates.expressions.ilike).toBeUndefined();
      expect(templates.expressions.sort).toBe('{{ expr }} IS NULL {% if nulls_first %}DESC{% else %}ASC{% endif %}, {{ expr }} {% if asc %}ASC{% else %}DESC{% endif %}');
    });

    test('should handle sorting with nulls', async () => {
      const tableName = 'test_sorting';
      
      try {
        await driver.query(`
          CREATE TABLE ${tableName} (
            id INT,
            nullable_value INT
          ) ENGINE = OLAP
          DUPLICATE KEY(id)
          DISTRIBUTED BY HASH(id) BUCKETS 1
        `, []);

        await driver.query(`
          INSERT INTO ${tableName} (id, nullable_value)
          VALUES 
            (1, NULL),
            (2, 10),
            (3, NULL),
            (4, 20)
        `, []);

        const sql = `
          SELECT *
          FROM ${tableName}
          ORDER BY nullable_value IS NULL ASC, nullable_value ASC
        `;
        const result = await driver.query(sql, []);
        
        expect(result[0].nullable_value).toBe(10);
        expect(result[1].nullable_value).toBe(20);
        expect(result[2].nullable_value).toBeNull();
        expect(result[3].nullable_value).toBeNull();

      } finally {
        await driver.query(`DROP TABLE IF EXISTS ${tableName}`, []);
      }
    });
  });
}); 