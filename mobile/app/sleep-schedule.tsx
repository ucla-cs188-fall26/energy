import { router } from "expo-router";
import { useState } from "react";

import { EditScreen } from "@/components/EditScreen";
import { SleepScheduleCard } from "@/features/onboarding/components/SleepScheduleCard";
import { sleepWindowMinutes, toApiTime } from "@/features/onboarding/store";
import { updateProfile, useProfileSettings } from "@/features/profile/store";

export default function SleepScheduleScreen() {
  const initial = useProfileSettings();
  const [schedule, setSchedule] = useState({
    bedtimeMinutes: initial.bedtimeMinutes,
    wakeMinutes: initial.wakeMinutes,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = schedule.bedtimeMinutes !== initial.bedtimeMinutes
    || schedule.wakeMinutes !== initial.wakeMinutes;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        usual_bedtime: toApiTime(schedule.bedtimeMinutes),
        usual_wake_time: toApiTime(schedule.wakeMinutes),
        sleep_goal_minutes: sleepWindowMinutes(schedule.bedtimeMinutes, schedule.wakeMinutes),
      });
      router.back();
    } catch (cause) {
      setError(cause instanceof Error && /sign in/i.test(cause.message)
        ? cause.message
        : "Couldn’t save your schedule. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditScreen
      title="Sleep schedule"
      subtitle="Your usual schedule helps estimate daily rhythm and caffeine at bedtime."
      canSave={changed}
      saving={saving}
      error={error}
      onSave={save}
    >
      <SleepScheduleCard
        bedtimeMinutes={schedule.bedtimeMinutes}
        wakeMinutes={schedule.wakeMinutes}
        onChange={setSchedule}
      />
    </EditScreen>
  );
}
