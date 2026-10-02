/* STUDENT OS — motivational quotes, rotated daily (day of year). */

export interface Quote {
  text: string;
  author: string;
}

export const QUOTES: Quote[] = [
  {
    text: "Small steps every day. Big things will follow.",
    author: "Student OS",
  },
  {
    text: "You don't have to be perfect. You have to be consistent.",
    author: "Student OS",
  },
  {
    text: "One more page, one more problem — that's how champions are built.",
    author: "Student OS",
  },
  { text: "Discipline today is freedom tomorrow.", author: "Student OS" },
  { text: "The expert in anything was once a beginner.", author: "Student OS" },
  {
    text: "Studying isn't punishment. It's preparation for a better you.",
    author: "Student OS",
  },
  {
    text: "Progress, not perfection, is the goal of every session.",
    author: "Student OS",
  },
  {
    text: "Your future self is watching what you do right now.",
    author: "Student OS",
  },
  {
    text: "Hard work beats talent when talent doesn't work hard.",
    author: "Student OS",
  },
  {
    text: "Every 25 minutes of focus buys back an hour of confidence.",
    author: "Student OS",
  },
  {
    text: "Don't count the days. Make the days count.",
    author: "Muhammad Ali",
  },
  {
    text: "It always seems impossible until it's done.",
    author: "Nelson Mandela",
  },
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
  },
  {
    text: "Success is the sum of small efforts repeated day in and day out.",
    author: "Robert Collier",
  },
  {
    text: "Education is the most powerful weapon you can use to change the world.",
    author: "Nelson Mandela",
  },
  {
    text: "The beautiful thing about learning is nobody can take it away from you.",
    author: "B.B. King",
  },
  {
    text: "Start where you are. Use what you have. Do what you can.",
    author: "Arthur Ashe",
  },
  { text: "You are stronger than your excuses.", author: "Student OS" },
  {
    text: "A river cuts through rock not by power, but by persistence.",
    author: "Student OS",
  },
  { text: "Today's effort is tomorrow's ease.", author: "Student OS" },
  { text: "Focus on progress, not perfection.", author: "Student OS" },
  {
    text: "You didn't come this far to only come this far.",
    author: "Student OS",
  },
  {
    text: "Every task you finish today is a brick in your future.",
    author: "Student OS",
  },
  {
    text: "Rest is part of the plan — so is starting again.",
    author: "Student OS",
  },
  { text: "Win the morning, win the day.", author: "Student OS" },
  {
    text: "Comparison is the thief of joy. Run your own race.",
    author: "Student OS",
  },
  {
    text: "Five minutes of starting beats an hour of worrying.",
    author: "Student OS",
  },
  {
    text: "Great things happen to those who don't stop believing.",
    author: "Student OS",
  },
  { text: "Knowledge is power. Practice is the key.", author: "Student OS" },
  {
    text: "Be patient with yourself. Growth is quiet before it is visible.",
    author: "Student OS",
  },
];

export function quoteForToday(): Quote {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return QUOTES[dayOfYear % QUOTES.length];
}
