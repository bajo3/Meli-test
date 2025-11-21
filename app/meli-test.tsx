// app/meli-test.tsx
import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    FlatList,
    TextInput,
    Button,
    ActivityIndicator,
    Alert,
    StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ML_ACCESS_TOKEN =
    "APP_USR-1014187039987973-112109-ddcd368c59f6500b584f1ea1c4045dbb-327544193"; // ⚠️ SOLO DEV. PONÉ ACÁ TU APP_USR PARA PROBAR.
const ML_USER_ID = 327544193;

// Helper para llamar a Mercado Libre
async function meliFetch(path: string, options: any = {}) {
    console.log("ML FETCH:", options.method || "GET", path);

    const res = await fetch(`https://api.mercadolibre.com${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${ML_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(options.headers || {}),
        },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        console.log("ML ERROR STATUS:", res.status);
        console.log("ML ERROR BODY:", data);

        let msg =
            data?.cause
                ?.map((c: any) => `${c.field ?? ""} → ${c.message ?? c.code}`)
                .join("\n") ||
            data?.message ||
            data?.error ||
            "Error ML";

        throw new Error(msg);
    }

    return data;
}


// 🔹 Componente para cada ítem
type MeliItemProps = {
    item: {
        id: string;
        title: string;
        price: number;
        currency_id: string;
    };
    updatingId: string | null;
    relistingId: string | null;
    onUpdatePrice: (itemId: string, newPrice: string) => void;
    onClose: (itemId: string) => void;
    onRelistSilver: (itemId: string) => void;
    onRelistGold: (itemId: string) => void;
};

function MeliItemRow({
    item,
    updatingId,
    relistingId,
    onUpdatePrice,
    onClose,
    onRelistSilver,
    onRelistGold,
}: MeliItemProps) {
    const [priceInput, setPriceInput] = useState(String(item.price));

    const isUpdating = updatingId === item.id;
    const isRelisting = relistingId === item.id;

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
            <View
                style={[
                    styles.row,
                    { marginTop: 8, justifyContent: "flex-start", gap: 8 },
                ]}
            >
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
                    { marginTop: 8, justifyContent: "space-between", gap: 8 },
                ]}
            >
                <Button
                    title={isRelisting ? "Replicando plata..." : "Replicar plata"}
                    onPress={() => onRelistSilver(item.id)}
                    disabled={isRelisting}
                />
                <Button
                    title={isRelisting ? "Replicando oro..." : "Replicar oro"}
                    onPress={() => onRelistGold(item.id)}
                    disabled={isRelisting}
                />
            </View>
        </View>
    );
}

export default function MeliTest() {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<any[]>([]);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [relistingId, setRelistingId] = useState<string | null>(null);

    // Cargar ítems publicados
    const loadItems = async () => {
        try {
            setLoading(true);

            // 🔴 ANTES (bloqueado por PolicyAgent)
            //  const search = await meliFetch(
            //    `/users/${ML_USER_ID}/items/search?limit=20&offset=0`
            //  );
            //  const ids = search.results || [];

            // 🟢 AHORA: IDs a mano (para probar la lógica)
            const ids = [
                "MLA1564040189", // reemplazá por tus IDs reales
                "MLA1564386773"
            ];

            if (ids.length === 0) {
                setItems([]);
                return;
            }

            const detail = await meliFetch(`/items?ids=${ids.join(",")}`);

            const parsed = detail
                .filter((it: any) => it.code === 200)
                .map((it: any) => ({
                    id: it.body.id,
                    title: it.body.title,
                    price: it.body.price,
                    currency_id: it.body.currency_id,
                }));

            setItems(parsed);
        } catch (e: any) {
            console.log(e);
            Alert.alert("Error", e.message || "No se pudieron cargar los ítems");
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        loadItems();
    }, []);

    // Cambiar precio
    const handleUpdatePrice = async (itemId: string, newPriceStr: string) => {
        const newPrice = Number(newPriceStr.replace(",", "."));
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

    // Cerrar (borrar) publicación
    const handleClose = async (itemId: string) => {
        try {
            setUpdatingId(itemId);
            await meliFetch(`/items/${itemId}/close`, {
                method: "POST",
                body: JSON.stringify({}),
            });

            Alert.alert("Cerrada", `La publicación ${itemId} fue cerrada.`);

            // opcional: sacarla de la lista
            setItems((prev) => prev.filter((it) => it.id !== itemId));
        } catch (e: any) {
            console.log("ERROR CLOSE:", e);
            Alert.alert("Error", e.message || "No se pudo cerrar la publicación");
        } finally {
            setUpdatingId(null);
        }
    };

    // Republicar con tipo de listing (plata/oro)
    const handleRelistWithType = async (
        itemId: string,
        listingTypeId: "silver" | "gold_special"
    ) => {
        try {
            setRelistingId(itemId);

            // 1) Traer datos del ítem original
            const original = await meliFetch(`/items/${itemId}`);

            // 2) Traer descripción
            let descriptionText = "";
            try {
                const desc = await meliFetch(`/items/${itemId}/description`);
                descriptionText = desc.plain_text || "";
            } catch (e) {
                console.log("Sin descripción o error trayendo descripción", e);
            }

            // 3) Filtrar atributos no modificables
            const filteredAttributes = (original.attributes || []).filter(
                (attr: any) =>
                    !["MARKET", "IS_OFFERED_BY_BRAND", "VERIFIED_VEHICLES"].includes(
                        attr.id
                    )
            );

            // 4) Asegurar location con ciudad, provincia y país
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

            // 5) Construir nuevo item
            const newItemBody: any = {
                title: original.title,
                category_id: original.category_id,
                price: original.price,
                currency_id: original.currency_id,
                available_quantity: original.available_quantity || 1,
                buying_mode: original.buying_mode,
                listing_type_id: listingTypeId, // 👈 plata/oro
                condition: original.condition,
                pictures: (original.pictures || []).map((p: any) => ({
                    source: p.url,
                })),
                attributes: filteredAttributes,
                warranty: original.warranty,
                location,
            };

            console.log("NEW ITEM BODY:", newItemBody);

            // 6) Crear nueva publicación
            const created = await meliFetch(`/items`, {
                method: "POST",
                body: JSON.stringify(newItemBody),
            });

            const newItemId = created.id;

            // 7) Clonar descripción, si había
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

            // 8) Cerrar la vieja publicación (modo “ya está, republicar”)
            await meliFetch(`/items/${itemId}/close`, {
                method: "POST",
                body: JSON.stringify({}),
            });

            Alert.alert(
                "Republicado",
                `Se creó una nueva publicación (${listingTypeId}):\n${newItemId}\nLa vieja se cerró.`
            );
        } catch (e: any) {
            console.log("ERROR RELIST:", e);
            Alert.alert("Error", e.message || "No se pudo republicar el ítem");
        } finally {
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
                            onUpdatePrice={handleUpdatePrice}
                            onClose={handleClose}
                            onRelistSilver={(id) => handleRelistWithType(id, "silver")}
                            onRelistGold={(id) => handleRelistWithType(id, "gold_special")} // ajustá si usás otro tipo de oro
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
    card: {
        backgroundColor: "white",
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        elevation: 2,
    },
    title: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
    subtitle: { fontSize: 13, color: "#555", marginBottom: 8 },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
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
});
