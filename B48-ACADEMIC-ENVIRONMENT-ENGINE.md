# B48 — Academic Environment Engine

Student OS now treats education level, class/year, academic year, programme/track and subject/course selection as one active academic context.

## Core behavior

- JHS, SHS and Tertiary are first-class environments.
- Entering at JHS 3 or SHS 2 does not reset the learner to an earlier year.
- SHS onboarding can capture a programme/track such as General Science.
- The environment exposes progression state (foundation, developing, terminal, tertiary) and curriculum depth.
- Daily lesson selection/cache identity includes the academic environment so a context change does not silently reuse a lesson generated for another stage.
- Daily lesson generation receives class and track context when available.

## Safety / truthfulness

The environment engine does not claim that a curated subject list is an official school catalogue. It also does not infer graduation from age alone. Graduation remains confirmation-gated through the Academic Journey engine.

## Next integration target

Connect the environment context to dashboard labels, AI tutor context, timetable/assessment presentation and curriculum packs without duplicating level-specific business rules throughout the UI.
