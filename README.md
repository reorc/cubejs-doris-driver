# Cube.js Doris Database Driver

Apache Doris driver for Cube.js.

## Support

This driver has been tested with Apache Doris 2.0+ and is compatible with its MySQL protocol interface.

## Features

- Full support for Doris SQL syntax and data types
- Optimized time-based operations using Doris's native datetime functions
- Support for pre-aggregations with table name length validation
- Proper handling of NULL values in sorting operations
- Native support for BOOLEAN type
- Timezone conversion support

## Installation

First install the package:

```bash
npm install --save @starghost/doris-driver
# or
yarn add @starghost/doris-driver
```

## Configuration

You can configure the driver by providing a set of connection options:

```javascript
const CubejsServer = require('@cubejs-backend/server');

module.exports = new CubejsServer({
  driverFactory: () => new DorisDriver({
    host: process.env.CUBEJS_DB_HOST,
    port: process.env.CUBEJS_DB_PORT,
    user: process.env.CUBEJS_DB_USER,
    password: process.env.CUBEJS_DB_PASS,
    database: process.env.CUBEJS_DB_NAME,
    // Optional: SSL configuration
    ssl: process.env.CUBEJS_DB_SSL ? { rejectUnauthorized: false } : undefined,
  })
});
```

## Docker Support

This driver is available as a custom Cube.js Docker image that includes the Doris driver pre-installed and configured.

### Using the Docker Image

The repository includes a `docker-compose.yml` that sets up a complete environment with:
- Custom Cube.js image with Doris driver pre-installed
- Apache Doris FE (Frontend) node
- Apache Doris BE (Backend) node
- Persistent volumes for data storage

To use it:

```bash
# Build and start the environment
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop the environment
docker-compose down -v  # Add -v to remove volumes
```

### Building Your Own Image

The included Dockerfile builds a custom Cube.js image with the Doris driver pre-installed. You can use this as a base for your own custom images:

```dockerfile
FROM cubejs/cube:latest

# Install the Doris driver
RUN npm install -g doris-cubejs-driver
```

Or build from scratch using the provided Dockerfile:

```bash
# Build the image
docker build -t my-cubejs-doris .

# Run the container
docker run -p 4000:4000 -p 3000:3000 \
  -e CUBEJS_DEV_MODE=true \
  -e CUBEJS_DB_HOST=doris-host \
  -e CUBEJS_DB_PORT=9030 \
  -e CUBEJS_DB_NAME=test \
  -e CUBEJS_DB_USER=root \
  -e CUBEJS_DB_PASS= \
  -e CUBEJS_API_SECRET=secret \
  my-cubejs-doris
```

## Environment Variables

| Environment Variable | Description                                                                           | Default Value |
|--------------------|---------------------------------------------------------------------------------------|---------------|
| CUBEJS_DB_HOST     | The host URL where your Doris database is running.                                    | localhost     |
| CUBEJS_DB_PORT     | The port number to use for the connection.                                            | 9030          |
| CUBEJS_DB_NAME     | The name of the database to connect to.                                               | null          |
| CUBEJS_DB_USER     | The username used to connect to the database.                                         | null          |
| CUBEJS_DB_PASS     | The password used to connect to the database.                                         | null          |
| CUBEJS_DB_SSL      | Whether to use SSL for the connection.                                                | null          |

## Type Mapping

The driver maps Cube.js types to Doris types as follows:

| Cube.js Type | Doris Type     | Notes                                    |
|--------------|----------------|------------------------------------------|
| string       | VARCHAR(255)   | Default string type                      |
| text         | STRING         | For longer text content                  |
| decimal      | DECIMAL(38,10) | High precision decimal type              |
| integer      | INT           | Standard integer type                    |
| smallint     | SMALLINT      | Small integer type                       |
| bigint       | BIGINT        | Large integer type                       |
| tinyint      | TINYINT       | Tiny integer type                        |
| boolean      | BOOLEAN       | Native boolean support                   |
| timestamp    | DATETIME      | For date and time values                 |
| binary       | STRING        | Binary data stored as string             |

## Limitations

These limitations are inherent to Doris or specific to this driver implementation:

1. **Table Name Length**
   - Table names are limited to 64 characters
   - This affects pre-aggregation table names
   - Use 'sqlAlias' in cube definitions for long names

2. **Data Types**
   - BLOB data types are not supported (automatically mapped to STRING)
   - INTERVAL type is not supported
   - Binary data must be stored as STRING

3. **SQL Features**
   - ILIKE expressions are not supported
   - Use standard LIKE for pattern matching

4. **Time Functions**
   - All time operations use DATETIME type
   - Timezone conversions are handled through CONVERT_TZ

## Development

To run tests:

```bash
# Run all tests
yarn test

# Run unit tests only
yarn unit

# Run integration tests only
yarn integration
```

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b feature/my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin feature/my-new-feature`)
5. Create new Pull Request

## License

Apache-2.0