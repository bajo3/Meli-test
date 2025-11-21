// components/MeliItemRow.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
} from "react-native";
import type { MeliItem } from "../lib/meliApi";

export type RelistStep = "closing" | "creating" | null;

type MeliItemProps = {
  item: MeliItem;
  updatingId: string | null;
  relistingId: string | null;
  relistStep: RelistStep;
  onUpdatePrice: (itemId: string, newPrice: string) => void;
  onClose: (itemId: string) => void;
  onRelistSilver: (itemId: string) => void;
  onRelistGold: (itemId: string) => void;
};

export default function MeliItemRow({
  item,
  updatingId,
  relistingId,
  relistStep,
  onUpdatePrice,
  onClose,
  onRelistSilver,
  onRelistGold,
}: MeliItemProps) {
  const [priceInput, setPriceInput] = useState(String(item.price));

  const isUpdating = updatingId === item.id;
  const isRelisting = relistingId === item.id;

  const silverLabel = !isRelisting
    ? "Replicar plata"
    : relistStep === "closing"
    ? "Cerrando publicación..."
    : "Creando nueva (plata)...";

  const goldLabel = !isRelisting
    ? "Replicar oro"
    : relistStep === "closing"
    ? "Cerrando publicación..."
    : "Creando nueva (oro)...";

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>
        ID: {item.id}
        {"\n"}
        Precio actual: {item.currency_id} {item.price}
      </Text>

      {/* Actualizar precio */}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={priceInput}
          onChangeText={setPriceInput}
        />
        <Button
          title={isUpdating ? "Actualizando..." : "Actualizar precio"}
          onPress={() => onUpdatePrice(item.id, priceInput)}
          disabled={isUpdating}
        />
      </View>

      {/* Borrar / cerrar publicación */}
      <View style={[styles.row, { marginTop: 8 }]}>
        <Button
          title="Borrar (cerrar)"
          onPress={() => onClose(item.id)}
          color="#b71c1c"
          disabled={isUpdating || isRelisting}
        />
      </View>

      {/* Republicar en plata / oro */}
      <View
        style={[
          styles.row,
          { marginTop: 8, justifyContent: "space-between" },
        ]}
      >
        <View style={{ flex: 1, marginRight: 4 }}>
          <Button
            title={silverLabel}
            onPress={() => onRelistSilver(item.id)}
            disabled={isRelisting}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 4 }}>
          <Button
            title={goldLabel}
            onPress={() => onRelistGold(item.id)}
            disabled={isRelisting}
          />
        </View>
      </View>

      {isRelisting && (
        <Text style={styles.relistHint}>
          {relistStep === "closing"
            ? "Cerrando publicación original..."
            : "Creando nueva publicación..."}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
  },
  title: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#555", marginBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    backgroundColor: "#fff",
  },
  relistHint: {
    marginTop: 4,
    fontSize: 12,
    color: "#555",
  },
});
