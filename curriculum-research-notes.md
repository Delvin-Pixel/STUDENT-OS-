# Daily Lessons Curriculum Research Notes

Research completed internally on 12 August 2026 to ground Student OS lesson selection.

| Source                                                                                                                                                                | Findings used in the implementation                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UK Department for Education, [Key stage 3 and 4 curriculum](https://www.gov.uk/national-curriculum/key-stage-3-and-4)                                                 | Maths, science, and computing are core/foundation secondary subjects alongside English, humanities, languages, arts, and technology. This supports a broad subject selector rather than a single academic track. |
| UK Department for Education, [Computing programmes of study](https://www.gov.uk/government/publications/national-curriculum-in-england-computing-programmes-of-study) | Computing is a statutory programme of study through key stages 1–4, supporting a computing taxonomy centred on algorithms, programming, data, networks, and digital responsibility.                              |

## Design implications

Student OS uses a level-aware topic taxonomy for fast, predictable lesson selection. The server-side AI generator receives the student-selected subject, education level, and topic seed; it must adapt the explanation and examples while making clear that the lesson is a study aid rather than a substitute for the learner's local syllabus or teacher guidance.
