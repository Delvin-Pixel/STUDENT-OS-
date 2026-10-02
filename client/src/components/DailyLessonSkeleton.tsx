import {
  Atom,
  BookOpen,
  Calculator,
  Dna,
  FlaskConical,
  Globe,
  Laptop,
  Microscope,
  Music,
  Palette,
} from "lucide-react";
import { useEffect, useState } from "react";

const MOTIVATORS = [
  "Gathering the best explanations for you…",
  "Your lesson is being crafted with care…",
  "Knowledge is brewing — almost ready…",
  "Preparing something worth learning…",
];

// Educational subject icons orbiting around the central book.
const ORBIT_ICONS = [
  Atom,
  FlaskConical,
  Calculator,
  Globe,
  Laptop,
  Dna,
  Music,
  Palette,
  Microscope,
];

function RotatingWord() {
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * MOTIVATORS.length)
  );
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFade(false);
      window.setTimeout(() => {
        setIndex(previous => (previous + 1) % MOTIVATORS.length);
        setFade(true);
      }, 400);
    }, 4200);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <p
      className={`h-6 transition-opacity duration-500 text-sm font-medium text-primary ${fade ? "opacity-100" : "opacity-0"}`}
      aria-live="polite"
    >
      {MOTIVATORS[index]}
    </p>
  );
}

/**
 * Educational loading scene shown while today's Daily Lesson generates.
 * A central open book gently floats while subject icons orbit it and soft
 * knowledge particles drift upward — an inspiring "learning is happening"
 * moment rather than a plain spinner or skeleton. Respects reduced motion.
 */
export default function DailyLessonSkeleton({ topic }: { topic: string }) {
  return (
    <div
      className="overflow-hidden rounded-3xl border border-primary/15 bg-card shadow-sm"
      role="status"
      aria-label={`Preparing today's lesson about ${topic}`}
    >
      <div className="relative overflow-hidden px-5 py-8 text-center">
        {/* Soft knowledge glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,140,80,0.4), rgba(190,90,200,0.3))",
          }}
          aria-hidden="true"
        />

        {/* Orbiting subject icons */}
        <div className="relative mx-auto h-28 w-28" aria-hidden="true">
          <div className="lesson-orbit absolute inset-0 rounded-full border border-dashed border-primary/25" />
          {ORBIT_ICONS.map((Icon, index) => (
            <span
              key={index}
              className="absolute left-1/2 top-1/2"
              style={{
                transform: `rotate(${(index * 360) / ORBIT_ICONS.length}deg) translateY(-54px)`,
              }}
            >
              <span
                className="lesson-orbit-reverse grid h-8 w-8 place-items-center rounded-full bg-background text-primary shadow-sm"
                style={{
                  transform: `rotate(-${(index * 360) / ORBIT_ICONS.length}deg)`,
                }}
              >
                <Icon className="h-4 w-4" />
              </span>
            </span>
          ))}
          {/* Central floating book */}
          <span className="lesson-float absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-fuchsia-600 text-white shadow-lg">
            <BookOpen className="h-7 w-7" />
          </span>
        </div>

        <h2 className="mt-5 font-display text-lg font-bold">
          Preparing today&apos;s lesson
        </h2>
        <p className="mx-auto mt-1 max-w-[22rem] text-xs text-muted-foreground">
          Exploring <strong className="text-foreground">{topic}</strong> for
          your level — explanations, key ideas and visual aids are on the way.
        </p>
        <div className="mt-4 flex justify-center">
          <RotatingWord />
        </div>

        {/* Rising knowledge particles */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <span
              key={index}
              className="particle-drift absolute bottom-0 rounded-full bg-primary/25"
              style={{
                left: `${12 + index * 14}%`,
                width: `${4 + (index % 3) * 2}px`,
                height: `${4 + (index % 3) * 2}px`,
                animationDelay: `${index * 0.7}s`,
                animationDuration: `${4 + (index % 3)}s`,
              }}
            />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
