// lib/meliApi.ts
// Helpers para hablar con Mercado Libre

export const ML_ACCESS_TOKEN =
  "APP_USR-1014187039987973-112115-ec094c7bdc9d393dd3116036acf6af9a-327544193"; // ⚠️ SOLO DEV. NO SUBIR A GITHUB

export type MeliItem = {
  id: string;
  title: string;
  price: number;
  currency_id: string;
  status?: string;
};

// Helper genérico
export async function meliFetch(path: string, options: any = {}) {
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
    allDetails.push(...detail);
  }

  const parsed: MeliItem[] = allDetails
    .filter((it: any) => it.code === 200)
    .map((it: any) => ({
      id: it.body.id,
      title: it.body.title,
      price: it.body.price,
      currency_id: it.body.currency_id,
      status: it.body.status,
    }));

  return parsed;
}
