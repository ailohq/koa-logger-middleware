# @ailo/koa-logger-middleware

A logger middleware for koa2 with **color** and customizable logger as **winstonjs**.

<img src="log.png" alt="Koa logger middleware"/>

## Usage example

```sh
yarn add koa-logger-middleware
```

```ts
import { koaLoggerMiddleware } from "koa-logger-middleware";

app.use(
  koaLoggerMiddleware({
    logger: Logger.logAs("koa"),
  })
);
```

### Options

To see all option refer to `src/index.ts` file.

- **logger**: [Object] - eg: winstonjs, by default is console with coloration.

  ```js
  const winstonLogger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
        colorize: true,
      }),
    ],
  });

  koaLoggerMiddleware({ logger: winstonLogger });
  ```

- **onStartFormat**: [Function] - format the string to log on request start:
  ```js
  koaLoggerMiddleware({
    onStartFormat(ctx) {
      const { start } = ctx.__logger;
      return `START: ${this.dateFormat(start)} - ${ctx.method} ${ctx.url}`;
    },
  });
  ```
- **onErrorFormat**: [Function] - same as onStartFormat but when error occurred
- **onEndFormat**: [Function] - same as onStartFormat but on response end
- **fillInfo**: [Function] - information that will be pass to the logger as 2 parameter.
  It can be usefull for example when you want to parse log to analize them or use it as big data
  ```js
  logger({
    fillInfo(ctx) {
      ctx.__logInfo = ctx.state.__logInfo = {
        query: ctx.request.query,
        method: ctx.request.method,
        url: ctx.request.url,
        DeviceId: ctx.request.get('DeviceId'),
        path: ctx.request.path,
        ip: ctx.request.ip,
        host: ctx.request.host,
        protocol: ctx.request.protocol,
        ...
      };
    },
  });
  ```
- **onError**: [Function] - call when an error occurred. Here you can handle error are whatever

## Development

```sh
yarn
yarn start
```

## Testing

```sh
yarn lint # prettier and eslint
yarn test # unit tests
yarn test:watch # unit tests in watch mode
```

## Releasing

**Note: Releasing is done manually (CI isn't configured yet).** Linters, tests, build and so on are run during each `git push` / `yarn release`.

```sh
yarn release # will automatically ask you about version bump, run tests and build, and push new version to git & npm
```
