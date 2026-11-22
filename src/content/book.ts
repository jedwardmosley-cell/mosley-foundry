/**
 * The book, for the light "read the book" nudges around the app.
 * DRAFT FOR AUTHOR REVIEW: the wording below. Written to fit readers who own the book and readers
 * who don't yet. The link is the author's Amazon link. With no link the nudges show as plain text.
 */
export const BOOK = {
  title: "Both Hands on the Wheel",
  author: "Jason Mosley",
  url: "https://a.co/d/00SJkS0r",
};

/** The book behind each edition. The Renewal link is empty until the author adds one; the nudges then show plain text. */
export const BOOKS: Record<string, { title: string; author: string; url: string }> = {
  BOTH_HANDS: BOOK,
  RENEWAL: { title: "The Road to Renewal", author: "Jason Mosley", url: "" },
};
export const bookFor = (edition?: string | null) => BOOKS[edition ?? ""] ?? BOOK;

export const BOOK_NUDGES = {
  /** After a passage from the book. */
  passage: "There's more in the full chapter of",
  /** Road library and the end of the guided first session. */
  general: "The whole story behind FORGE is in",
  /** Day 30. */
  deeper: "Before your next 30 days, go deeper with",
};
