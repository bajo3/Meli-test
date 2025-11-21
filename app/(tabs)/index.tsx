import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function Home() {
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
      <Link
        href="/meli-test"
        style={{
          backgroundColor: "#3F51B5",
          padding: 16,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: "white", textAlign: "center", fontSize: 18 }}>
          Ir a Meli Test
        </Text>
      </Link>
    </View>
  );
}
