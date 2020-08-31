import type Koa from "koa";
import { koaLoggerMiddleware, KoaLoggerMiddlewareOptions } from ".";

function setup({ path = "/index", query = "a=b" } = {}) {
  const url = `${path}?${query}`;
  const context: Koa.Context = {
    status: 200,
    state: {},
    method: "GET",
    url,
    path,
    request: {
      query,
      method: "GET",
      url,
      path,
      ip: "::1",
      host: "localhost",
      protocol: "ipv4",
      get(k: string) {
        if (k === "x-correlation-id") {
          return "123";
        }
        return "";
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    response: {
      set: () => {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  } as Koa.Context;

  const logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
  };

  return { context, logger };
}

describe("koaLoggerMiddleware", () => {
  it("options can be redefined", async () => {
    const { context, logger } = setup();
    let call = 0;
    const options: KoaLoggerMiddlewareOptions = {
      logger,
      // eslint-disable-next-line @typescript-eslint/require-await
      async fillInfo(ctx) {
        call += 1;
        // eslint-disable-next-line no-multi-assign
        ctx.__logInfo = ctx.state.__logInfo = { myInfo: "tutu" };
      },
    };
    await koaLoggerMiddleware(options)(context, async () => {});

    expect(call).toBe(1);
  });

  it("does not call loggerError when success", async () => {
    const { context, logger } = setup();
    const options: KoaLoggerMiddlewareOptions = { logger };
    await koaLoggerMiddleware(options)(context, async () => {});

    expect(logger.info).toBeCalled();
    expect(logger.error).not.toBeCalled();
  });

  it("calls loggerError on error", async () => {
    const { context, logger } = setup();
    const msg = "my error";
    let errorMsg;
    try {
      await koaLoggerMiddleware({ logger })(context, () => {
        throw new Error(msg);
      });
    } catch (error) {
      errorMsg = error.message;
    }

    expect(errorMsg).toBe("my error");
  });

  it("when url is /ping, logs with silly log level by default", async () => {
    const { context, logger } = setup({ path: "/ping" });
    await koaLoggerMiddleware({ logger })(context, async () => {});

    expect(logger.info).not.toBeCalled();
    expect(logger.error).not.toBeCalled();
    expect(logger.silly).toBeCalled();
  });
});
