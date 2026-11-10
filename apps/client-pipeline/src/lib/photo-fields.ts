/**
 * The names of the fields of a photo's JSON file that the pipeline reads or writes by name. The photo
 * files are read untyped, so use these instead of typing a field's name again. The fields themselves are
 * defined by the backend (`newPhotoJSON`), and the portfolio reads them as `PhotoData`.
 */

/** The photo JSON field that holds the photo's title. */
export const TITLE = "title";

/** The photo JSON field that holds the photo's file name, such as `DSCF0001.jpg`. */
export const FILE = "file";

/** The photo JSON field that holds the date and time the photo was taken, from its EXIF. */
export const CREATE_DATE = "createDate";

/** The JSON field the fixed time is written to; the EXIF `createDate` is kept as it is. */
export const CUSTOM_DATE = "customCreateDate";

/** The photo JSON field that holds the day the photo was added, as a date. */
export const ADDED_DATE = "addedDate";

/** The photo JSON field that holds where the photo was taken, from its EXIF GPS position. */
export const GPS_POSITION = "gpsPosition";

/** The photo JSON field that holds the GPS position chosen on the Photo page, which wins over the EXIF one. */
export const CUSTOM_GPS_POSITION = "customGpsPosition";

/** The photo JSON field naming the custom lens chosen for the photo on the Photo page, by its ID. */
export const CUSTOM_LENS = "customLens";

/** The photo JSON field that holds the day a photo is posted, as YYYY-MM-DD. */
export const PUBLISH_DATE = "socialMediaPublishDate";

/**
 * The photo JSON field that holds its focus point and placement for each spotlight zone, by zone
 * ID, such as `{ "grid-header": { "focus": { "x": 30, "y": 70 }, "placement": null } }`.
 */
export const SPOTLIGHT_ZONE_FOCUS = "spotlightZoneFocus";

/** The photo JSON field naming the compare group a photo is in, or left out (or `null`) when it's in none. */
export const COMPARE_GROUP = "compareGroup";

/** The photo JSON field marking a photo picked as one of its compare group's winners: `true`, or left out. */
export const COMPARE_WINNER = "compareWinner";

/** The photo JSON field marking a photo as not chosen in a compare group, or left out (or `null`). */
export const UNSELECTED = "unselected";

/** The photo JSON field marking a photo as Undecided: `true`, or left out (or `null`) when it isn't. */
export const UNDECIDED = "undecided";

/**
 * The photo JSON field marking a Grid Anchor on the Instagram calendar: `true`, or left out (or
 * `null`). The anchor and the photos just before it on the calendar make one row of the feed.
 */
export const GRID_ANCHOR = "socialGridAnchor";
