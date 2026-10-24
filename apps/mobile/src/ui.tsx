import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "./theme";
import { statusLabel } from "./format";

export function Screen({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {title ? (
          <View style={styles.header}>
            <Text style={styles.eyebrow}>EDUCAR PARA TRANSFORMAR</Text>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : colors.navy} />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            variant === "primary" && styles.buttonLabelLight,
            variant === "danger" && styles.buttonLabelLight,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Input({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor="#9aaab3"
        style={styles.input}
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
}

export function Badge({ status }: { status: string }) {
  const tone =
    status === "paid" || status === "approved"
      ? styles.badgeSuccess
      : status === "overdue" || status === "rejected"
        ? styles.badgeDanger
        : status === "partial"
          ? styles.badgeWarning
          : styles.badgeNeutral;
  return (
    <View style={[styles.badge, tone]}>
      <Text style={styles.badgeText}>{statusLabel(status)}</Text>
    </View>
  );
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Loading({ label = "Cargando..." }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.teal} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDetail}>{detail}</Text>
    </View>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: { marginBottom: spacing.lg },
  eyebrow: { color: colors.blue, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  title: { marginTop: spacing.xs, color: colors.deep, fontSize: 26, fontWeight: "800" },
  subtitle: { marginTop: spacing.xs, color: colors.muted, fontSize: 13, lineHeight: 20 },
  card: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  cardTitle: { marginBottom: spacing.md, color: colors.deep, fontSize: 16, fontWeight: "800" },
  sectionTitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    color: colors.deep,
    fontSize: 14,
    fontWeight: "800",
  },
  button: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: 6,
  },
  buttonPrimary: { backgroundColor: colors.navy },
  buttonSecondary: { borderWidth: 1, borderColor: colors.line, backgroundColor: "#eef5f9" },
  buttonDanger: { backgroundColor: colors.danger },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonLabel: { color: colors.navy, fontSize: 14, fontWeight: "800" },
  buttonLabelLight: { color: "#fff" },
  field: { marginBottom: spacing.md },
  fieldLabel: { marginBottom: spacing.xs, color: colors.ink, fontSize: 12, fontWeight: "800" },
  input: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    color: colors.ink,
    backgroundColor: "#fbfdfe",
    fontSize: 14,
  },
  badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeNeutral: { backgroundColor: "#edf3f6" },
  badgeSuccess: { backgroundColor: "#e6f5ef" },
  badgeDanger: { backgroundColor: "#f9e7e8" },
  badgeWarning: { backgroundColor: "#fbf1df" },
  badgeText: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  error: { marginBottom: spacing.md, color: colors.danger, fontSize: 13 },
  loading: { alignItems: "center", padding: spacing.xl },
  loadingLabel: { marginTop: spacing.sm, color: colors.muted, fontSize: 12 },
  empty: { padding: spacing.lg, alignItems: "center" },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  emptyDetail: { marginTop: spacing.xs, color: colors.muted, fontSize: 12, textAlign: "center" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f4",
  },
  rowLabel: { flex: 1, color: colors.ink, fontSize: 13 },
  rowValue: { color: colors.muted, fontSize: 12, textAlign: "right" },
  choice: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  choiceSelected: { borderColor: colors.teal, backgroundColor: "#e9f7f5" },
  choiceLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  choiceLabelSelected: { color: colors.deep },
});
