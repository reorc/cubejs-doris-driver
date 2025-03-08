import moment from 'moment-timezone';
import { MysqlQuery } from '@cubejs-backend/schema-compiler';

const GRANULARITY_TO_INTERVAL = {
  day: (date: string) => `DATE_FORMAT(${date}, '%Y-%m-%dT00:00:00.000')`,
  week: (date: string) => `DATE_FORMAT(DATE_ADD('1900-01-01', INTERVAL TIMESTAMPDIFF(WEEK, '1900-01-01', ${date}) WEEK), '%Y-%m-%dT00:00:00.000')`,
  hour: (date: string) => `DATE_FORMAT(${date}, '%Y-%m-%dT%H:00:00.000')`,
  minute: (date: string) => `DATE_FORMAT(${date}, '%Y-%m-%dT%H:%i:00.000')`,
  second: (date: string) => `DATE_FORMAT(${date}, '%Y-%m-%dT%H:%i:%S.000')`,
  month: (date: string) => `DATE_FORMAT(${date}, '%Y-%m-01T00:00:00.000')`,
  quarter: (date: string) => `DATE_ADD('1900-01-01', INTERVAL TIMESTAMPDIFF(QUARTER, '1900-01-01', ${date}) QUARTER)`,
  year: (date: string) => `DATE_FORMAT(${date}, '%Y-01-01T00:00:00.000')`
};

export class DorisQuery extends MysqlQuery {
  public convertTz(field: string) {
    return `CONVERT_TZ(${field}, @@session.time_zone, '${moment().tz(this.timezone).format('Z')}')`;
  }

  // Override timeGroupedColumn to use Doris's optimized date functions if available
  public timeGroupedColumn(granularity: string, dimension: string) {
    return `CAST(${GRANULARITY_TO_INTERVAL[granularity](dimension)} AS DATETIME)`;
  }

  public subtractInterval(date: string, interval: string) {
    return `DATE_SUB(${date}, INTERVAL ${interval})`;
  }

  public addInterval(date: string, interval: string) {
    return `DATE_ADD(${date}, INTERVAL ${interval})`;
  }

  // Doris has some limitations on table names
  public preAggregationTableName(cube: string, preAggregationName: string, skipSchema: boolean) {
    const name = super.preAggregationTableName(cube, preAggregationName, skipSchema);
    if (name.length > 64) {
      throw new Error(`Doris cannot work with table names longer than 64 symbols. Consider using the 'sqlAlias' attribute in your cube and pre-aggregation definition for ${name}.`);
    }
    return name;
  }

  public sqlTemplates() {
    const templates = super.sqlTemplates();
    // Customize SQL templates for Doris if needed
    templates.quotes.identifiers = '`';
    templates.quotes.escape = '\\`';
    templates.expressions.sort = '{{ expr }} IS NULL {% if nulls_first %}DESC{% else %}ASC{% endif %}, {{ expr }} {% if asc %}ASC{% else %}DESC{% endif %}';
    delete templates.expressions.ilike;
    templates.types.string = 'VARCHAR';
    templates.types.text = 'STRING';  // Doris uses STRING instead of TEXT
    templates.types.boolean = 'BOOLEAN';  // Doris supports native BOOLEAN
    templates.types.timestamp = 'DATETIME';
    delete templates.types.interval;
    templates.types.binary = 'STRING';  // Doris doesn't support BLOB
    return templates;
  }
} 