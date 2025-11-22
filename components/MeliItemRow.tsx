// components/MeliItemRow.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import type { MeliItem } from "../lib/meliApi";

export type RelistStep = "closing" | "creating" | null;

type Props = {
  item: MeliItem;
  updatingId: string | null;
  relistingId: string | null;
  relistStep: RelistStep;
  onUpdatePrice: (id: string, newPrice: string) => void;
  onClose: (id: string) => void;
  onRelistSilver: (id: string) => void;
  onRelistGold: (id: string) => void;
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
}: Props) {
  const [priceInput, setPriceInput] = useState(String(item.price));

  const isUpdating = updatingId === item.id;
  const isRelisting = relistingId === item.id;

  const listingTypeLabel =
    item.listing_type_id === "silver"
      ? "Plata"
      : item.listing_type_id.startsWith("gold")
      ? "Oro"
      : "—";

  const publishedLabel = item.date_created
    ? new Date(item.date_created).toLocaleDateString("es-AR")
    : "—";

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subText}>ID: {item.id}</Text>
      <Text style={styles.subText}>Publicado: {publishedLabel}</Text>

      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>Tipo:</Text>
          <Text style={styles.badgeValue}>{listingTypeLabel}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>Precio actual:</Text>
          <Text style={styles.badgeValue}>
            ${item.price.toLocaleString("es-AR")}
          </Text>
        </View>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.label}>Nuevo precio:</Text>
        <TextInput
          style={styles.input}
          value={priceInput}
          onChangeText={setPriceInput}
          keyboardType="numeric"
        />
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => onUpdatePrice(item.id, priceInput)}
          disabled={isUpdating || isRelisting}
        >
          {isUpdating ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.primaryBtnText}>GUARDAR</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.dangerBtn, styles.actionBtn]}
          onPress={() => onClose(item.id)}
          disabled={isUpdating || isRelisting}
        >
          <Text style={styles.dangerBtnText}>CERRAR</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, styles.actionBtn]}
          onPress={() => onRelistSilver(item.id)}
          disabled={isUpdating || isRelisting}
        >
          <Text style={styles.secondaryBtnText}>RELISTAR PLATA</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, styles.actionBtn]}
          onPress={() => onRelistGold(item.id)}
          disabled={isUpdating || isRelisting}
        >
          <Text style={styles.secondaryBtnText}>RELISTAR ORO</Text>
        </TouchableOpacity>
      </View>

      {isRelisting && (
        <View style={styles.relistInfo}>
          <ActivityIndicator size="small" />
          <Text style={styles.relistText}>
            {relistStep === "closing"
              ? "Cerrando publicación..."
              : relistStep === "creating"
              ? "Creando nueva publicación..."
              : "Procesando..."}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
  },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  subText: { fontSize: 12, color: "#555" },
  badgeRow: {
    flexDirection: "row",
    marginTop: 8,
    marginBottom: 6,
  },
  badge: {
    backgroundColor: "#E3F2FD",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  badgeLabel: { fontSize: 11, color: "#1565C0", marginRight: 4 },
  badgeValue: { fontSize: 11, fontWeight: "600", color: "#0D47A1" },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  label: { fontSize: 13, marginRight: 6 },
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
  primaryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#1976D2",
    borderRadius: 6,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  actionsRow: {
    flexDirection: "row",
    marginTop: 10,
    justifyContent: "space-between",
  },
  actionBtn: { flex: 1, marginRight: 6 },
  dangerBtn: {
    backgroundColor: "#D32F2F",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  dangerBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  secondaryBtn: {
    backgroundColor: "#2196F3",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  relistInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  relistText: { marginLeft: 8, fontSize: 12, color: "#555" },
});
