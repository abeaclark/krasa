export type OutcomeStep = 30 | 60 | 90;

export const OUTCOME_STEPS: OutcomeStep[] = [30, 60, 90];

/**
 * Which check-in, if any, is due for a lead right now.
 *
 * Pure so it can be tested without a database — the cron route is otherwise
 * untestable, and "who gets emailed" is exactly the logic you want covered.
 *
 * Returns the LARGEST step whose window has opened and which has not been sent.
 * That matters for a lead that predates this feature, or one the cron missed
 * for a week: they get the day-90 message once, not three emails in a row
 * catching up.
 */
export function dueOutcomeStep(
  daysSinceLetters: number,
  alreadySent: readonly number[],
): OutcomeStep | null {
  const due = OUTCOME_STEPS.filter(
    (s) => daysSinceLetters >= s && !alreadySent.includes(s),
  );
  return due.length > 0 ? due[due.length - 1] : null;
}
