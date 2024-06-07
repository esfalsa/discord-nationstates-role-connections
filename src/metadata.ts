import {
  ApplicationRoleConnectionMetadataType,
  type APIApplicationRoleConnectionMetadata,
} from "@discordjs/core/http-only";

export const metadata = [
  {
    name: "Date Founded",
    description: "Minimum number of days since founding",
    key: "date_founded",
    type: ApplicationRoleConnectionMetadataType.DatetimeGreaterThanOrEqual,
  },
  {
    name: "WA Member",
    description: "Is a member of the World Assembly",
    key: "wa_member",
    type: ApplicationRoleConnectionMetadataType.BooleanEqual,
  },
  {
    name: "Population",
    description: "Minimum population",
    key: "population",
    type: ApplicationRoleConnectionMetadataType.IntegerGreaterThanOrEqual,
  },
] as const satisfies APIApplicationRoleConnectionMetadata[];

type MetadataKey = (typeof metadata)[number]["key"];

/**
 * An object mapping application role connection metadata keys to their value, for use in updating the metadata for a user.
 * @see {@link https://discord.com/developers/docs/resources/user#application-role-connection-object-application-role-connection-structure}
 */
export type MetadataRecords = {
  [key in MetadataKey]?: string;
};
