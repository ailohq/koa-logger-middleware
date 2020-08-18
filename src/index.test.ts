import type Koa from "koa";
import { koaLoggerMiddleware, KoaLoggerMiddlewareOptions } from ".";

describe("Logger", () => {
  let context: Koa.Context;

  beforeEach(() => {
    context = {
      status: 200,
      state: {},
      method: "GET",
      url: "/index-url",
      request: {
        query: "/index",
        method: "GET",
        url: "/index-url",
        path: "/index-path",
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
  });

  it("Should be able to redefine options", async () => {
    let call = 0;
    const options: KoaLoggerMiddlewareOptions = {
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

  it("Should not call loggerError when success", async () => {
    const myLogger = { info: jest.fn(), error: jest.fn() };
    const options: KoaLoggerMiddlewareOptions = { logger: myLogger };

    await koaLoggerMiddleware(options)(context, async () => {});
    expect(myLogger.info).toBeCalled();
    expect(myLogger.error).not.toBeCalled();
  });

  it("Should call loggerError on error", async () => {
    const msg = "my error";
    let errorMsg;
    try {
      await koaLoggerMiddleware()(context, () => {
        throw new Error(msg);
      });
    } catch (error) {
      errorMsg = error.message;
    }
    expect(errorMsg).toBe("my error");
  });
});
