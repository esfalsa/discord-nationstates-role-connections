# Discord NationStates Role Connections

Link Discord and NationStates with a custom [connection](https://support.discord.com/hc/en-us/articles/8063233404823-Connections-Linked-Roles-Community-Members).

## Developing

To start an auto-reloading development server, clone the repository and run `pnpm dev`:

```sh
git clone https://github.com/esfalsa/discord-nationstates-role-connections.git
cd discord-nationstates-role-connections
pnpm install
pnpm dev
```

You can optionally also set `LOCALTUNNEL_SUBDOMAIN` and use `pnpm tunnel` during development to request a specific domain from [Localtunnel](https://github.com/localtunnel/localtunnel), a free service to proxy web traffic to a service running locally on your server. This is only useful if you want to test the application with another user. While Discord's [official example](https://github.com/discord/linked-roles-sample) for a linked role app claims you need a public endpoint, if you're just testing yourself, a localhost URL works fine.

## Deploying

### From source

```sh
git clone https://github.com/esfalsa/discord-nationstates-role-connections.git
cd discord-nationstates-role-connections
pnpm install
pnpm build
node --env-file=.env dist/index.mjs
```

### Docker

```sh
docker pull ghcr.io/esfalsa/discord-nationstates-role-connections:latest
docker run --env-file=.env -dp 3000:3000 discord-nationstates-role-connections
```

## Configuration

You will need to create a new application in the [Discord developer portal](https://discord.com/developers/applications), and set the linked roles verification URL to the path `/linked-role` on your domain. Then, set the following required environment variables:

```env
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=http://localhost:3000/discord-oauth-callback
COOKIE_SECRET=...
NATIONSTATES_SECRET=...
```

The `COOKIE_SECRET` is used to sign cookies generated by the application. The `NATIONSTATES_SECRET` is used to sign tokens generated for use with the [NationStates verification API](https://www.nationstates.net/pages/api.html#verification). For example, you can run `node -e 'console.log(crypto.randomUUID())'` to generate a version 4 UUID using a cryptographically secure random number generator.

Finally, add the path `/discord-oauth-callback` on your domain as an OAuth redirect URI.
