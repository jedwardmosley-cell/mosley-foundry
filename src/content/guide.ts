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
    id: "journey",
    title: "How it fits together",
    intro: "Everything in the app follows one path in two parts. FORGE is who is behind the wheel. Discipline by Design is how you drive. The bar at the top of each screen shows the four steps.",
    steps: [
      "The Driver's Seat (FORGE). Name the seat you're in and how big a turn this is, work through the five rules of FORGE, and say it as My statement.",
      "The Rules of the Road (FORGE). Where I am measures how close the driver you were this week is to the person in your own five lines.",
      "The Windshield (Discipline by Design). Choose one or two things to work on, each for 30 days, and set each one up with five short questions and who finds out.",
      "The Vehicle Controls (Discipline by Design). Add one routine that builds your focus into your week.",
    ],
    note: "Your daily check-in opens once all four steps are done. On day 30, you decide what comes next.",
  },
  {
    id: "first",
    title: "Your kickoff",
    time: "About 15 minutes, one time",
    intro: "After you pick your pathway, the app walks you through the four steps one screen at a time. Your coach can also go through it with you.",
    steps: [
      "The Driver's Seat, in three short parts: your seat and how big a turn, then the five rules of FORGE, then My statement. Start with F. You can finish the rest during your first week.",
      "Take Where I am to see how often you are the person in each of your lines.",
      "Choose your focus, answer five short questions about it, and say who finds out.",
      "Add one routine that builds your focus into your week.",
    ],
    note: "If you stop partway, the Dashboard and the bar at the top show the next step, so you can pick up where you left off.",
    link: { href: "/start", label: "Open your kickoff" },
  },
  {
    id: "identity",
    title: "The Driver's Seat",
    time: "10 to 15 minutes, then a look at the start of each week",
    intro: "The Driver's Seat is the FORGE framework applied to you: one identity, in one role, for this season.",
    steps: [
      "Which seat are you in? This is about me as a manager, a parent, an owner, or your own words. One seat for each 30 days. It can be a role you already have and want to go deeper in.",
      "How big a turn is this? Core alignment, role transition or reinvention. None ranks above another. You choose, and you can change it later.",
      "Work through the five rules of FORGE, each in your seat. Each one shows its rule from the book and what it shapes. Open What this means to read the rule, the research behind it and the questions to think through before you write.",
      "Each answer starts with I am and describes who you are. Habits and tasks go in the Vehicle Controls. If Help me with this is turned on, it tells you whether you wrote a goal, a habit, a value or an identity.",
      "Your statement starts from your five lines. Edit it into one paragraph that sounds like you. This is what the Dashboard shows. Read it out loud at the start of each week.",
      "With reinvention you can also create a performance identity, folded under that choice: a name, standards and an activation cue. It is a practice tool and it is still you.",
      "Earlier versions are kept. At the bottom you choose the tone for Help me with this, what it can use, and whether your coach can see your performance identity.",
    ],
    link: { href: "/identity", label: "Open the Driver's Seat" },
  },
  {
    id: "daily",
    title: "Your daily check-in",
    time: "A few taps a day",
    steps: [
      "Open the Dashboard. It shows where you are going, what you are working on, and your practice for today.",
      "Tap Done, Partial or Not yet.",
      "If you like, tap where it showed up, such as in a meeting or at home.",
      "Add a note or a reflection only when you have something to say.",
    ],
    note: "A missed day is just information. Log it and keep going.",
    link: { href: "/dashboard", label: "Open the Dashboard" },
  },
  {
    id: "road",
    title: "The Vehicle Controls",
    time: "10 minutes to set up",
    intro: "The Vehicle Controls are where your FORGE identity turns into practice. They cover your routines, your weekly planning, your learning, and the people around you.",
    steps: [
      "In the Vehicle Controls, open an area and tap Add to this area. Pick a suggestion or write your own, then choose the days and a time.",
      "In the My people card, tap Add next to a role. Start with an accountability partner.",
      "For each person, choose how often you will check in.",
      "After you talk with someone, open People and log the check-in. It takes a few seconds.",
    ],
    note: "The people you add do not see your records. They only see that you added them, and only if you send them an invitation link.",
    link: { href: "/road", label: "Open the Vehicle Controls" },
  },
  {
    id: "cycle",
    title: "30 days",
    time: "30 days, a few taps a day",
    steps: [
      "Tap Start my 30 days. Name your focus and the rule it builds. You can have one or two focuses at a time, and that's it.",
      "Each week has a focus. The Today screen shows the work for the week you are in.",
      "Log your practice each day from the Dashboard.",
      "On day 28 the review opens. Decide whether to keep going on your own, go further with coaching, or start new 30 days.",
    ],
    link: { href: "/cycle", label: "Open your 30 days" },
  },
  {
    id: "season",
    title: "Seasons: 90 days",
    time: "Three rounds of 30 days",
    steps: [
      "When you start your 30 days, tick Make this month 1 of a 90-day season.",
      "On day 30 of months 1 and 2, choose to go deeper on the same rule or move to another one. The next month starts from there.",
      "After month 3, open the season review. Take the self-assessment again to see your scores then and now, and read the I am statement you started with.",
      "Then decide: start a new season, keep going one month at a time, or take a break.",
    ],
    link: { href: "/season", label: "Open your season" },
  },
  {
    id: "weekly",
    title: "The Mirrors",
    time: "5 minutes a week",
    steps: [
      "Answer one question first: did I do what I said I was going to do?",
      "Check the commitments in the Vehicle Controls you kept this week.",
      "Write one line about what next week needs.",
    ],
    link: { href: "/reflect", label: "Open the Mirrors" },
  },
  {
    id: "privacy",
    title: "What is private and what your coach sees",
    steps: [
      "Your coach sees nothing until you turn it on. Open Sharing and switch on the areas you want them to see.",
      "Your written reflections need two things: the Reflections switch, and a tick on each entry you want to share.",
      "Your private journal can never be shared. Coaches, administrators and Help me with this cannot read it.",
      "Your employer or program sponsor sees group totals only, such as attendance. They cannot open your records.",
      "You can turn any sharing switch off at any time.",
    ],
    link: { href: "/sharing", label: "Open Sharing" },
  },
  {
    id: "ai",
    title: "Help me with this",
    intro: "Help me with this is a chat assistant. It backs up your work with your human coach.",
    steps: [
      "Think it through helps you look at a decision, a habit, or something in your way.",
      "Practice a hard conversation lets you rehearse with a realistic partner and then get feedback.",
      "Prepare for coaching helps you get ready for your next session.",
      "It knows your goals, your Where I am answers and your current cycle. It cannot read your private journal.",
      "Your coach and your organization cannot see these conversations. They are deleted after 90 days, and you can change that in Settings.",
    ],
    note: "It is an AI. It is not a therapist and it does not diagnose. If something serious is going on, talk to your coach or a professional.",
    link: { href: "/companion", label: "Open Help me with this" },
  },
  {
    id: "feedback",
    title: "My feedback (optional)",
    intro: "For people who have had a 360, such as a CCL 360, or an EQ-i 2.0 debrief. If you have not, skip it.",
    steps: [
      "Open the Rules of the Road, then My feedback, and tap Add feedback.",
      "Choose where it came from, then write your own summary, attach a file of your own notes, or both. Please don't upload the full report.",
      "Tag the FORGE rules it speaks to. Your results on the Rules of the Road will show it.",
      "Under What I'm working on from this, add one or two things in your own words. For each, pick a rule and a practice, then practice it for 30 days or add it to the Vehicle Controls. These are separate from your development priority, the one rule you pick after the assessment.",
      "Each entry is private. You choose whether your coach sees it, and whether Help me with this can read your summary. The AI never opens the file.",
    ],
    link: { href: "/feedback", label: "Open My feedback" },
  },
  {
    id: "account",
    title: "Your password and your records",
    steps: [
      "To change your password, tap Password at the top of the screen on a phone, or Change password in the sidebar on a computer.",
      "If you forget your password, tap Forgot your password? on the sign-in screen. We email you a link to pick a new one. You can also ask your coach to reset it.",
      "To keep a copy of your work, open History and tap Download development summary.",
      "To start over from the beginning, open Settings and use Start over at the bottom. It erases what you have entered and keeps your login, settings and coach. It cannot be undone, so download your summary first if you want a copy.",
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
      "A new client shows 0 of 8 areas shared. Ask them to open Sharing and turn on what they want you to see.",
      "Each area has its own switch: goals, Where I am, practice, reflections, the Vehicle Controls, people, what I'm working on from my feedback, My feedback, the Driver's Seat, and My 30-day plan.",
      "You see a written reflection only when the client marks that entry as shared.",
      "You cannot see a client's private journal or their AI conversations.",
      "The client page flags items for your attention, such as no check-ins this week or an overdue check-in with a mentor.",
    ],
  },
  {
    id: "work",
    title: "Exercises and sessions",
    steps: [
      "On a client's page, use Assign an exercise. Pick one from the program list, or write your own.",
      "Use Schedule a session to set a date and an agenda. The client can add a prep note before you meet.",
      "After the session, write the agreed commitments. The client sees those. Your coach notes stay private to you.",
      "The client sees open exercises, the next session and the latest commitments in a From your coach box on their Dashboard.",
    ],
  },
  {
    id: "seasons",
    title: "Seasons",
    steps: [
      "A season is three rounds of 30 days, about 90 days. The client starts it when they start their 30 days. It is ticked for them by default when they have a coach.",
      "On My clients you see Season month 2 of 3, Day 10 of 30 for clients who share their practice with you.",
      "At the end of a season the client reviews it: scores then and now, and their I am statement. Plan a session around that review.",
    ],
  },
  {
    id: "eqi",
    title: "After an EQ-i debrief",
    steps: [
      "Ask the client to open My feedback, under the Rules of the Road, and add their own summary of the debrief.",
      "Under What I'm working on from this, they add what they took from it in their own words, link each to a FORGE rule, and tap Share with you.",
      "You can add your interpretation on the client's page. It goes back to the client to approve before you see it again.",
    ],
    note: "The app stores no EQ-i scores or reports.",
  },
  {
    id: "identity",
    title: "The Driver's Seat",
    steps: [
      "Clients choose their own level. You cannot set it for them.",
      "To suggest identity work, assign one of the identity exercises from the program list.",
      "You see a client's statement, level and behavior only if they turn on the Driver's Seat in Sharing. You see their performance identity only if they also tick that box.",
      "You see how often they answered yes to showing up as who they are. Their written notes on that question stay private.",
    ],
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
      "Reports never include scores, reflections, journals, My feedback or coaching notes.",
    ],
    link: { href: "/admin/reports", label: "Open Reports" },
  },
  {
    id: "setup",
    title: "Site settings",
    steps: [
      "The launch checklist is at /setup. It shows whether the database, the content pack and the AI key are in place.",
      "To replace the book and workbook content, add SETUP_TOKEN back in Vercel, redeploy, and upload the two files at /setup.",
      "To turn Help me with this off for all users, remove ANTHROPIC_API_KEY in Vercel and redeploy.",
    ],
  },
];
