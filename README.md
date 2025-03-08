# Cube.js Doris Database Driver

Apache Doris driver for Cube.js.

## Support

This driver has been tested with Apache Doris 2.0+ and is compatible with its MySQL protocol interface.

## Installation

First install the package:

```bash
npm install --save @cubejs-backend/doris-driver
# or
yarn add @cubejs-backend/doris-driver
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
  })
});
```

## Environment Variables

| Environment Variable | Description                                                                           | Default Value |
|--------------------|---------------------------------------------------------------------------------------|---------------|
| CUBEJS_DB_HOST     | The host URL where your Doris database is running.                                    | localhost     |
| CUBEJS_DB_PORT     | The port number to use for the connection.                                            | 9030          |
| CUBEJS_DB_NAME     | The name of the database to connect to.                                               | null          |
| CUBEJS_DB_USER     | The username used to connect to the database.                                         | null          |
| CUBEJS_DB_PASS     | The password used to connect to the database.                                         | null          |

## License

Apache-2.0