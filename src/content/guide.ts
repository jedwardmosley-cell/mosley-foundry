/**
 * IN-APP GUIDE: DRAFT FOR AUTHOR REVIEW.
 *
 * How-to text for each role, written by the build team in the author's plain style.
 * It describes how the app works. It is not book or workbook content.
 * To approve it, change GUIDE_STATUS to "approved". To edit, change the text here.
 */
export const GUIDE_STATUS: "draft" | "approved" = "draft";

export type GuideSection = {
  id: string;
  title: string;
  time?: string;
  intro?: string;
  steps: string[];
  note?: string;
  link?: { href: string; label: string };
};

export const CLIENT_GUIDE: GuideSection[] = [
  {
    id: "first",
    title: "Your first 10 minutes",
    time: "10 minutes, one time",
    steps: [
      "Pick the pathway that fits you: Personal Leadership, Leading Others, or Entrepreneurial Leadership. You can change it later.",
      "Take the FORGE assessment. Tap a score from 1 to 5 for each of the five pillars. The short descriptions under each pillar show what a 1, a 3 and a 5 look like.",
      "Read your results. The app shows your total, your lowest pillar, and what to work on for that score.",
      "Tap the button to make one pillar your development priority. Start with one.",
    ],
    note: "Score what you do today. A 3 is a fine place to start.",
    link: { href: "/assessment", label: "Open the FORGE assessment" },
  },
  {
    id: "daily",
    title: "Your daily two minutes",
    time: "2 minutes a day",
    steps: [
      "Open the Today screen. It shows where you are going, what you are working on, and your practice for today.",
      "Tap Done, Partial or Not yet.",
      "If you like, tap where it showed up, such as in a meeting or at home.",
      "Add a note or a reflection only when you have something to say.",
    ],
    note: "A missed day is just information. Log it and keep going.",
    link: { href: "/dashboard", label: "Open Today" },
  },
  {
    id: "plan",
    title: "Your FORGE Plan",
    time: "10 to 15 minutes, then a quick look each week",
    steps: [
      "Write your destination, your why, and your FORGE Statement. If the AI Companion is on, Help me write this gives you a first draft to edit.",
      "Open your priority pillar and pick one move for this week. Tap a suggestion or write your own.",
      "Open the other pillars later, when you are ready for them.",
      "Read your FORGE Statement at the start of each week.",
    ],
    link: { href: "/plan", label: "Open your FORGE Plan" },
  },
  {
    id: "blueprint",
    title: "Your Blueprint and your people",
    time: "10 minutes to set up",
    intro: "The Blueprint is where you design your week on purpose. It covers your routines, your weekly planning, your learning, and the people around you.",
    steps: [
      "In Blueprint, open an area and tap Add to this area. Pick a suggestion or write your own, then choose the days and a time.",
      "In the My people card, tap Add next to a role. Start with an accountability partner.",
      "For each person, choose how often you will check in.",
      "After you talk with someone, open People and log the check-in. It takes a few seconds.",
    ],
    note: "The people you add do not see your records. They only see that you added them, and only if you send them an invitation link.",
    link: { href: "/blueprint", label: "Open your Blueprint" },
  },
  {
    id: "cycle",
    title: "The 30-day cycle",
    time: "30 days, 2 minutes a day",
    steps: [
      "Tap Start a 30-day cycle. Choose one pillar and one behavior to work on.",
      "Each week has a focus. The Today screen shows the work for the week you are in.",
      "Log your practice each day from the Today screen.",
      "On day 28 the review opens. Decide whether to keep going on your own, go further with coaching, or start a new cycle.",
    ],
    link: { href: "/cycle", label: "Open your 30-day cycle" },
  },
  {
    id: "weekly",
    title: "Your weekly reflection",
    time: "5 minutes a week",
    steps: [
      "Answer one question first: did I do what I said I was going to do?",
      "Check the Blueprint commitments you kept this week.",
      "Write one line about what next week needs.",
    ],
    link: { href: "/reflect", label: "Open the weekly reflection" },
  },
  {
    id: "privacy",
    title: "What is private and what your coach sees",
    steps: [
      "Your coach sees nothing until you turn it on. Open Sharing and switch on the areas you want them to see.",
      "Your written reflections need two things: the Reflections switch, and a tick on each entry you want to share.",
      "Your Private Journal can never be shared. Coaches, administrators and the AI Companion cannot read it.",
      "Your employer or program sponsor sees group totals only, such as attendance. They cannot open your records.",
      "You can turn any sharing switch off at any time.",
    ],
    link: { href: "/sharing", label: "Open Sharing" },
  },
  {
    id: "ai",
    title: "The AI Companion",
    intro: "The AI Companion is a chat assistant. It backs up your work with your human coach.",
    steps: [
      "Think it through helps you look at a decision, a habit, or something in your way.",
      "Practice a hard conversation lets you rehearse with a realistic partner and then get feedback.",
      "Prepare for coaching helps you get ready for your next session.",
      "It knows your goals, your FORGE scores and your current cycle. It cannot read your Private Journal.",
      "Your coach and your organization cannot see these conversations. They are deleted after 90 days, and you can change that in Settings.",
    ],
    note: "It is an AI. It is not a therapist and it does not diagnose. If something serious is going on, talk to your coach or a professional.",
    link: { href: "/companion", label: "Open the AI Companion" },
  },
  {
    id: "eqi",
    title: "EQ-i priorities (optional)",
    intro: "This part is for people who have taken the EQ-i 2.0 and had a debrief. If you have not, skip it.",
    steps: [
      "Open My Pathway, then EQ-i priorities, and tap I have had my EQ-i debrief.",
      "Write one or two priorities from your debrief in your own words. Please do not copy your report.",
      "Pick the FORGE pillar each one connects to, and add a practice you will try.",
      "Use the buttons to start a 30-day cycle, add the practice to your Blueprint, or share the priority with your coach.",
    ],
    link: { href: "/pathway/eqi", label: "Open EQ-i priorities" },
  },
  {
    id: "account",
    title: "Your password and your records",
    steps: [
      "To change your password, tap Password at the top of the screen on a phone, or Change password in the sidebar on a computer.",
      "If you forget your password, ask your coach to reset it. You will pick a new one when you sign in.",
      "To keep a copy of your work, open History and tap Download development summary.",
    ],
    link: { href: "/history", label: "Open History" },
  },
];

export const COACH_GUIDE: GuideSection[] = [
  {
    id: "add-client",
    title: "Add a client",
    steps: [
      "Open My clients and enter the client's name and email. Tap Add client.",
      "If they are new, the app creates their account and shows a temporary password once. Copy it.",
      "Send the client the web address, their email, and the temporary password in a private message.",
      "The first time they sign in, they pick their own password.",
    ],
    note: "If the email already has an account, the person is added to your list and no new account is made.",
    link: { href: "/coach", label: "Open My clients" },
  },
  {
    id: "see",
    title: "What you can and cannot see",
    steps: [
      "A new client shows 0 of 7 areas shared. Ask them to open Sharing and turn on what they want you to see.",
      "The seven areas are goals, FORGE scores, practice, reflections, Blueprint, people, and EQ-i priorities.",
      "You see a written reflection only when the client marks that entry as shared.",
      "You cannot see a client's Private Journal or their AI conversations.",
      "The client page flags items for your attention, such as no check-ins this week or an overdue check-in with a mentor.",
    ],
  },
  {
    id: "work",
    title: "Exercises and sessions",
    steps: [
      "On a client's page, use Assign an exercise. Pick one from the book or workbook, or write your own.",
      "Use Schedule a session to set a date and an agenda. The client can add a prep note before you meet.",
      "After the session, write the agreed commitments. The client sees those. Your coach notes stay private to you.",
      "The client sees open exercises, the next session and the latest commitments in a From your coach box on their Today screen.",
    ],
  },
  {
    id: "eqi",
    title: "After an EQ-i debrief",
    steps: [
      "Ask the client to open EQ-i priorities and turn the section on.",
      "They write their priorities in their own words, link each one to a FORGE pillar, and tap Share with you.",
      "You can add your interpretation on the client's page. It goes back to the client to approve before you see it again.",
    ],
    note: "The app stores no EQ-i scores or reports.",
  },
  {
    id: "reset",
    title: "Reset a client's password",
    steps: [
      "Open the client's page and scroll to the bottom. Tap Reset password.",
      "Copy the new temporary password and send it to the client privately.",
      "The client is signed out, picks a new password at next sign-in, and is told that you reset it.",
    ],
    note: "Until the client signs in, that temporary password opens their account. Reset only when the client asks you to.",
  },
  {
    id: "stop",
    title: "Stop coaching someone",
    steps: [
      "Open the client's page, scroll to the bottom, and tap Stop coaching.",
      "They leave your list and what they shared with you is cleared. Their own records are kept.",
    ],
  },
];

export const ADMIN_GUIDE: GuideSection[] = [
  {
    id: "coach-too",
    title: "If you also coach",
    steps: [
      "On the Programs page, tap I also coach. You get the My clients and Cohorts screens.",
      "As a coach you see only what each client shares with you. Being the administrator adds no access to client records.",
    ],
    link: { href: "/admin", label: "Open Programs" },
  },
  {
    id: "cohort",
    title: "Run a Leading Others cohort",
    steps: [
      "On Programs, fill in New cohort. Choose three days or three weeks and the first session date.",
      "On the cohort page, edit the date, facilitator and location for each of the six sessions.",
      "Under Enroll, add each participant or facilitator by name and email. New people get a temporary password, shown once.",
      "In the Attendance table, tap a cell to mark present, absent or excused.",
      "In the Coach column, assign a coach to each participant.",
    ],
  },
  {
    id: "reports",
    title: "Reports",
    steps: [
      "Reports shows group totals: enrolled, attendance by session, completion, and activity in the 30 days after training.",
      "Percentages appear only for groups of 5 or more, so no single person can be picked out.",
      "Reports never include scores, reflections, journals, EQ-i priorities or coaching notes.",
    ],
    link: { href: "/admin/reports", label: "Open Reports" },
  },
  {
    id: "setup",
    title: "Site settings",
    steps: [
      "The launch checklist is at /setup. It shows whether the database, the content pack and the AI key are in place.",
      "To replace the book and workbook content, add SETUP_TOKEN back in Vercel, redeploy, and upload the two files at /setup.",
      "To turn the AI Companion off for all users, remove ANTHROPIC_API_KEY in Vercel and redeploy.",
    ],
  },
];
