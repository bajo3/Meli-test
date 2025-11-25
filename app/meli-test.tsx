// app/meli-test.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useMeliItems } from '../hooks/useMeliItems';
import MeliItemRow from '../components/MeliItemRow';

type ListingFilter = 'all' | 'silver' | 'gold';
type SortOrder = 'date-desc' | 'date-asc';

export default function MeliTestScreen() {
  const {
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
  } = useMeliItems();

  const [search, setSearch] = useState('');
  const [listingFilter, setListingFilter] = useState<ListingFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('date-desc');
  const [filtersOpen, setFiltersOpen] = useState(true);

  const filteredItems = useMemo(() => {
    let result = [...items];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
      );
    }

    if (listingFilter === 'silver') {
      result = result.filter((item) => item.listing_type_id === 'silver');
    } else if (listingFilter === 'gold') {
      result = result.filter((item) =>
        item.listing_type_id?.startsWith('gold')
      );
    }

    result.sort((a, b) => {
      const da = a.date_created ? new Date(a.date_created).getTime() : 0;
      const db = b.date_created ? new Date(b.date_created).getTime() : 0;

      if (sortOrder === 'date-desc') {
        // más nuevas primero
        return db - da;
      } else {
        // más viejas primero
        return da - db;
      }
    });

    return result;
  }, [items, search, listingFilter, sortOrder]);

  const handleRelistSilver = (id: string) =>
    relistItemWithType(id, 'silver');

  const handleRelistGold = (id: string) =>
    relistItemWithType(id, 'gold_pro'); // ajustá al listing_type que uses

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Publicaciones Mercado Libre</Text>
        <TouchableOpacity onPress={() => reload()}>
          <Text style={styles.reloadText}>Actualizar</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.toggleFiltersBtn}
        onPress={() => setFiltersOpen((prev) => !prev)}
      >
        <Text style={styles.toggleFiltersText}>
          {filtersOpen ? 'Ocultar filtros ▲' : 'Mostrar filtros ▼'}
        </Text>
      </TouchableOpacity>

      {filtersOpen && (
        <View style={styles.filters}>
          <TextInput
            placeholder="Buscar por título o ID..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />

          <View style={styles.row}>
            <FilterChip
              label="Todos"
              active={listingFilter === 'all'}
              onPress={() => setListingFilter('all')}
            />
            <FilterChip
              label="Plata"
              active={listingFilter === 'silver'}
              onPress={() => setListingFilter('silver')}
            />
            <FilterChip
              label="Oro"
              active={listingFilter === 'gold'}
              onPress={() => setListingFilter('gold')}
            />
          </View>

          <View style={styles.row}>
            <FilterChip
              label="Más recientes"
              active={sortOrder === 'date-desc'}
              onPress={() => setSortOrder('date-desc')}
            />
            <FilterChip
              label="Más viejas"
              active={sortOrder === 'date-asc'}
              onPress={() => setSortOrder('date-asc')}
            />
          </View>
        </View>
      )}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Cargando publicaciones...</Text>
        </View>
      ) : (
        <>
          {error && (
            <Text style={styles.errorText}>
              {error}
            </Text>
          )}

          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={reload} />
            }
            renderItem={({ item }) => (
              <MeliItemRow
                item={item}
                isUpdating={updatingId === item.id}
                isRelisting={relistingId === item.id}
                relistStep={relistStep}
                onUpdatePrice={(newPrice) =>
                  updatePrice(item.id, newPrice)
                }
                onClose={() => closeItem(item.id)}
                onRelistSilver={() => handleRelistSilver(item.id)}
                onRelistGold={() => handleRelistGold(item.id)}
              />
            )}
            contentContainerStyle={
              filteredItems.length === 0 && !loading
                ? styles.emptyContainer
                : undefined
            }
            ListEmptyComponent={
              !loading ? (
                <Text style={styles.emptyText}>
                  No hay publicaciones que coincidan con los filtros.
                </Text>
              ) : null
            }
          />
        </>
      )}
    </View>
  );
}

type FilterChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function FilterChip({ label, active, onPress }: FilterChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#0B0B0F' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '600' },
  reloadText: { color: '#4FC3F7', fontSize: 14 },
  toggleFiltersBtn: { alignSelf: 'flex-end', marginBottom: 8 },
  toggleFiltersText: { color: '#90CAF9', fontSize: 13 },
  filters: {
    backgroundColor: '#15151E',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: '#222436',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#fff',
    marginBottom: 8,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3949AB',
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: '#3949AB',
  },
  chipText: {
    color: '#C5CAE9',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#E8EAF6',
    fontWeight: '600',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#fff', marginTop: 8 },
  errorText: {
    color: '#FF8A80',
    marginBottom: 8,
    fontSize: 13,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#9FA8DA',
    fontSize: 14,
  },
});
