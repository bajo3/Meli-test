// lib/meliApi.ts
// Helpers para hablar con Mercado Libre via Supabase token

import { supabase } from './supabaseClient';

export const ML_API_BASE = 'https://api.mercadolibre.com';

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

// ===== Manejo de token desde Supabase =====

// cache en memoria para no pegarle a Supabase en cada request
let cachedToken: string | undefined;
let cachedExpiresAt: number | undefined; // UNIX seconds

async function getMeliAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Si ya tengo token en memoria y no venció, uso ese
  if (cachedToken && cachedExpiresAt && now < cachedExpiresAt - 60) {
    return cachedToken;
  }

  const { data, error } = await supabase
    .from('meli_tokens')
    .select('access_token, expires_at')
    .eq('id', 'main')
    .single();

  if (error) {
    console.error('Error leyendo meli_tokens desde Supabase:', error);
    throw new Error('No se pudo leer el token de Mercado Libre (meli_tokens)');
  }

  if (!data || !data.access_token) {
    throw new Error('No hay access_token guardado en meli_tokens');
  }

  // access_token acá está garantizado como string
  const token: string = data.access_token as string;

  // expires_at puede venir como string o number (int8)
  let expiresAt: number | undefined;
  const rawExpires: any = (data as any).expires_at;

  if (rawExpires != null) {
    if (typeof rawExpires === 'number') {
      expiresAt = rawExpires;
    } else if (typeof rawExpires === 'string') {
      const parsed = parseInt(rawExpires, 10);
      if (!Number.isNaN(parsed)) {
        expiresAt = parsed;
      }
    }
  }

  cachedToken = token;
  cachedExpiresAt = expiresAt;

  return token;
}

// Helper genérico
export async function meliFetch(
  path: string,
  options: RequestInit = {}
) {
  const token = await getMeliAccessToken();

  const baseHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const headers: HeadersInit = {
    ...baseHeaders,
    ...(options.headers || {}),
  };

  // normalizo el path por las dudas
  const url =
    path.startsWith('http')
      ? path
      : `${ML_API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  // intento parsear JSON pero si no es JSON guardo el texto
  let data: any = null;
  let rawText: string | null = null;

  try {
    rawText = await res.text();
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = rawText;
  }

  if (!res.ok) {
    console.error('ML ERROR', res.status, data);

    // caso típico de token vencido / inválido
    if (res.status === 401 || res.status === 403) {
      // invalido cache por las dudas
      cachedToken = undefined;
      cachedExpiresAt = undefined;
      throw new Error('Token de Mercado Libre inválido o vencido');
    }

    let msg = 'Error en petición a Mercado Libre';

    if (data && typeof data === 'object') {
      if ((data as any).message) {
        msg += `: ${(data as any).message}`;
      }
      if (Array.isArray((data as any).cause) && (data as any).cause.length > 0) {
        const causeMsg = (data as any).cause
          .map((c: any) => c?.message)
          .filter(Boolean)
          .join(', ');
        if (causeMsg) {
          msg += ` (${causeMsg})`;
        }
      }
    } else if (typeof data === 'string' && data.trim()) {
      msg += `: ${data}`;
    }

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
    const detail = await meliFetch(`/items?ids=${group.join(',')}`);
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
