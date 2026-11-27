import { LANGUAGE_NAMES } from "@toki/i18n";
import { parseEmail } from "@toki/shared";
import { StyleSheet, Text, View } from "react-native";

// The one screen of the skeleton (TOKI-146, R7). Each line proves that a
// workspace package loads from source in React Native: @toki/i18n (plain
// imports) and @toki/shared (`.js` specifiers and Zod).
export default function Index() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Toki</Text>
      <Text>{Object.values(LANGUAGE_NAMES).join(" · ")}</Text>
      <Text>{parseEmail(" Member@Example.COM ")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  title: { fontSize: 28, fontWeight: "600" },
});
