import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { bmi, Sex, Units } from "@/features/onboarding/store";
import { colors } from "@/utils/theme";
import { Segmented } from "./Segmented";
import { stepStyles } from "./StepScreen";
import { ERROR_COLOR, TextField } from "./TextField";

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

export type BodyDetails = {
  sex: Sex | null;
  units: Units;
  ageYears: number | null;
  weightKg: number | null;
  heightCm: number | null;
};

/**
 * Form state for sex, units, age, weight and height. Measurements are typed in
 * the chosen units and reported back in metric.
 */
export function useBodyDetailsForm(initial: BodyDetails) {
  const [sex, setSex] = useState(initial.sex);
  const [units, setUnits] = useState(initial.units);
  const [texts, setTexts] = useState<Texts>(() =>
    textsFor(initial.units, initial.ageYears, initial.weightKg, initial.heightCm));

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

  const errors = {
    age: age != null && (!Number.isInteger(age) || !inRange(age, AGE))
      ? `Enter an age from ${AGE.min} to ${AGE.max}.` : null,
    weight: kg != null && !inRange(kg, WEIGHT_KG)
      ? (units === "metric" ? `Enter a weight from ${WEIGHT_KG.min} to ${WEIGHT_KG.max} kg.` : "Enter a weight from 45 to 880 lb.")
      : null,
    height: cm != null && !inRange(cm, HEIGHT_CM)
      ? (units === "metric" ? `Enter a height from ${HEIGHT_CM.min} to ${HEIGHT_CM.max} cm.` : "Enter feet, and inches from 0 to 11.")
      : null,
  };
  const valid = !errors.age && !errors.weight && !errors.height;

  const switchUnits = (next: Units) => {
    if (next === units) return;
    // Convert whatever valid values are typed so far into the new units.
    setUnits(next);
    setTexts(textsFor(next, age && !errors.age ? age : null,
      kg && !errors.weight ? kg : null, cm && !errors.height ? cm : null));
  };

  /** Current values in metric; only meaningful when `valid`. */
  const values: BodyDetails = {
    sex,
    units,
    ageYears: age,
    weightKg: kg == null ? null : round1(kg),
    heightCm: cm == null ? null : round1(cm),
  };

  return {
    sex, setSex, units, switchUnits, texts,
    update: (patch: Partial<Texts>) => setTexts((t) => ({ ...t, ...patch })),
    errors, valid, values,
  };
}

export type BodyDetailsFormState = ReturnType<typeof useBodyDetailsForm>;

/** Sex buttons, unit switch, age/weight/height fields and the BMI card. */
export function BodyDetailsFields({ form }: { form: BodyDetailsFormState }) {
  const { sex, setSex, units, switchUnits, texts, update, errors, valid, values } = form;
  const score = valid ? bmi(values.weightKg, values.heightCm) : null;
  const category = score == null ? null
    : score < 18.5 ? "Below healthy range" : score < 25 ? "Healthy range" : "Above healthy range";

  return (
    <View>
      <Text style={stepStyles.fieldLabel}>Sex</Text>
      <View style={styles.sexRow} accessibilityRole="radiogroup">
        {SEXES.map((o) => {
          const checked = sex === o.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              onPress={() => setSex(checked ? null : o.value)}
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
          keyboardType="number-pad" maxLength={3} error={errors.age}
          onChangeText={(age) => update({ age })} />
        <TextField label="Weight" containerStyle={styles.half} value={texts.weight}
          suffix={units === "metric" ? "kg" : "lb"} keyboardType="decimal-pad" maxLength={5}
          error={errors.weight} onChangeText={(weight) => update({ weight })} />
      </View>

      {units === "metric" ? (
        <TextField label="Height" containerStyle={styles.field} value={texts.heightCm} suffix="cm"
          keyboardType="decimal-pad" maxLength={5} error={errors.height}
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
          {errors.height ? <Text style={styles.error} accessibilityRole="alert">{errors.height}</Text> : null}
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
    </View>
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
});
