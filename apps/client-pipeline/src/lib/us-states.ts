import type { CaptionValues } from "@/lib/caption-template";

/** Each US state, and Washington, D.C., by its name, with its standard two-letter abbreviation. */
const US_STATES: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  "District of Columbia": "DC",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "Washington, D.C.": "DC",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
};

/** The state placeholders, in each way they're written, and the custom state field. */
const STATE_KEYS = ["state", "stateLocal", "stateRomanized", "stateLocalized", "customState"];

/** The state's standard abbreviation when it's a US state written out, such as CA for California; else the name as it is. */
export function stateAbbreviation(name: string): string {
  return US_STATES[name.trim()] ?? name;
}

/** The values with each US state written out in a state placeholder swapped for its abbreviation. */
export function withStateAbbreviations(values: CaptionValues): CaptionValues {
  const out = { ...values };
  for (const key of STATE_KEYS) {
    if (out[key]) out[key] = stateAbbreviation(out[key]);
  }
  return out;
}
