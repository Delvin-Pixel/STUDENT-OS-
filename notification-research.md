# Learning-Notification Research

## Design patterns selected for Student OS

| Source                                                                                                                                            | Relevant pattern                                                                                                                                            | Student OS application                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Duolingo: How the Duolingo Owl Decides What Notification To Send](https://blog.duolingo.com/hi-its-duo-the-ai-behind-the-meme/)                  | Practice reminders are personalized to the learner and current streak. Message variants are rotated so learners do not repeatedly receive the same wording. | Use varied, positive reminder copy tied to a learner's planned work, progress, and streak. Avoid guilt-based wording and suppress duplicate reminders. |
| [Quizlet: Changing your notification preferences](https://help.quizlet.com/hc/en-us/articles/360043951051-Changing-your-notification-preferences) | Learners control study reminders, recommendations, and class-content alerts in notification settings.                                                       | Provide category-level controls for study plans, deadlines, focus timers, streaks, and lesson review alongside a master enable switch.                 |

## Product principles

- Notifications must be useful, respectful, and easy to tailor or pause.
- Relevance must take precedence over frequency: no duplicate alert for the same event, and no reminder after the learner has completed the relevant work.
- Personalization should use Student OS study data only and never reveal sensitive data on a locked screen.
