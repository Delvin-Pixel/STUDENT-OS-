/* STUDENT OS — Study Assistant (MVP: rule-based, keyword-matched responses).
   The reply resolver is a single function so a real AI API can be dropped in
   later without touching the chat UI. */

export interface AssistantReply {
  text: string;
  action?: { label: string; route: string };
}

interface Rule {
  keywords: string[];
  reply: AssistantReply;
}

const RULES: Rule[] = [
  {
    keywords: ["concentrate", "focus", "distract", "can't focus", "attention"],
    reply: {
      text: "Try a 25-minute focus session: put your phone in another room, close extra tabs, and pick ONE specific task. When your mind wanders, note the thought and gently return — don't fight it. The Focus Timer in your app will run the session for you.",
      action: { label: "Start a focus session", route: "/focus" },
    },
  },
  {
    keywords: [
      "revise",
      "revision",
      "how should i",
      "how to study",
      "study method",
    ],
    reply: {
      text: "Use active recall instead of re-reading: close your notes and try to explain the topic out loud, then check what you missed. Follow it with spaced practice — revisit the topic after 1 day, 3 days, then 1 week. Flashcards are perfect for this.",
      action: { label: "Open Flashcards", route: "/flashcards" },
    },
  },
  {
    keywords: ["physics"],
    reply: {
      text: "For Physics: start by identifying weak topics, review the key concepts and formulas, then solve practice questions without looking at your notes. Derive formulas from scratch at least once — understanding beats memorising.",
    },
  },
  {
    keywords: ["math", "maths", "mathematics", "equation", "algebra"],
    reply: {
      text: "For Maths, practice beats theory every time. Work through problems in increasing difficulty, and when you get stuck, write down exactly which step confuses you — that's your revision target. Do mixed practice sets so you also learn to identify which method to use.",
    },
  },
  {
    keywords: ["chemistry", "biology", "science"],
    reply: {
      text: "For Sciences: build concept maps linking topics together, memorise with flashcards for definitions and reactions, and practise past-paper questions under timed conditions. Explain diagrams out loud as if teaching a friend.",
    },
  },
  {
    keywords: [
      "procrastinat",
      "don't want to",
      "lazy",
      "motivat",
      "no energy",
      "tired",
    ],
    reply: {
      text: "Motivation follows action, not the other way around. Commit to just 5 minutes — starting is the hardest part. Also check the basics: sleep, water, a quick walk. 'One session away from your streak' beats 'I need to be perfect'.",
      action: { label: "Start small with Focus", route: "/focus" },
    },
  },
  {
    keywords: ["exam", "test", "upcoming"],
    reply: {
      text: "Work backwards from the exam date: list every topic, mark your confidence for each, and schedule weakest topics first when your energy is highest. Add your exams in the Exam Centre so your plan and countdown stay automatic.",
      action: { label: "Open Exam Centre", route: "/exams" },
    },
  },
  {
    keywords: ["time", "schedule", "plan", "organise", "organize"],
    reply: {
      text: "Time-block your day: fixed classes first, then your 2-3 most important study blocks, then everything else. Use the Smart Planner in Study to generate a realistic weekly plan from your exam dates and available hours.",
      action: { label: "Open Study Planner", route: "/study" },
    },
  },
  {
    keywords: [
      "flashcard",
      "cards",
      "remember",
      "memory",
      "memorise",
      "memorize",
    ],
    reply: {
      text: "Flashcards work best when the front asks a genuine question, not just a heading. Keep cards short (one fact each), and mark hard cards 'difficult' so they come back more often. Even 10 cards a day compounds fast.",
      action: { label: "Create a deck", route: "/flashcards" },
    },
  },
  {
    keywords: ["money", "budget", "allowance", "spend", "saving"],
    reply: {
      text: "Track every expense for one week — most students are surprised where money leaks. Then set simple caps for food, transport and entertainment in the Budget tab, and check your remaining balance before non-essential spending.",
      action: { label: "Open Budget", route: "/budget" },
    },
  },
  {
    keywords: ["sleep", "night", "morning", "early"],
    reply: {
      text: "Consistent sleep is the cheapest performance upgrade available. Aim for 7-9 hours, keep a regular bedtime, and avoid screens 30 minutes before sleep. A well-rested brain learns in one hour what a tired one struggles through in three.",
    },
  },
  {
    keywords: ["stress", "anxious", "anxiety", "worried", "overwhelm"],
    reply: {
      text: "When everything feels like too much, write it all down, then sort into 'today' and 'this week'. Tackle today's list only. Break big items into 25-minute chunks. And breathe — done is better than perfect, every single time.",
      action: { label: "Plan my tasks", route: "/tasks" },
    },
  },
  {
    keywords: ["note", "notes", "summary", "summarise", "summarize"],
    reply: {
      text: "Take notes in your own words, not the textbook's. The Cornell method works well: main notes on the right, keywords and questions on the left, a 2-line summary at the bottom. Review the summary within 24 hours of class.",
    },
  },
  {
    keywords: ["group", "study together", "partner"],
    reply: {
      text: "Study groups work when everyone prepares first and the session is for explaining and quizzing — not passive reading together. Set an agenda before you meet, and cap the session at 90 minutes.",
    },
  },
  {
    keywords: ["hello", "hi", "hey", "help"],
    reply: {
      text: "Hey there! I can help with study tips, revision strategies, focus advice, and planning. Try asking things like 'How should I revise?' or 'I can't concentrate' and I'll point you in the right direction.",
    },
  },
];

export function getAssistantReply(message: string): AssistantReply {
  const lower = message.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some(k => lower.includes(k))) return rule.reply;
  }
  const fallbacks = [
    "That's a good question. Tell me more — is it about concentrating, revising a subject, planning your time, or preparing for an exam?",
    "I'm not sure about that one, but here's a general tip: the most effective study is active — testing yourself beats re-reading, and short daily sessions beat rare marathon ones.",
    "Hmm, try rephrasing that. You can ask me about focus, revision methods, specific subjects, exams, time management, or budgeting.",
  ];
  return { text: fallbacks[Math.floor(Math.random() * fallbacks.length)] };
}
