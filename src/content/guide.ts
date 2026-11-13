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
    intro: "Everything in the app follows one path. The bar at the top of each screen shows the five steps, what is done, and what comes next.",
    steps: [
      "Who I am. Claim your identity in an I am statement and choose how big a change it is.",
      "FORGE identity. Write one I am statement for each letter, describing the person you are choosing to become. Then put them together in your FORGE statement.",
      "Where I am. Score the five pillars to see how close you are today, and pick one pillar to work on.",
      "My road. Discipline by Design turns that identity into practice: the routines, people and accountability that reinforce who you are.",
      "30 days. Practice one behavior for 30 days with a two-minute daily check-in. On day 30, decide what comes next.",
    ],
    note: "Every step can be skipped and finished later. The bar keeps track for you.",
  },
  {
    id: "first",
    title: "Your first session",
    time: "About 15 minutes, one time",
    intro: "After you pick your pathway, the app walks you through the five steps one screen at a time. Your coach can also go through it with you.",
    steps: [
      "Claim who you are. Finish the I am statement and choose how big a change it is.",
      "Write your FORGE identity. Start with F. You can finish the others during your first week.",
      "Take the FORGE assessment, then pick one pillar to work on first.",
      "Add one routine and one person who will know whether you did it.",
      "Choose one behavior and start your 30 days.",
    ],
    note: "You can skip any step and come back. Tap the next step in the bar at the top of the screen to pick up where you left off.",
    link: { href: "/start", label: "Open your first session" },
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
    title: "Your FORGE plan",
    time: "10 to 15 minutes, then a quick look each week",
    intro: "Your plan starts with who you are. Claim it in identity shift first, then write your FORGE identity: one I am statement for each letter.",
    steps: [
      "Answer the question for each letter. F: who am I becoming? O: what does someone with my identity pay attention to? R: what makes this identity meaningful to me? G: who am I when I encounter my limitations? E: who am I when emotions challenge my identity?",
      "Describe who you are. Habits and tasks go in your blueprint, where the identity turns into practice.",
      "Each statement starts with I am. The examples show the idea. They are not answers to copy. If the AI companion is on, Help me find this works like an identity coach. It tells you whether what you wrote is a goal, a habit, a value or an identity, and asks a question to help you find the identity under it.",
      "Tap Put my five statements together to start your FORGE statement, then edit it into one paragraph that sounds like you.",
      "Read your FORGE statement at the start of each week.",
    ],
    link: { href: "/plan", label: "Open your FORGE plan" },
  },
  {
    id: "blueprint",
    title: "Your blueprint and your people",
    time: "10 minutes to set up",
    intro: "The blueprint is where your FORGE identity turns into practice. It covers your one move this week, your routines, your weekly planning, your learning, and the people around you.",
    steps: [
      "Under One move this week, open your focus pillar and pick one move. Tap a suggestion or write your own. Open the other pillars when you are ready for them.",
      "In blueprint, open an area and tap Add to this area. Pick a suggestion or write your own, then choose the days and a time.",
      "In the My people card, tap Add next to a role. Start with an accountability partner.",
      "For each person, choose how often you will check in.",
      "After you talk with someone, open People and log the check-in. It takes a few seconds.",
    ],
    note: "The people you add do not see your records. They only see that you added them, and only if you send them an invitation link.",
    link: { href: "/blueprint", label: "Open your blueprint" },
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
      "Check the blueprint commitments you kept this week.",
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
      "Your private journal can never be shared. Coaches, administrators and the AI companion cannot read it.",
      "Your employer or program sponsor sees group totals only, such as attendance. They cannot open your records.",
      "You can turn any sharing switch off at any time.",
    ],
    link: { href: "/sharing", label: "Open Sharing" },
  },
  {
    id: "ai",
    title: "The AI companion",
    intro: "The AI companion is a chat assistant. It backs up your work with your human coach.",
    steps: [
      "Think it through helps you look at a decision, a habit, or something in your way.",
      "Practice a hard conversation lets you rehearse with a realistic partner and then get feedback.",
      "Prepare for coaching helps you get ready for your next session.",
      "It knows your goals, your FORGE scores and your current cycle. It cannot read your private journal.",
      "Your coach and your organization cannot see these conversations. They are deleted after 90 days, and you can change that in Settings.",
    ],
    note: "It is an AI. It is not a therapist and it does not diagnose. If something serious is going on, talk to your coach or a professional.",
    link: { href: "/companion", label: "Open the AI companion" },
  },
  {
    id: "identity",
    title: "Identity shift (optional)",
    intro: "Some people want to strengthen who they are. Some are stepping into a new role. Some want to reinvent how they show up. Identity shift lets you say which one fits, and the coaching adjusts.",
    steps: [
      "Open identity shift from your FORGE plan, your FORGE results, or More.",
      "Finish your I am statement, then answer two short questions: why now, and the behavior that would show it. Tap a starter if you want one.",
      "Read your statement out loud. It is in the present tense on purpose. You are claiming it.",
      "Tap each level on the spectrum to read about it, then choose one. No level ranks above another, and your FORGE scores do not decide it.",
      "At Level 3 you can create a performance identity: a name, standards and an activation cue you use to prepare for demanding situations. It is a practice tool and it is still you.",
      "Your FORGE plan, blueprint, 30-day cycle and daily check-in then show prompts that fit your level. Everything stays optional.",
      "You can change your level at any time. Earlier versions are kept.",
      "On the same page you choose the AI companion's tone, what it can use, and whether your coach can see your performance identity.",
    ],
    link: { href: "/identity", label: "Open identity shift" },
  },
  {
    id: "eqi",
    title: "EQ-i priorities (optional)",
    intro: "This part is for people who have taken the EQ-i 2.0 and had a debrief. If you have not, skip it.",
    steps: [
      "Open my pathway, then EQ-i priorities, and tap I have had my EQ-i debrief.",
      "Write one or two priorities from your debrief in your own words. Please do not copy your report.",
      "Pick the FORGE pillar each one connects to, and add a practice you will try.",
      "Use the buttons to start a 30-day cycle, add the practice to your blueprint, or share the priority with your coach.",
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
      "A new client shows 0 of 8 areas shared. Ask them to open Sharing and turn on what they want you to see.",
      "The eight areas are goals, FORGE scores, practice, reflections, blueprint, people, EQ-i priorities, and identity shift.",
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
    id: "identity",
    title: "Identity shift",
    steps: [
      "Clients choose their own level. You cannot set it for them.",
      "To suggest identity work, assign one of the identity shift exercises from the program list.",
      "You see a client's statement, level and behavior only if they turn on identity shift in Sharing. You see their performance identity only if they also tick that box.",
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
      "To turn the AI companion off for all users, remove ANTHROPIC_API_KEY in Vercel and redeploy.",
    ],
  },
];
