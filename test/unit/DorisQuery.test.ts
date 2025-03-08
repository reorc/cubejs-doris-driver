// Mock all required dependencies
jest.mock('moment-timezone', () => {
  const momentMock = () => ({
    tz: () => ({
      format: () => '+00:00'
    })
  });
  momentMock.tz = () => ({
    format: () => '+00:00'
  });
  return momentMock;
});

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

import { DorisQuery } from '../../src/DorisQuery';

describe('DorisQuery', () => {
  let query: DorisQuery;

  beforeEach(() => {
    const mockCompiler = {
      compilerCache: new Map(),
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
  });

  describe('time functions', () => {
    test('convertTz should generate correct SQL', () => {
      const result = query.convertTz('timestamp_field');
      expect(result).toBe("CONVERT_TZ(timestamp_field, @@session.time_zone, '+00:00')");
    });

    test('timeGroupedColumn should handle all granularities', () => {
      const testCases = [
        {
          granularity: 'day',
          expected: "CAST(DATE_FORMAT(dimension, '%Y-%m-%dT00:00:00.000') AS DATETIME)"
        },
        {
          granularity: 'week',
          expected: "CAST(DATE_FORMAT(DATE_ADD('1900-01-01', INTERVAL TIMESTAMPDIFF(WEEK, '1900-01-01', dimension) WEEK), '%Y-%m-%dT00:00:00.000') AS DATETIME)"
        },
        {
          granularity: 'hour',
          expected: "CAST(DATE_FORMAT(dimension, '%Y-%m-%dT%H:00:00.000') AS DATETIME)"
        },
        {
          granularity: 'minute',
          expected: "CAST(DATE_FORMAT(dimension, '%Y-%m-%dT%H:%i:00.000') AS DATETIME)"
        },
        {
          granularity: 'second',
          expected: "CAST(DATE_FORMAT(dimension, '%Y-%m-%dT%H:%i:%S.000') AS DATETIME)"
        },
        {
          granularity: 'month',
          expected: "CAST(DATE_FORMAT(dimension, '%Y-%m-01T00:00:00.000') AS DATETIME)"
        },
        {
          granularity: 'quarter',
          expected: "CAST(DATE_ADD('1900-01-01', INTERVAL TIMESTAMPDIFF(QUARTER, '1900-01-01', dimension) QUARTER) AS DATETIME)"
        },
        {
          granularity: 'year',
          expected: "CAST(DATE_FORMAT(dimension, '%Y-01-01T00:00:00.000') AS DATETIME)"
        }
      ];

      testCases.forEach(({ granularity, expected }) => {
        expect(query.timeGroupedColumn(granularity, 'dimension')).toBe(expected);
      });
    });

    test('timeGroupedColumn should throw error for invalid granularity', () => {
      expect(() => query.timeGroupedColumn('invalid', 'dimension')).toThrow('Unsupported granularity: invalid');
    });

    test('subtractInterval should generate correct SQL', () => {
      expect(query.subtractInterval('date', '1 day')).toBe('DATE_SUB(date, INTERVAL 1 day)');
      expect(query.subtractInterval('date', '2 months')).toBe('DATE_SUB(date, INTERVAL 2 months)');
    });

    test('addInterval should generate correct SQL', () => {
      expect(query.addInterval('date', '1 day')).toBe('DATE_ADD(date, INTERVAL 1 day)');
      expect(query.addInterval('date', '2 months')).toBe('DATE_ADD(date, INTERVAL 2 months)');
    });
  });

  describe('table name handling', () => {
    test('preAggregationTableName should handle normal names', () => {
      const result = query.preAggregationTableName('cube', 'agg', true);
      expect(result.length).toBeLessThanOrEqual(64);
    });

    test('preAggregationTableName should throw error for long names', () => {
      const longCubeName = 'a'.repeat(32);
      const longAggName = 'b'.repeat(32);
      expect(() => query.preAggregationTableName(longCubeName, longAggName, true))
        .toThrow(/Doris cannot work with table names longer than 64 symbols/);
    });
  });

  describe('SQL templates', () => {
    test('sqlTemplates should return correct Doris-specific templates', () => {
      const templates = query.sqlTemplates();
      
      // Check quote settings
      expect(templates.quotes.identifiers).toBe('`');
      expect(templates.quotes.escape).toBe('\\`');

      // Check type mappings
      expect(templates.types.string).toBe('VARCHAR');
      expect(templates.types.text).toBe('STRING');
      expect(templates.types.boolean).toBe('BOOLEAN');
      expect(templates.types.timestamp).toBe('DATETIME');
      expect(templates.types.binary).toBe('STRING');
      expect(templates.types.interval).toBeUndefined();

      // Check expressions
      expect(templates.expressions.ilike).toBeUndefined();
      expect(templates.expressions.sort).toBe('{{ expr }} IS NULL {% if nulls_first %}DESC{% else %}ASC{% endif %}, {{ expr }} {% if asc %}ASC{% else %}DESC{% endif %}');
    });
  });
}); 