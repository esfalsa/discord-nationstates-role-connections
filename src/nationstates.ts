import { type webcrypto } from "node:crypto";

export class NationStatesAPI {
  private userAgent: string;
  private key: webcrypto.CryptoKey;

  static baseURL = "https://www.nationstates.net/cgi-bin/api.cgi";

  private constructor(userAgent: string, key: webcrypto.CryptoKey) {
    this.userAgent = userAgent;
    this.key = key;
  }

  static async create(userAgent: string, secret: string) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" } satisfies webcrypto.HmacImportParams,
      false,
      ["sign"],
    );
    return new NationStatesAPI(userAgent, key);
  }

  async generateToken(nation: string) {
    const signature = await crypto.subtle.sign(
      "HMAC",
      this.key,
      new TextEncoder().encode(nation.toLowerCase() + Date.now().toString()),
    );
    return Buffer.from(signature).toString("base64");
  }

  /**
   * Generates the verification URL for a nation to visit
   * @param nation the nation to verify
   * @returns the URL to verify the nation
   */
  generateVerificationURL(token: string) {
    const endpoint = new URL("https://www.nationstates.net/page=verify_login");
    endpoint.search = new URLSearchParams({ token }).toString();
    return endpoint;
  }

  async verify(nation: string, checksum: string, token: string) {
    const endpoint = new URL(NationStatesAPI.baseURL);
    endpoint.search = new URLSearchParams({
      a: "verify",
      nation,
      checksum,
      token,
      q: ["name", "wa", "population", "firstlogin"].join("+"),
    }).toString();
    const res = await fetch(endpoint, {
      headers: {
        "User-Agent": this.userAgent,
      },
    });
    const text = await res.text();

    if (text.includes("<VERIFY>1</VERIFY>") && text.includes("<NAME>")) {
      return {
        success: true as const,
        name: text.match(/(?<=<NAME>).+(?=<\/NAME>)/)![0],
        waMember:
          text.match(/(?<=<UNSTATUS>).+(?=<\/UNSTATUS>)/)?.[0] !== "Non-member",
        population:
          Number(
            text.match(/(?<=<POPULATION>).+(?=<\/POPULATION>)/)?.[0] ?? "0",
          ) * 1_000_000,
        founded:
          Number(text.match(/(?<=<FIRSTLOGIN>).+(?=<\/FIRSTLOGIN>)/)?.[0]) ||
          "Antiquity",
      };
    } else {
      return { success: false as const };
    }
  }
}
