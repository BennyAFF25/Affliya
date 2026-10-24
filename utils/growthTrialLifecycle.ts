export type GrowthTrialReminderDay = 1 | 3 | 10 | 12;

/** Select a 24-hour milestone window and its offer-dependent variant. */
export function selectGrowthTrialReminder(ageDays: number, offerCount: number) {
  let day: GrowthTrialReminderDay;
  if (ageDays >= 1 && ageDays < 2 && offerCount === 0) day = 1;
  else if (ageDays >= 3 && ageDays < 4) day = 3;
  else if (ageDays >= 10 && ageDays < 11) day = 10;
  else if (ageDays >= 12 && ageDays < 13) day = 12;
  else return null;
  const noOffer = offerCount === 0 && (day === 1 || day === 3);
  const variant = `${day}${day === 3 && noOffer ? "-no-offer" : ""}`;
  const eventType = `growth_trial_reminder_day_${day}${day === 3 && noOffer ? "_no_offer" : ""}`;
  return {
    day, noOffer, variant, eventType,
    // Either day-three variant exhausts this milestone, even if offers change.
    dedupeEventTypes: day === 3
      ? ["growth_trial_reminder_day_3", "growth_trial_reminder_day_3_no_offer"]
      : [eventType],
  };
}

export function shouldAlertFounder(ageDays: number, offerCount: number) {
  return Number.isFinite(ageDays) && ageDays >= 2 / 24 && offerCount === 0;
}
