/**
 * @copyright ReOrc, Inc.
 * @license Apache-2.0
 * @fileoverview The `DorisQuery` and related types declaration.
 */

import moment from 'moment-timezone';
import { MysqlQuery } from '@cubejs-backend/schema-compiler';

type GranularityType = 'day' | 'week' | 'hour' | 'minute' | 'second' | 'month' | 'quarter' | 'year';

const GRANULARITY_TO_INTERVAL: Record<GranularityType, (date: string) => string> = {
  day: (date: string) => `DATE_TRUNC(${date}, 'day')`,
  week: (date: string) => `DATE_TRUNC(${date}, 'week')`,
  hour: (date: string) => `DATE_TRUNC(${date}, 'hour')`,
  minute: (date: string) => `DATE_TRUNC(${date}, 'minute')`,
  second: (date: string) => `DATE_TRUNC(${date}, 'second')`,
  month: (date: string) => `DATE_TRUNC(${date}, 'month')`,
  quarter: (date: string) => `DATE_TRUNC(${date}, 'quarter')`,
  year: (date: string) => `DATE_TRUNC(${date}, 'year')`
};

export class DorisQuery extends MysqlQuery {
  public convertTz(field: string) {
    // No timezone conversion - return field as-is
    return field;
  }

  // Override timeGroupedColumn to use Doris's optimized date functions if available
  public timeGroupedColumn(granularity: string, dimension: string) {
    if (!GRANULARITY_TO_INTERVAL[granularity as GranularityType]) {
      throw new Error(`Unsupported granularity: ${granularity}`);
    }
    return `CAST(${GRANULARITY_TO_INTERVAL[granularity as GranularityType](dimension)} AS DATETIME)`;
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

  public timeStampCast(value: string) {
    // Doris uses DATETIME type, so no need to cast
    return value;
  }
} 