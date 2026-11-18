/**
 * The app's section names, from the book's chapters, so the app reads like the book.
 * Each one has a plain line underneath, so nobody needs the book to know what the section does.
 */
export const NAMES = {
  dashboard: { name: "The Dashboard", plain: "Today's check-in" },
  seat: { name: "The Driver's Seat", plain: "Who you are behind the wheel" },
  rules: { name: "The Rules of the Road", plain: "Where you are today on the five rules" },
  windshield: { name: "The Windshield", plain: "What you're working on, out ahead of you" },
  controls: { name: "The Vehicle Controls", plain: "What keeps you on course: your routines, your planning time and your people" },
  tone: { name: "Set the Tone", plain: "How you talk to yourself and to others" },
  glovebox: { name: "The Glove Box", plain: "Your power statements, kept within reach" },
  mirrors: { name: "The Mirrors", plain: "Look back at your week and plan the next one" },
  alignment: { name: "Wheel Alignment", plain: "Day 30: decide what comes next" },
  kickoff: { name: "Getting in the Driver's Seat", plain: "Setting up, four steps" },
} as const;
