import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Segmented } from "@/features/onboarding/components/Segmented";
import { StepScreen, stepStyles } from "@/features/onboarding/components/StepScreen";
import { ERROR_COLOR, TextField } from "@/features/onboarding/components/TextField";
import { bmi, Sex, Units, useOnboardingStore } from "@/features/onboarding/store";
import { colors } from "@/utils/theme";

const SEXES: { value: Sex; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

const UNITS: { value: Units; label: string }[] = [
  { value: "metric", label: "kg · cm" },
  { value: "imperial", label: "lb · ft" },
];

// Accepted ranges, in metric. Must match the user_profiles check constraints.
const AGE = { min: 13, max: 120 };
const WEIGHT_KG = { min: 20, max: 400 };
const HEIGHT_CM = { min: 50, max: 272 };

const LB_PER_KG = 2.20462;
const CM_PER_IN = 2.54;

const goNext = () => router.push("/(auth)/signup");

/** Parses a positive number; "" → null (unanswered), garbage → NaN (invalid). */
function parse(text: string) {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const inRange = (n: number, r: { min: number; max: number }) => n >= r.min && n <= r.max;

function toImperialHeight(cm: number) {
  const totalIn = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(totalIn / 12), in: totalIn % 12 };
}

type Texts = { age: string; weight: string; heightCm: string; heightFt: string; heightIn: string };

function textsFor(units: Units, age: number | null, kg: number | null, cm: number | null): Texts {
  const imperial = cm != null ? toImperialHeight(cm) : null;
  return {
    age: age != null ? String(age) : "",
    weight: kg == null ? "" : String(units === "metric" ? round1(kg) : Math.round(kg * LB_PER_KG)),
    heightCm: cm != null ? String(round1(cm)) : "",
    heightFt: imperial ? String(imperial.ft) : "",
    heightIn: imperial ? String(imperial.in) : "",
  };
}

export default function AboutYouStep() {
  const { sex, units, ageYears, weightKg, heightCm, set } = useOnboardingStore();
  const [texts, setTexts] = useState<Texts>(() => textsFor(units, ageYears, weightKg, heightCm));

  // Derive metric values and validation from what's typed.
  const age = parse(texts.age);
  const weightRaw = parse(texts.weight);
  const kg = weightRaw == null ? null : units === "metric" ? weightRaw : weightRaw / LB_PER_KG;
  let cm: number | null;
  if (units === "metric") {
    cm = parse(texts.heightCm);
  } else {
    const ft = parse(texts.heightFt);
    // "0" inches is valid, so parse it separately from parse()'s positive-only rule.
    const inchesText = texts.heightIn.trim();
    const inches = inchesText ? Number(inchesText) : 0;
    cm = ft == null && !inchesText ? null
      : ft == null || Number.isNaN(ft) || !Number.isFinite(inches) || inches < 0 || inches >= 12 ? NaN
      : (ft * 12 + inches) * CM_PER_IN;
  }

  const ageError = age != null && (!Number.isInteger(age) || !inRange(age, AGE))
    ? `Enter an age from ${AGE.min} to ${AGE.max}.` : null;
  const weightError = kg != null && !inRange(kg, WEIGHT_KG)
    ? (units === "metric" ? `Enter a weight from ${WEIGHT_KG.min} to ${WEIGHT_KG.max} kg.` : "Enter a weight from 45 to 880 lb.")
    : null;
  const heightError = cm != null && !inRange(cm, HEIGHT_CM)
    ? (units === "metric" ? `Enter a height from ${HEIGHT_CM.min} to ${HEIGHT_CM.max} cm.` : "Enter feet, and inches from 0 to 11.")
    : null;
  const valid = !ageError && !weightError && !heightError;

  const update = (patch: Partial<Texts>) => setTexts((t) => ({ ...t, ...patch }));

  const save = () => {
    set({
      ageYears: age,
      weightKg: kg == null ? null : round1(kg),
      heightCm: cm == null ? null : round1(cm),
    });
    goNext();
  };

  const switchUnits = (next: Units) => {
    if (next === units) return;
    // Convert whatever valid values are typed so far into the new units.
    set({ units: next });
    setTexts(textsFor(next, age && !ageError ? age : null,
      kg && !weightError ? kg : null, cm && !heightError ? cm : null));
  };

  const score = valid ? bmi(kg, cm) : null;
  const category = score == null ? null
    : score < 18.5 ? "Below healthy range" : score < 25 ? "Healthy range" : "Above healthy range";

  return (
    <StepScreen
      step={4}
      title="A bit about you"
      subtitle="Sex, age and body size change how fast caffeine wears off."
      buttonTitle="Continue"
      canContinue={valid}
      onContinue={save}
      onSkip={() => { set({ sex: null, ageYears: null, weightKg: null, heightCm: null }); goNext(); }}
    >
      <Text style={stepStyles.fieldLabel}>Sex</Text>
      <View style={styles.sexRow} accessibilityRole="radiogroup">
        {SEXES.map((o) => {
          const checked = sex === o.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              onPress={() => set({ sex: checked ? null : o.value })}
              style={[styles.sexOption, checked && styles.sexChecked]}
            >
              <Text style={[styles.sexLabel, checked && styles.sexLabelChecked]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.units}>
        <Segmented accessibilityLabel="Units" options={UNITS} value={units} onChange={switchUnits} />
      </View>

      <View style={styles.row}>
        <TextField label="Age" containerStyle={styles.half} value={texts.age} suffix="years"
          keyboardType="number-pad" maxLength={3} error={ageError}
          onChangeText={(age) => update({ age })} />
        <TextField label="Weight" containerStyle={styles.half} value={texts.weight}
          suffix={units === "metric" ? "kg" : "lb"} keyboardType="decimal-pad" maxLength={5}
          error={weightError} onChangeText={(weight) => update({ weight })} />
      </View>

      {units === "metric" ? (
        <TextField label="Height" containerStyle={styles.field} value={texts.heightCm} suffix="cm"
          keyboardType="decimal-pad" maxLength={5} error={heightError}
          onChangeText={(heightCm) => update({ heightCm })} />
      ) : (
        <View>
          <View style={styles.row}>
            <TextField label="Height" accessibilityLabel="Height, feet" containerStyle={styles.half}
              value={texts.heightFt} suffix="ft" keyboardType="number-pad" maxLength={1}
              onChangeText={(heightFt) => update({ heightFt })} />
            <TextField label=" " accessibilityLabel="Height, inches" containerStyle={styles.half}
              value={texts.heightIn} suffix="in" keyboardType="number-pad" maxLength={2}
              onChangeText={(heightIn) => update({ heightIn })} />
          </View>
          {heightError ? <Text style={styles.error} accessibilityRole="alert">{heightError}</Text> : null}
        </View>
      )}

      {score != null ? (
        <View style={styles.bmi}>
          <View>
            <Text style={styles.bmiLabel}>Your BMI</Text>
            <Text style={styles.bmiValue}>{score.toFixed(1)}</Text>
          </View>
          <View style={styles.bmiBadge}>
            <Text style={styles.bmiBadgeText}>{category}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
        <Text style={[stepStyles.helper, styles.privacyText]}>
          Only used to personalize your caffeine estimates. You can change it anytime in Settings.
        </Text>
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  sexRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  sexOption: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sexChecked: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  sexLabel: { fontSize: 16, fontWeight: "700", color: colors.text, textAlign: "center" },
  sexLabelChecked: { color: colors.primary },
  units: { marginTop: 20 },
  row: { flexDirection: "row", gap: 16, marginTop: 20 },
  half: { flex: 1 },
  field: { marginTop: 20 },
  error: { marginTop: 8, fontSize: 14, color: ERROR_COLOR },
  bmi: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
  },
  bmiLabel: { fontSize: 15, color: colors.textMuted },
  bmiValue: { fontSize: 30, fontWeight: "800", color: colors.primary },
  bmiBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface },
  bmiBadgeText: { fontSize: 15, fontWeight: "700", color: colors.text },
  privacy: { marginTop: 20, flexDirection: "row", gap: 10 },
  privacyText: { flex: 1 },
});
