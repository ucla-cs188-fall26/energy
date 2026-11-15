import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { EditScreen } from "@/components/EditScreen";
import { BodyDetails, BodyDetailsFields, useBodyDetailsForm } from "@/features/onboarding/components/BodyDetailsForm";
import { TextField } from "@/features/onboarding/components/TextField";
import { Sex, Units, useOnboardingStore } from "@/features/onboarding/store";
import { updateProfile, useMyProfile, useProfileSettings } from "@/features/profile/store";

const asSex = (v: string | null | undefined): Sex | null => (v === "female" || v === "male" ? v : null);
const asUnits = (v: string | null | undefined): Units => (v === "imperial" ? "imperial" : "metric");

/** Current saved values, falling back to onboarding answers that haven't synced yet. */
function useInitialDetails(): BodyDetails {
  const profile = useMyProfile();
  const onboarding = useOnboardingStore();
  if (profile) {
    return {
      sex: asSex(profile.sex),
      units: asUnits(profile.measurement_units),
      ageYears: profile.age_years,
      weightKg: profile.weight_kg,
      heightCm: profile.height_cm,
    };
  }
  if (onboarding.pendingSync) {
    const { sex, units, ageYears, weightKg, heightCm } = onboarding;
    return { sex, units, ageYears, weightKg, heightCm };
  }
  return { sex: null, units: "metric", ageYears: null, weightKg: null, heightCm: null };
}

export default function EditProfileScreen() {
  const initial = useInitialDetails();
  const { name: initialName } = useProfileSettings();
  const [name, setName] = useState(initialName ?? "");
  const form = useBodyDetailsForm(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim().replace(/\s+/g, " ");
  const { values } = form;
  const changed = trimmedName !== (initialName ?? "")
    || values.sex !== initial.sex || values.units !== initial.units
    || values.ageYears !== initial.ageYears || values.weightKg !== initial.weightKg
    || values.heightCm !== initial.heightCm;
  const nameError = !trimmedName && name.length > 0 ? "Enter your name." : null;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        display_name: trimmedName,
        sex: values.sex,
        measurement_units: values.units,
        age_years: values.ageYears,
        weight_kg: values.weightKg,
        height_cm: values.heightCm,
      });
      router.back();
    } catch (cause) {
      setError(cause instanceof Error && /sign in/i.test(cause.message)
        ? cause.message
        : "Couldn’t save your changes. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditScreen
      title="Edit profile"
      subtitle="Sex, age and body size help personalize your caffeine estimates."
      canSave={changed && form.valid && !!trimmedName}
      saving={saving}
      error={error}
      onSave={save}
    >
      <View style={styles.name}>
        <TextField label="Full name" placeholder="Alex Smith" value={name} onChangeText={setName}
          autoComplete="name" textContentType="name" autoCapitalize="words" maxLength={80}
          error={nameError} editable={!saving} />
      </View>
      <BodyDetailsFields form={form} />
    </EditScreen>
  );
}

const styles = StyleSheet.create({
  name: { marginBottom: 24 },
});
