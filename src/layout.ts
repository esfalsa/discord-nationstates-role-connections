import { createMiddleware } from "hono/factory";
import { html } from "hono/html";
import { type StatusCode } from "hono/utils/http-status";

declare module "hono" {
  interface ContextRenderer {
    (
      content: string | Promise<string>,
      head?: { title?: string; status?: StatusCode },
    ): Response | Promise<Response>;
  }
}

export const layout = createMiddleware(async (c, next) => {
  c.setRenderer((content, head) =>
    c.html(
      html`<!doctype html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
            />
            <link
              rel="stylesheet"
              href="https://cdn.jsdelivr.net/npm/water.css@2/out/water.min.css"
            />
            <title>${head?.title ?? ""}</title>
          </head>
          <body>
            ${content}
          </body>
        </html>`,
      head?.status || 200,
    ),
  );
  await next();
});
