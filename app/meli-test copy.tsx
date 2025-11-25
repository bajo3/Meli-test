// app/meli-test.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Button,
  ActivityIndicator,
  Alert,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import MeliItemRow, { type RelistStep } from "../components/MeliItemRow";
import { meliFetch, getItemsByIds, type MeliItem } from "../lib/meliApi";

const ML_USER_ID = 327544193;

type QuotaInfo = {
  used: number;
  available: number;
  total: number;
};

type ListingFilter = "all" | "silver" | "gold";
type SortOrder = "date-desc" | "date-asc";

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

  // filtros
  const [search, setSearch] = useState("");
  const [listingFilter, setListingFilter] =
    useState<ListingFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("date-desc");
  const [filtersOpen, setFiltersOpen] = useState(true);

  // ====== Cargar ítems publicados
  const loadItems = async () => {
    try {
      setLoading(true);

      const searchRes = await meliFetch(
        `/users/${ML_USER_ID}/items/search?status=active&limit=50&offset=0`
      );

      const ids: string[] = searchRes.results || [];

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

  // ====== Cupos
  const loadQuota = async () => {
    try {
      setQuotaLoading(true);

      const packs = await meliFetch(
        `/users/${ML_USER_ID}/classifieds_promotion_packs?package_content=publications`
      );

      console.log("PACKS RAW:", packs);

      if (!Array.isArray(packs)) {
        setQuota({});
        return;
      }

      const currentPack = packs.find((p: any) => p.status === "active");

      if (!currentPack) {
        setQuota({});
        return;
      }

      let silver: QuotaInfo | undefined;
      let gold: QuotaInfo | undefined;

      if (Array.isArray(currentPack.listing_details)) {
        for (const det of currentPack.listing_details) {
          if (det.listing_type_id === "silver") {
            silver = {
              used: det.used_listings ?? 0,
              available: det.remaining_listings ?? 0,
              total:
                (det.used_listings ?? 0) +
                  (det.remaining_listings ?? 0) || 0,
            };
          } else if (det.listing_type_id.startsWith("gold")) {
            gold = {
              used: det.used_listings ?? 0,
              available: det.remaining_listings ?? 0,
              total:
                (det.used_listings ?? 0) +
                  (det.remaining_listings ?? 0) || 0,
            };
          }
        }
      }

      setQuota({ silver, gold });
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

  // ====== Cambiar precio
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

  // ====== Cerrar publicación
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

  // ====== Relistar
  const handleRelistWithType = async (
    itemId: string,
    listingTypeId: "silver" | "gold"
  ) => {
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

      setRelistStep("closing");
      const original = await meliFetch(`/items/${itemId}`);
      const oldItemId = original.id;

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

  // ====== Filtros + orden
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    const list = items.filter((item) => {
      const matchesSearch =
        term.length === 0 ||
        item.title.toLowerCase().includes(term) ||
        item.id.toLowerCase().includes(term);

      let matchesType = true;
      if (listingFilter === "silver") {
        matchesType = item.listing_type_id === "silver";
      } else if (listingFilter === "gold") {
        matchesType = item.listing_type_id.startsWith("gold");
      }

      return matchesSearch && matchesType;
    });

    // ordenar por fecha
    const sorted = [...list].sort((a, b) => {
      const da = a.date_created ? new Date(a.date_created).getTime() : 0;
      const db = b.date_created ? new Date(b.date_created).getTime() : 0;

      if (sortOrder === "date-desc") {
        // más recientes primero
        return db - da;
      } else {
        // más viejas primero
        return da - db;
      }
    });

    return sorted;
  }, [items, search, listingFilter, sortOrder]);

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
          {"     "}Oro:{" "}
          {quota.gold ? `${quota.gold.available}/${quota.gold.total}` : "-"}
        </Text>
        <Button title="ACTUALIZAR CUPOS" onPress={loadQuota} />
      </View>

      {/* Botón para plegar/desplegar filtros */}
      <View style={styles.filtersToggleContainer}>
        <TouchableOpacity
          style={styles.filtersToggleBtn}
          onPress={() => setFiltersOpen((prev) => !prev)}
        >
          <Text style={styles.filtersToggleText}>
            {filtersOpen ? "Ocultar filtros ▲" : "Mostrar filtros ▼"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filtros (plegables) */}
      {filtersOpen && (
        <View style={styles.filtersBox}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por título o ID..."
          />

          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.filterBtn,
                listingFilter === "all" && styles.filterBtnActive,
              ]}
              onPress={() => setListingFilter("all")}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  listingFilter === "all" && styles.filterBtnTextActive,
                ]}
              >
                Todas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterBtn,
                listingFilter === "silver" && styles.filterBtnActive,
              ]}
              onPress={() => setListingFilter("silver")}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  listingFilter === "silver" && styles.filterBtnTextActive,
                ]}
              >
                Plata
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterBtn,
                listingFilter === "gold" && styles.filterBtnActive,
              ]}
              onPress={() => setListingFilter("gold")}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  listingFilter === "gold" && styles.filterBtnTextActive,
                ]}
              >
                Oro
              </Text>
            </TouchableOpacity>
          </View>

          {/* Orden por fecha */}
          <View style={styles.sortRow}>
            <Text style={styles.sortLabel}>Ordenar por publicación:</Text>

            <View style={styles.sortButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.sortBtn,
                  sortOrder === "date-desc" && styles.sortBtnActive,
                ]}
                onPress={() => setSortOrder("date-desc")}
              >
                <Text
                  style={[
                    styles.sortBtnText,
                    sortOrder === "date-desc" && styles.sortBtnTextActive,
                  ]}
                >
                  Más recientes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sortBtn,
                  sortOrder === "date-asc" && styles.sortBtnActive,
                ]}
                onPress={() => setSortOrder("date-asc")}
              >
                <Text
                  style={[
                    styles.sortBtnText,
                    sortOrder === "date-asc" && styles.sortBtnTextActive,
                  ]}
                >
                  Más viejas
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View style={styles.reloadBox}>
        <Button title="RECARGAR PUBLICACIONES" onPress={loadItems} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text>Cargando publicaciones...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.center}>
          <Text>No se encontraron ítems con esos filtros.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
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
  // toggle filtros
  filtersToggleContainer: {
    marginBottom: 6,
  },
  filtersToggleBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1976D2",
    backgroundColor: "#E3F2FD",
  },
  filtersToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1976D2",
  },
  // caja filtros
  filtersBox: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    elevation: 1,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    backgroundColor: "#fafafa",
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  filterBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#1976D2",
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: "center",
    marginHorizontal: 3,
  },
  filterBtnActive: {
    backgroundColor: "#1976D2",
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1976D2",
  },
  filterBtnTextActive: {
    color: "#fff",
  },
  // ordenamiento
  sortRow: {
    marginTop: 4,
  },
  sortLabel: {
    fontSize: 12,
    color: "#555",
    marginBottom: 4,
  },
  sortButtonsRow: {
    flexDirection: "row",
  },
  sortBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#757575",
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: "center",
    marginHorizontal: 3,
  },
  sortBtnActive: {
    backgroundColor: "#424242",
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#424242",
  },
  sortBtnTextActive: {
    color: "#fff",
  },
  reloadBox: {
    marginBottom: 10,
  },
});
