import { validateEnv } from "./env";
import { Storage } from "./storage";
import {
  OAuth2API,
  RoleConnectionsAPI,
  UsersAPI,
} from "@discordjs/core/http-only";
import { REST } from "@discordjs/rest";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import { html } from "hono/html";
import { NationStatesAPI } from "./nationstates";
import { metadata, type MetadataRecords } from "./metadata";
import { layout } from "./layout";

const app = new Hono();
const restBot = new REST({ hashLifetime: 60_000 }).setToken(
  process.env.DISCORD_TOKEN,
);
const discordBot = {
  restBot,
  roleConnections: new RoleConnectionsAPI(restBot),
};
const rest = new REST({ authPrefix: "Bearer", hashLifetime: 60_000 });
const discord = {
  rest,
  oauth2: new OAuth2API(rest),
  users: new UsersAPI(rest),
};
const nationstates = await NationStatesAPI.create(
  "discord-nationstates-role-connections/0.1.0 (by:Esfalsa)",
  process.env.NATIONSTATES_SECRET,
);
const storage = new Storage();

validateEnv();

await discordBot.roleConnections.updateMetadataRecords(
  process.env.DISCORD_CLIENT_ID,
  metadata,
);

app.use("/*", layout);

app.get("/", (c) => {
  return c.render(
    html`<h1>Discord NationStates Role Connections</h1>
      <p>
        To get started linking your NationStates nation to your Discord account,
        head <a href="./verify">here</a>.
      </p>`,
  );
});

app.get("/verify", async (c) => {
  const { nation } = c.req.query();

  if (!nation) {
    return c.render(
      html`<h1>Link Your NationStates Nation</h1>
        <form method="GET">
          <label for="nation">Nation</label>
          <input
            type="text"
            name="nation"
            id="nation"
            placeholder="Testlandia"
            required
          />
          <p>
            <button type="submit">Submit</button>
          </p>
        </form>`,
      {
        title: "Link Your NationStates Nation",
      },
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

  return c.render(
    html`<h1>Link Your NationStates Nation</h1>
      <form method="POST">
        <label for="nation">Nation</label>
        <input
          type="text"
          id="nation"
          name="nation"
          required
          value="${nation}"
        />

        <label for="checksum">Checksum</label>
        <input type="text" id="checksum" name="checksum" required />

        <p>
          To find your checksum, open
          <a target="_blank" rel="noopener noreferrer" href="${verificationURL}"
            >this page</a
          >
          and copy-paste the verification code. This is a one-time use link.
        </p>

        <button type="submit">Submit</button>
      </form>`,
    { title: "Link Your NationStates Nation" },
  );
});

app.post("/verify", async (c) => {
  const contentType = c.req.header("content-type");
  if (contentType !== "application/x-www-form-urlencoded") {
    return c.render(
      html`<h1>An Error Occurred</h1>
        <p>Invalid content type</p>`,
      { title: "Invalid content type", status: 415 },
    );
  }

  const { nation, checksum } = await c.req.parseBody();
  if (!nation || !checksum) {
    return c.render(
      html`<h1>An Error Occurred</h1>
        <p>Missing nation or checksum</p>`,
      { title: "Missing nation or checksum", status: 400 },
    );
  }
  if (typeof nation !== "string" || typeof checksum !== "string") {
    return c.render(
      html`<h1>An Error Occurred</h1>
        <p>Invalid nation or checksum</p>`,
      { title: "Invalid nation or checksum", status: 400 },
    );
  }

  const token = await getSignedCookie(c, process.env.COOKIE_SECRET, "nsToken");
  if (!token) {
    return c.render(
      html`<h1>An Error Occurred</h1>
        <p>Missing or invalid token</p>`,
      { title: "Missing or invalid token", status: 403 },
    );
  }

  const verification = await nationstates.verify(nation, checksum, token);
  if (!verification.success) {
    return c.render(
      html`<h1>An Error Occurred</h1>
        <p>NationStates verification failed</p>`,
      { title: "NationStates verification failed", status: 403 },
    );
  }

  const state = crypto.randomUUID();
  storage.prune();
  storage.setStateData(state, {
    nation,
    waMember: verification.waMember,
    population: verification.population,
    founded: verification.founded,
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
    return c.render(
      html`<h1>An Error Occurred</h1>
        <p>Missing authorization code</p>`,
      { title: "Missing authorization code", status: 400 },
    );
  }

  const state = c.req.query("state");
  if (!state) {
    return c.render(
      html`<h1>An Error Occurred</h1>
        <p>Missing state</p>`,
      { title: "Missing state", status: 400 },
    );
  }

  const clientState = await getSignedCookie(
    c,
    process.env.COOKIE_SECRET,
    "clientState",
  );
  if (clientState !== state) {
    return c.render(
      html`<h1>An Error Occurred</h1>
        <p>State verification failed</p>`,
      { title: "State verification failed", status: 403 },
    );
  }

  const res = await discord.oauth2.tokenExchange({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    code,
    grant_type: "authorization_code",
  });

  discord.rest.setToken(res.access_token);

  const data = storage.getStateData(state);
  storage.deleteStateData(state);

  discord.users.updateApplicationRoleConnection(process.env.DISCORD_CLIENT_ID, {
    platform_name: "NationStates",
    platform_username: data.nation,
    metadata: {
      date_founded:
        typeof data.founded === "string" ?
          data.founded
        : new Date(data.founded * 1000).toISOString(),
      population: data.population.toString(),
      wa_member: data.waMember.toString(),
    } satisfies MetadataRecords,
  });

  return c.render(
    html`<h1>Role Linked Successfully</h1>
      <p>
        Your NationStates nation has been linked to your Discord account, and
        the information associated with your Discord account has been updated.
        You can now return to Discord. You may still need to link any roles
        requiring a NationStates connection.
      </p>`,
  );
});

const port = Number(process.env.PORT || 3000);
serve({ fetch: app.fetch, port });
console.log(`Server started at http://localhost:${port}/`);
