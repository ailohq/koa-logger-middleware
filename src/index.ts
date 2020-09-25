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

const defaultOptions = {
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
    // eslint-disable-next-line no-multi-assign
    ctx.__logInfo = ctx.state.__logInfo = {};
  },

  async correlationId(ctx: Koa.Context) {
    const correlationId = ctx.request.get("x-correlation-id")
      ? ctx.request.get("x-correlation-id").slice(0, 100)
      : undefined;
    ctx.__logInfo.correlationId = correlationId;
    ctx.state.__logInfo.correlationId = correlationId;
    if (correlationId) {
      ctx.response.set("X-Correlation-Id", correlationId);
    }
    return correlationId;
  },

  onStartFormat(ctx: Koa.Context) {
    const { correlationId } = ctx.__logInfo;
    return `--> ${chalk.bold(ctx.method)} ${chalk.blue.bold(ctx.path)}${
      correlationId ? ` - correlation=${correlationId}` : ""
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
    const { correlationId } = ctx.__logInfo;
    const { status } = ctx.__logger;
    const statusColor = chalk[this.color(status)];
    return `<-- ${chalk.bold(ctx.method)} ${chalk.blue.bold(
      ctx.path
    )} - status=${statusColor.bold(status)} duration=${timeTake}ms${
      correlationId ? ` correlation=${correlationId}` : ""
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
      await options.correlationId(ctx);
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
