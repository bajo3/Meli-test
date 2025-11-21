// app/meli-test.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Button,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import MeliItemRow, { type RelistStep } from "../components/MeliItemRow";
import { meliFetch, getItemsByIds, type MeliItem } from "../lib/meliApi";

// 👉 Tu user_id de ML
const ML_USER_ID = 327544193;

type QuotaInfo = {
  used: number;
  available: number;
  total: number;
};

export default function MeliTest() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MeliItem[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [relistingId, setRelistingId] = useState<string | null>(null);
  const [relistStep, setRelistStep] = useState<RelistStep>(null);

  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quota, setQuota] = useState<{
    silver?: QuotaInfo;
    gold?: QuotaInfo;
  }>({});

  // ===================== HELPERS CUPOS =====================
  const buildQuotaFrom = (obj: any): QuotaInfo => {
    const used =
      obj?.used_listings ?? obj?.used ?? 0;
    const available =
      obj?.remaining_listings ?? obj?.available ?? 0;
    const total =
      obj?.total_listings ?? obj?.total ?? used + available;

    return { used, available, total };
  };

  // ===================== LOAD ITEMS =====================

  const loadItems = async () => {
    try {
      setLoading(true);

      const search = await meliFetch(
        `/users/${ML_USER_ID}/items/search?status=active&limit=50&offset=0`
      );

      const ids: string[] = search.results || [];

      if (!ids.length) {
        setItems([]);
        return;
      }

      const parsed = await getItemsByIds(ids);
      setItems(parsed);
    } catch (e: any) {
      console.log("ERROR loadItems:", e);
      Alert.alert(
        "Error",
        e.message || "No se pudieron cargar los ítems desde Mercado Libre"
      );
    } finally {
      setLoading(false);
    }
  };

  // ===================== LOAD QUOTA =====================

  const loadQuota = async () => {
    try {
      setQuotaLoading(true);

      const packs = await meliFetch(
        `/users/${ML_USER_ID}/classifieds_promotion_packs?package_content=publications`
      );

      console.log("PACKS RAW:", packs);

      if (!Array.isArray(packs) || packs.length === 0) {
        setQuota({});
        return;
      }

      // Paquete actual (status === "active")
      const activePack = packs.find((p: any) => p.status === "active");

      if (!activePack) {
        setQuota({});
        return;
      }

      const listingDetails: any[] = Array.isArray(activePack.listing_details)
        ? activePack.listing_details
        : [];

      // Intentamos separar por tipo de publicación
      const silverDetail = listingDetails.find((d) =>
        String(d.listing_type_id || "").toLowerCase().includes("silver")
      );
      const goldDetail = listingDetails.find((d) =>
        String(d.listing_type_id || "").toLowerCase().includes("gold")
      );

      let silverQuota: QuotaInfo | undefined;
      let goldQuota: QuotaInfo | undefined;

      // Si hay detalle específico de silver, lo usamos.
      // Si no, usamos el cupo total del pack como "silver".
      if (silverDetail) {
        silverQuota = buildQuotaFrom(silverDetail);
      } else {
        silverQuota = buildQuotaFrom(activePack);
      }

      // Si hay detalle específico de gold, lo seteamos.
      // Si no, queda undefined (no hay cupo oro separado en el pack).
      if (goldDetail) {
        goldQuota = buildQuotaFrom(goldDetail);
      }

      setQuota({
        silver: silverQuota,
        gold: goldQuota,
      });
    } catch (e: any) {
      console.log("ERROR loadQuota:", e);
      setQuota({});
    } finally {
      setQuotaLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
    loadQuota();
  }, []);

  // ===================== UPDATE PRICE =====================

  const handleUpdatePrice = async (itemId: string, newPriceStr: string) => {
    const cleaned = newPriceStr.replace(/[^\d.,]/g, "").replace(",", ".");
    const newPrice = Number(cleaned);

    if (isNaN(newPrice) || newPrice <= 0) {
      Alert.alert("Precio inválido", "Ingresá un número mayor a 0");
      return;
    }

    try {
      setUpdatingId(itemId);

      const updated = await meliFetch(`/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify({ price: newPrice }),
      });

      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId ? { ...it, price: updated.price } : it
        )
      );

      Alert.alert("Listo", "Precio actualizado en Mercado Libre");
    } catch (e: any) {
      console.log(e);
      Alert.alert("Error", e.message || "No se pudo actualizar el precio");
    } finally {
      setUpdatingId(null);
    }
  };

  // ===================== CLOSE ITEM =====================

  const handleClose = async (itemId: string) => {
    try {
      setUpdatingId(itemId);

      const closed = await meliFetch(`/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "closed" }),
      });

      console.log("CLOSE RESPONSE (botón borrar):", closed);

      if (closed.status !== "closed") {
        Alert.alert(
          "Atención",
          `Mercado Libre no devolvió la publicación como 'closed' (status actual: ${closed.status}).`
        );
      }

      setItems((prev) => prev.filter((it) => it.id !== itemId));
      Alert.alert("Cerrada", `La publicación ${itemId} fue cerrada.`);
      loadQuota();
    } catch (e: any) {
      console.log("ERROR CLOSE:", e);
      Alert.alert("Error", e.message || "No se pudo cerrar la publicación");
    } finally {
      setUpdatingId(null);
    }
  };

  // ===================== RELIST =====================

  const handleRelistWithType = async (
    itemId: string,
    listingTypeId: "silver" | "gold"
  ) => {
    // Chequear cupo solo si tenemos datos (si no, dejamos que ML responda)
    if (listingTypeId === "silver" && quota.silver) {
      if (quota.silver.available <= 0) {
        Alert.alert(
          "Sin cupo plata",
          "No te quedan publicaciones plata disponibles en tu paquete."
        );
        return;
      }
    }
    if (listingTypeId === "gold" && quota.gold) {
      if (quota.gold.available <= 0) {
        Alert.alert(
          "Sin cupo oro",
          "No te quedan publicaciones oro disponibles en tu paquete."
        );
        return;
      }
    }

    try {
      setRelistingId(itemId);

      // 1) CERRAR
      setRelistStep("closing");

      const original = await meliFetch(`/items/${itemId}`);
      const oldItemId = original.id;

      console.log("ORIGINAL seller_contact:", original.seller_contact);
      console.log("ORIGINAL video_id:", original.video_id);

      let descriptionText = "";
      try {
        const desc = await meliFetch(`/items/${oldItemId}/description`);
        descriptionText = desc.plain_text || "";
      } catch (e) {
        console.log("Sin descripción o error trayendo descripción", e);
      }

      const closed = await meliFetch(`/items/${oldItemId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "closed" }),
      });
      console.log("CLOSE RESPONSE (relist):", closed);

      if (closed.status !== "closed") {
        throw new Error(
          `Mercado Libre no permitió cerrar la publicación (status actual: ${closed.status}).`
        );
      }

      // 2) CREAR NUEVA
      setRelistStep("creating");

      const filteredAttributes = (original.attributes || []).filter(
        (attr: any) =>
          !["MARKET", "IS_OFFERED_BY_BRAND", "VERIFIED_VEHICLES"].includes(
            attr.id
          )
      );

      let location = original.location;
      if (
        !location ||
        !location.city?.name ||
        !location.state?.name ||
        !location.country?.name
      ) {
        location = {
          address_line: "",
          zip_code: "",
          city: { name: "Tandil" },
          state: { name: "Buenos Aires" },
          country: { name: "Argentina" },
        };
      }

      const newItemBody: any = {
        title: original.title,
        category_id: original.category_id,
        price: original.price,
        currency_id: original.currency_id,
        available_quantity: original.available_quantity || 1,
        buying_mode: original.buying_mode,
        listing_type_id: listingTypeId,
        condition: original.condition,
        pictures: (original.pictures || []).map((p: any) => ({
          source: p.url,
        })),
        attributes: filteredAttributes,
        warranty: original.warranty,
        location,
      };

      if (original.seller_contact) {
        newItemBody.seller_contact = original.seller_contact;
      }

      if (original.video_id) {
        newItemBody.video_id = original.video_id;
      }

      console.log("NEW ITEM BODY:", newItemBody);

      const created = await meliFetch(`/items`, {
        method: "POST",
        body: JSON.stringify(newItemBody),
      });

      const newItemId = created.id;

      if (descriptionText && newItemId) {
        try {
          await meliFetch(`/items/${newItemId}/description`, {
            method: "POST",
            body: JSON.stringify({ plain_text: descriptionText }),
          });
        } catch (e) {
          console.log("Error clonando descripción al nuevo item", e);
        }
      }

      await loadItems();
      await loadQuota();

      Alert.alert(
        "Republicado",
        `Se cerró la publicación vieja (${oldItemId}) y se creó una nueva (${listingTypeId}):\n${newItemId}`
      );
    } catch (e: any) {
      console.log("ERROR RELIST:", e);

      const msg = String(e?.message || "");

      if (msg.toLowerCase().includes("not available quota")) {
        Alert.alert(
          "Sin cupo",
          "Mercado Libre indica que no te queda cupo disponible para este tipo de publicación."
        );
      } else {
        Alert.alert("Error", msg || "No se pudo republicar el ítem");
      }
    } finally {
      setRelistStep(null);
      setRelistingId(null);
    }
  };

  // ===================== RENDER =====================

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Mercado Libre Tester</Text>

      {/* Barra de cupos */}
      <View style={styles.quotaBar}>
        <View style={styles.quotaHeaderRow}>
          <Text style={styles.quotaTitle}>Cupos disponibles (pack actual)</Text>
          {quotaLoading && <ActivityIndicator size="small" />}
        </View>
        <Text style={styles.quotaText}>
          Plata:{" "}
          {quota.silver
            ? `${quota.silver.available}/${quota.silver.total}`
            : "-"}
          {"   "}·   Oro:{" "}
          {quota.gold
            ? `${quota.gold.available}/${quota.gold.total}`
            : "sin datos de pack"}
        </Text>
        <Button title="Actualizar cupos" onPress={loadQuota} />
      </View>

      <Button title="Recargar publicaciones" onPress={loadItems} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text>Cargando publicaciones...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text>No se encontraron ítems publicados.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MeliItemRow
              item={item}
              updatingId={updatingId}
              relistingId={relistingId}
              relistStep={relistStep}
              onUpdatePrice={handleUpdatePrice}
              onClose={handleClose}
              onRelistSilver={(id) => handleRelistWithType(id, "silver")}
              onRelistGold={(id) => handleRelistWithType(id, "gold")}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f5f5f5" },
  header: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { paddingBottom: 40 },
  quotaBar: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    elevation: 1,
  },
  quotaHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  quotaTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  quotaText: {
    fontSize: 13,
    color: "#555",
    marginBottom: 6,
  },
});
