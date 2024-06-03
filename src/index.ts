import { validateEnv } from "@/env";
import { Storage } from "@/storage";
import { API } from "@discordjs/core";
import { REST } from "@discordjs/rest";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import { html } from "hono/html";
import { NationStatesAPI } from "./nationstates";

const app = new Hono();
// const discordBot = new API(new REST().setToken(process.env.DISCORD_TOKEN));
const discord = new API(new REST({ authPrefix: "Bearer" }));
const nationstates = await NationStatesAPI.create(
  "discord-nationstates-role-connections/0.1.0 (by:Esfalsa)",
  process.env.NATIONSTATES_SECRET,
);
const storage = new Storage();

validateEnv();

// await discordBot.roleConnections.updateMetadataRecords(
//   process.env.DISCORD_CLIENT_ID,
//   [],
// );

app.get("/", (c) => {
  return c.text("Hello, World!", 200);
});

app.get("/linked-role", async (c) => {
  const { nation } = c.req.query();

  if (!nation) {
    return c.html(
      html`<!doctype html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
            />
            <title>Link Your NationStates Nation</title>
          </head>
          <body>
            <form>
              <label for="nation">Nation:</label>
              <input type="text" id="nation" name="nation" required />

              <button type="submit">Submit</button>
            </form>
          </body>
        </html>`,
    );
  }

  const token = await nationstates.generateToken(nation);
  const verificationURL = nationstates.generateVerificationURL(token).href;

  await setSignedCookie(c, "nsToken", token, process.env.COOKIE_SECRET, {
    maxAge: 5 * 60,
    httpOnly: true,
    sameSite: "Strict",
    secure: true,
  });

  return c.html(
    html`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>Link Your NationStates Nation</title>
        </head>
        <body>
          <form method="POST">
            <label for="nation">Nation:</label>
            <input
              type="text"
              id="nation"
              name="nation"
              required
              value="${nation}"
            />

            <p>
              To find your checksum, visit
              <a href="${verificationURL}">this page</a>.
            </p>

            <label for="checksum">Checksum:</label>
            <input type="text" id="checksum" name="checksum" required />

            <button type="submit">Submit</button>
          </form>
        </body>
      </html>`,
  );
});

app.post("/linked-role", async (c) => {
  const contentType = c.req.header("content-type");
  if (contentType !== "application/x-www-form-urlencoded") {
    return c.text("Invalid content type", 415);
  }

  const { nation, checksum } = await c.req.parseBody();
  if (!nation || !checksum) {
    return c.text("Missing nation or checksum", 400);
  }
  if (typeof nation !== "string" || typeof checksum !== "string") {
    return c.text("Invalid nation or checksum", 400);
  }

  const token = await getSignedCookie(c, process.env.COOKIE_SECRET, "nsToken");
  if (!token) {
    return c.text("Missing or invalid token", 403);
  }

  const verification = await nationstates.verify(
    String(nation),
    String(checksum),
    token,
  );
  if (!verification) {
    return c.text("NationStates verification failed", 403);
  }

  const state = crypto.randomUUID();
  storage.prune();
  storage.setStateData(state, {
    nation,
    expires: new Date(Date.now() + 5 * 60),
  });

  const authorizationURL = discord.oauth2.generateAuthorizationURL({
    state: state,
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "role_connections.write identify",
    prompt: "consent",
  });

  await setSignedCookie(c, "clientState", state, process.env.COOKIE_SECRET, {
    maxAge: 5 * 60,
    httpOnly: true,
    secure: true,
  });

  return c.redirect(authorizationURL);
});

app.get("/discord-oauth-callback", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    return c.text("Missing authorization code", 400);
  }

  const state = c.req.query("state");
  if (!state) {
    return c.text("Missing state", 400);
  }

  const clientState = await getSignedCookie(
    c,
    process.env.COOKIE_SECRET,
    "clientState",
  );
  if (clientState !== state) {
    return c.text("State verification failed", 403);
  }

  const res = await discord.oauth2.tokenExchange({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    code,
    grant_type: "authorization_code",
  });

  discord.rest.setToken(res.access_token);

  const { nation } = storage.getStateData(state);
  storage.deleteStateData(state);

  discord.users.updateApplicationRoleConnection(process.env.DISCORD_CLIENT_ID, {
    platform_name: "NationStates",
    platform_username: nation,
  });

  return c.text("Role linked successfully", 200);
});

serve({
  fetch: app.fetch,
  port: 3000,
});
console.log("Server started at http://localhost:3000/");
