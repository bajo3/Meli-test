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
import {
  meliFetch,
  getItemsByIds,
  type MeliItem,
} from "../lib/meliApi";

// 👉 Tu user_id de ML
const ML_USER_ID = 327544193;

export default function MeliTest() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MeliItem[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [relistingId, setRelistingId] = useState<string | null>(null);
  const [relistStep, setRelistStep] = useState<RelistStep>(null);

  // Cargar ítems publicados AUTOMÁTICAMENTE desde ML
  const loadItems = async () => {
    try {
      setLoading(true);

      // 1) Lista de IDs de publicaciones activas del usuario
      const search = await meliFetch(
        `/users/${ML_USER_ID}/items/search?status=active&limit=50&offset=0`
      );

      const ids: string[] = search.results || [];

      if (!ids.length) {
        setItems([]);
        return;
      }

      // 2) Traer detalle de todos esos items (respeta límite 20 ids por request)
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

  useEffect(() => {
    loadItems();
  }, []);

  // Cambiar precio
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

  // Cerrar (borrar) publicación simple
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
    } catch (e: any) {
      console.log("ERROR CLOSE:", e);
      Alert.alert("Error", e.message || "No se pudo cerrar la publicación");
    } finally {
      setUpdatingId(null);
    }
  };

  // Republicar en modo "primero cerrar, después crear"
  const handleRelistWithType = async (
    itemId: string,
    listingTypeId: "silver" | "gold" // 👈 ahora usamos silver | gold
  ) => {
    try {
      setRelistingId(itemId);

      // 1) Paso: CERRANDO
      setRelistStep("closing");

      // Traer datos del ítem original (para tenerlos antes de cerrar)
      const original = await meliFetch(`/items/${itemId}`);
      const oldItemId = original.id;

      console.log("ORIGINAL seller_contact:", original.seller_contact);
      console.log("ORIGINAL video_id:", original.video_id);

      // Traer descripción antes de cerrar
      let descriptionText = "";
      try {
        const desc = await meliFetch(`/items/${oldItemId}/description`);
        descriptionText = desc.plain_text || "";
      } catch (e) {
        console.log("Sin descripción o error trayendo descripción", e);
      }

      // Intentar cerrar la publicación vieja
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

      // 2) Paso: CREANDO
      setRelistStep("creating");

      // Filtrar atributos no modificables / conflictivos
      const filteredAttributes = (original.attributes || []).filter(
        (attr: any) =>
          !["MARKET", "IS_OFFERED_BY_BRAND", "VERIFIED_VEHICLES"].includes(
            attr.id
          )
      );

      // Asegurar location
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

      // Armar nuevo ítem (base)
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

      // 👇 Copiar seller_contact (teléfono / WhatsApp) si existe
      if (original.seller_contact) {
        newItemBody.seller_contact = original.seller_contact;
      }

      // 👇 Copiar video de YouTube si existe
      if (original.video_id) {
        newItemBody.video_id = original.video_id;
      }

      console.log("NEW ITEM BODY:", newItemBody);

      // Crear nueva publicación
      const created = await meliFetch(`/items`, {
        method: "POST",
        body: JSON.stringify(newItemBody),
      });

      const newItemId = created.id;

      // Clonar descripción si había
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

      // Refrescar lista desde ML con los items actuales del usuario
      await loadItems();

      Alert.alert(
        "Republicado",
        `Se cerró la publicación vieja (${oldItemId}) y se creó una nueva (${listingTypeId}):\n${newItemId}`
      );
    } catch (e: any) {
      console.log("ERROR RELIST:", e);
      Alert.alert("Error", e.message || "No se pudo republicar el ítem");
    } finally {
      setRelistStep(null);
      setRelistingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Mercado Libre Tester</Text>
      <Button title="Recargar" onPress={loadItems} />

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
  header: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { paddingBottom: 40 },
});
