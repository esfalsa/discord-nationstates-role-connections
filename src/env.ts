import { type ZodError, z } from "zod";

export const envSchema = z.object({
  DISCORD_TOKEN: z.string(),
  DISCORD_CLIENT_ID: z.string(),
  DISCORD_CLIENT_SECRET: z.string(),
  DISCORD_REDIRECT_URI: z.string(),
  COOKIE_SECRET: z.string(),
  LOCALTUNNEL_SUBDOMAIN: z.string(),
  NATIONSTATES_SECRET: z.string(),
});

export function validateEnv() {
  try {
    envSchema.parse(process.env);
  } catch (e) {
    const error = e as ZodError;
    throw new Error(
      `Environment validation failed: missing variable(s) ${error.errors.map((e) => e.path.join("."))}`,
      {
        cause: error,
      },
    );
  }
}
