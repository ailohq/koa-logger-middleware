/* eslint-disable @typescript-eslint/require-await */
// eslint-disable-next-line import/no-extraneous-dependencies
import type Koa from "koa";
import chalk from "chalk";

export interface Logger {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  error(...data: any[]): void;
  warn(...data: any[]): void;
  info(...data: any[]): void;
  debug(...data: any[]): void;
  silly(...data: any[]): void;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export const defaultOptions = {
  logLevel(ctx: Koa.Context): keyof Logger {
    if (["/ping", "/metrics"].includes(ctx.path)) {
      return "silly";
    }
    return "info";
  },

  color(status: number) {
    if (status < 400) {
      return "green";
    }
    if (status < 500) {
      return "gray";
    }
    return "red";
  },

  async fillInfo(ctx: Koa.Context) {
    ctx.__logInfo = {
      deviceId: ctx.request.get("ailo-device-id")?.slice(0, 100),
      correlationId: ctx.request.get("ailo-correlation-id")?.slice(0, 100),
      client: ctx.request.get("apollographql-client-name")
        ? [
            ctx.request.get("apollographql-client-name"),
            ctx.request.get("apollographql-client-version"),
          ]
            .filter(Boolean)
            .join("@") || undefined
        : undefined,
    };
  },

  onStartFormat(ctx: Koa.Context) {
    const info = Object.entries(ctx.__logInfo)
      .filter((entry) => entry[1])
      .map((entry) => `${entry[0]}=${entry[1]}`)
      .join(" ");
    return `--> ${chalk.bold(ctx.method)} ${chalk.blue.bold(ctx.path)}${
      info ? ` - ${info}` : ""
    }`;
  },

  async onStart(ctx: Koa.Context) {
    const logLevel = this.logLevel(ctx);
    this.logger[logLevel](this.onStartFormat(ctx));
  },

  onErrorFormat(ctx: Koa.Context) {
    return `${chalk.red("[ERROR]")} ${chalk.red.bold(ctx.method)} ${ctx.path}`;
  },

  async onError(ctx: Koa.Context, err: Error) {
    this.logger.error(this.onErrorFormat(ctx));
    throw err;
  },

  onEndFormat(ctx: Koa.Context, timeTake: number) {
    const { status } = ctx.__logger;
    const statusColor = chalk[this.color(status)];
    const info = Object.entries({
      status: statusColor.bold(status),
      duration: `${timeTake}ms`,
      ...ctx.__logInfo,
    })
      .filter((entry) => entry[1])
      .map((entry) => `${entry[0]}=${entry[1]}`)
      .join(" ");
    return `<-- ${chalk.bold(ctx.method)} ${chalk.blue.bold(ctx.path)}${
      info ? ` - ${info}` : ""
    }`;
  },

  async onEnd(ctx: Koa.Context) {
    const timeTake = Date.now() - ctx.__logger.start;
    const logLevel = this.logLevel(ctx);
    this.logger[logLevel](this.onEndFormat(ctx, timeTake));
  },

  logger: {
    /* eslint-disable no-console */
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
    silly: console.debug,
    /* eslint-enable no-console */
  } as Logger,
};

export type KoaLoggerMiddlewareOptions = Partial<typeof defaultOptions>;

export function koaLoggerMiddleware(opts: KoaLoggerMiddlewareOptions = {}) {
  const options = { ...defaultOptions, ...opts };

  const logger: Koa.Middleware = async (ctx, next) => {
    ctx.__logger = { status: 500, start: Date.now() };
    try {
      await options.fillInfo(ctx);
      await options.onStart(ctx);
      await next();
      ctx.__logger.status = ctx.status;
    } catch (error) {
      await options.onError(ctx, error);
    } finally {
      await options.onEnd(ctx);
    }
  };

  return logger;
}
