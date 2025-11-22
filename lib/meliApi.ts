// lib/meliApi.ts
// Helpers para hablar con Mercado Libre

export const ML_API_BASE = "https://api.mercadolibre.com";

// ⚠️ SOLO DEV. Idealmente sacarlo a env o a globalThis.ML_ACCESS_TOKEN
export const ML_ACCESS_TOKEN =
  (globalThis as any).ML_ACCESS_TOKEN ||
  "APP_USR-1014187039987973-112205-e71f78850a4fa5cddb2af6eb6e2d5e32-327544193";

export type MeliItem = {
  id: string;
  title: string;
  price: number;
  currency_id: string;
  available_quantity: number;
  status: string;
  listing_type_id: string;
  date_created?: string;
  thumbnail?: string;
  permalink?: string;
  attributes?: any[];
};

// Helper genérico
export async function meliFetch(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const url = `${ML_API_BASE}${path}`;
  const method = options.method || "GET";

  console.log(`ML FETCH: ${method} ${path}`);

  const res = await fetch(url, {
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

    const msg =
      data?.cause
        ?.map((c: any) => `${c.field ?? ""} → ${c.message ?? c.code}`)
        .join("\n") ||
      data?.message ||
      data?.error ||
      `Error ML: ${res.status}`;

    throw new Error(msg);
  }

  return data;
}

// Cortar un array en bloques de tamaño "size"
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Traer detalle de ítems por ID (respeta límite de 20 ids por request)
export async function getItemsByIds(ids: string[]): Promise<MeliItem[]> {
  if (!ids.length) return [];

  const chunks = chunkArray(ids, 20); // ML permite hasta 20 por llamada
  const allDetails: any[] = [];

  for (const group of chunks) {
    const detail = await meliFetch(`/items?ids=${group.join(",")}`);
    // detail: [{ code, body }, ...]
    allDetails.push(...detail);
  }

  const parsed: MeliItem[] = allDetails
    .filter((it: any) => it && it.code === 200 && it.body)
    .map((it: any) => {
      const b = it.body;
      return {
        id: b.id,
        title: b.title,
        price: b.price,
        currency_id: b.currency_id,
        available_quantity: b.available_quantity,
        status: b.status,
        listing_type_id: b.listing_type_id,
        date_created: b.date_created,
        thumbnail: b.thumbnail,
        permalink: b.permalink,
        attributes: b.attributes,
      } as MeliItem;
    });

  return parsed;
}
