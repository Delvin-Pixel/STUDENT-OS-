import type { EducationLevel } from "./types";

export type DailyTopic = {
  subject: string;
  branch: string;
  topic: string;
  key: string;
};

type TopicBranch = { branch: string; topics: string[] };

const TOPIC_MAP: Record<string, TopicBranch[]> = {
  mathematics: [
    {
      branch: "Number",
      topics: [
        "Fractions, decimals and percentages",
        "Ratio and proportion",
        "Powers and standard form",
      ],
    },
    {
      branch: "Algebra",
      topics: [
        "Simplifying expressions",
        "Solving linear equations",
        "Sequences and patterns",
      ],
    },
    {
      branch: "Geometry",
      topics: [
        "Angle relationships",
        "Perimeter, area and volume",
        "Pythagoras' theorem",
      ],
    },
    {
      branch: "Data and probability",
      topics: [
        "Interpreting data displays",
        "Averages and spread",
        "Probability experiments",
      ],
    },
  ],
  science: [
    {
      branch: "Biology",
      topics: [
        "Cells and specialised cells",
        "Human body systems",
        "Ecosystems and food webs",
        "Inheritance and variation",
      ],
    },
    {
      branch: "Chemistry",
      topics: [
        "Particles and changes of state",
        "Atoms, elements and compounds",
        "Chemical reactions",
        "Acids, alkalis and salts",
      ],
    },
    {
      branch: "Physics",
      topics: [
        "Forces and motion",
        "Energy transfers",
        "Electric circuits",
        "Waves and sound",
      ],
    },
  ],
  "information technology": [
    {
      branch: "Programming",
      topics: [
        "Algorithms and decomposition",
        "Selection and iteration",
        "Variables and data types",
        "Debugging a program",
      ],
    },
    {
      branch: "Data and systems",
      topics: [
        "Binary and data representation",
        "Databases and data modelling",
        "Computer hardware and software",
      ],
    },
    {
      branch: "Networks and responsibility",
      topics: [
        "How networks communicate",
        "Cybersecurity basics",
        "Digital citizenship and privacy",
      ],
    },
  ],
  computing: [
    {
      branch: "Programming",
      topics: [
        "Algorithms and decomposition",
        "Selection and iteration",
        "Variables and data types",
        "Debugging a program",
      ],
    },
    {
      branch: "Data and systems",
      topics: [
        "Binary and data representation",
        "Databases and data modelling",
        "Computer hardware and software",
      ],
    },
    {
      branch: "Networks and responsibility",
      topics: [
        "How networks communicate",
        "Cybersecurity basics",
        "Digital citizenship and privacy",
      ],
    },
  ],
  english: [
    {
      branch: "Reading",
      topics: [
        "Inference from a text",
        "Language techniques",
        "Comparing viewpoints",
      ],
    },
    {
      branch: "Writing",
      topics: [
        "Building an effective paragraph",
        "Persuasive writing",
        "Planning a descriptive response",
      ],
    },
    {
      branch: "Grammar",
      topics: [
        "Sentence structure",
        "Punctuation for clarity",
        "Word classes and choices",
      ],
    },
  ],
  history: [
    {
      branch: "Historical enquiry",
      topics: [
        "Using evidence carefully",
        "Cause and consequence",
        "Change and continuity",
      ],
    },
    {
      branch: "Historical understanding",
      topics: [
        "Chronology and periodisation",
        "Interpretations of the past",
        "Significance in history",
      ],
    },
  ],
  geography: [
    {
      branch: "Physical geography",
      topics: [
        "Weather and climate",
        "Rivers and erosion",
        "Plate tectonics and hazards",
      ],
    },
    {
      branch: "Human geography",
      topics: [
        "Population change",
        "Urbanisation",
        "Development and inequality",
      ],
    },
    {
      branch: "Geographical skills",
      topics: [
        "Reading maps and scale",
        "Using data in geography",
        "Fieldwork enquiry",
      ],
    },
  ],
  economics: [
    {
      branch: "Economic foundations",
      topics: ["Scarcity and choice", "Supply and demand", "Opportunity cost"],
    },
    {
      branch: "Macroeconomics",
      topics: ["Inflation", "Economic growth", "Unemployment"],
    },
  ],
  business: [
    {
      branch: "Business foundations",
      topics: [
        "Business aims and stakeholders",
        "Market research",
        "Entrepreneurship",
      ],
    },
    {
      branch: "Business operations",
      topics: [
        "Marketing mix",
        "Finance and cash flow",
        "Operations management",
      ],
    },
  ],
};

function normalise(subject: string) {
  const key = subject.trim().toLocaleLowerCase();
  if (["math", "maths"].includes(key)) return "mathematics";
  if (["ict", "computer science"].includes(key))
    return "information technology";
  return key;
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function chooseDailyTopic(
  subjects: string[],
  educationLevel: EducationLevel,
  date: string,
  contextKey = ""
): DailyTopic | null {
  const choices = subjects.map(subject => subject.trim()).filter(Boolean);
  if (!choices.length) return null;
  const subject =
    choices[
      hash(`${date}:${educationLevel}:${contextKey}:subject`) % choices.length
    ];
  const branches = TOPIC_MAP[normalise(subject)] ?? [
    {
      branch: "Core concepts",
      topics: [
        "Key ideas and vocabulary",
        "Explaining a central process",
        "Applying knowledge to an example",
      ],
    },
    {
      branch: "Skills and application",
      topics: [
        "Problem solving with the topic",
        "Using evidence and examples",
        "Common misconceptions",
      ],
    },
  ];
  const branch =
    branches[hash(`${date}:${subject}:${contextKey}:branch`) % branches.length];
  const topic =
    branch.topics[
      hash(`${date}:${subject}:${branch.branch}:${contextKey}:topic`) %
        branch.topics.length
    ];
  return {
    subject,
    branch: branch.branch,
    topic,
    key: `${date}:${normalise(subject)}:${normalise(topic)}:${contextKey}`,
  };
}
