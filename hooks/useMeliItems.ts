// hooks/useMeliItems.ts
import { useCallback, useEffect, useState } from 'react';
import { meliFetch, getItemsByIds, MeliItem } from '../lib/meliApi';

const DEFAULT_USER_ID = '327544193';

type RelistStep = 'idle' | 'closing' | 'creating';

type UseMeliItemsOptions = {
  userId?: string;
};

type UseMeliItemsResult = {
  items: MeliItem[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;

  // estados para UI
  updatingId: string | null;
  relistingId: string | null;
  relistStep: RelistStep;

  // acciones
  updatePrice: (id: string, newPrice: number) => Promise<void>;
  closeItem: (id: string) => Promise<void>;
  relistItemWithType: (id: string, listingTypeId: string) => Promise<void>;
};

export function useMeliItems(
  options: UseMeliItemsOptions = {}
): UseMeliItemsResult {
  const userId = options.userId ?? DEFAULT_USER_ID;

  const [items, setItems] = useState<MeliItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [relistingId, setRelistingId] = useState<string | null>(null);
  const [relistStep, setRelistStep] = useState<RelistStep>('idle');

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1) buscar IDs de publicaciones activas
      const search = await meliFetch(
        `/users/${userId}/items/search?status=active&limit=50&offset=0`
      );

      const ids: string[] = Array.isArray(search?.results)
        ? search.results
        : [];

      if (!ids.length) {
        setItems([]);
        return;
      }

      // 2) traer detalles con getItemsByIds (ya respeta los bloques de 20)
      const details = await getItemsByIds(ids);
      setItems(details);
    } catch (e: any) {
      console.error('Error cargando items de ML', e);
      setError(e?.message ?? 'Error al cargar publicaciones de ML');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const reload = loadItems;

  // ===== acciones =====

  const updatePrice = useCallback(
    async (id: string, newPrice: number) => {
      try {
        setUpdatingId(id);

        await meliFetch(`/items/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ price: newPrice }),
        });

        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, price: newPrice } : item
          )
        );
      } catch (e: any) {
        console.error('Error actualizando precio', e);
        setError(e?.message ?? 'No se pudo actualizar el precio');
      } finally {
        setUpdatingId(null);
      }
    },
    []
  );

  const closeItem = useCallback(async (id: string) => {
    try {
      setUpdatingId(id);

      await meliFetch(`/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'closed' }),
      });

      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e: any) {
      console.error('Error cerrando publicación', e);
      setError(e?.message ?? 'No se pudo cerrar la publicación');
    } finally {
      setUpdatingId(null);
    }
  }, []);

  const relistItemWithType = useCallback(
    async (id: string, listingTypeId: string) => {
      try {
        setRelistingId(id);
        setRelistStep('closing');

        // 1) obtener datos originales
        const original = await meliFetch(`/items/${id}`);

        // 2) cerrar publicación original
        await meliFetch(`/items/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'closed' }),
        });

        setRelistStep('creating');

        // 3) armar cuerpo mínimo para nueva publicación
        // ⚠ Ajustá estos campos según lo que ya tenías funcionando
        const newBody: any = {
          title: original.title,
          category_id: original.category_id,
          price: original.price,
          currency_id: original.currency_id,
          available_quantity: original.available_quantity ?? 1,
          buying_mode: original.buying_mode ?? 'classified',
          listing_type_id: listingTypeId,
          condition: original.condition ?? 'used',
          pictures: original.pictures,
          attributes: original.attributes,
          seller_custom_field: original.seller_custom_field,
          location: original.location,
          // agregá acá cualquier atributo específico de vehículos que vos ya uses
        };

        const created = await meliFetch('/items', {
          method: 'POST',
          body: JSON.stringify(newBody),
        });

        // 4) actualizar lista local (saco el viejo, meto el nuevo arriba)
        setItems((prev) => {
          const withoutOld = prev.filter((item) => item.id !== id);
          const mappedNew: MeliItem = {
            id: created.id,
            title: created.title,
            price: created.price,
            currency_id: created.currency_id,
            available_quantity: created.available_quantity,
            status: created.status,
            listing_type_id: created.listing_type_id,
            date_created: created.date_created,
            thumbnail: created.thumbnail,
            permalink: created.permalink,
            attributes: created.attributes,
          };
          return [mappedNew, ...withoutOld];
        });
      } catch (e: any) {
        console.error('Error relistando publicación', e);
        setError(e?.message ?? 'No se pudo relistar la publicación');
      } finally {
        setRelistingId(null);
        setRelistStep('idle');
      }
    },
    []
  );

  return {
    items,
    loading,
    error,
    reload,
    updatingId,
    relistingId,
    relistStep,
    updatePrice,
    closeItem,
    relistItemWithType,
  };
}
