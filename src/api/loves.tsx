import {useLanguage} from '../i18n';
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { request } from './client';
import type { Film } from './types';
import Ionicons from '@expo/vector-icons/Ionicons';
type Love = { loved: boolean; count: number; views?: number };
type Loves = { film: Love; parts: (Love & { partId: string })[] };
export function useLove(filmId: string, partId?: string) {
  const queries = useQueryClient();
  const key = ['loves', filmId];
  const query = useQuery({ queryKey: key, queryFn: () => request<Loves>(`/v1/films/${filmId}/loves`), staleTime: 15000 });
  const value = partId ? query.data?.parts.find(part => part.partId === partId) : query.data?.film;
  const mutation = useMutation({
    mutationFn: async ({ loved, source }: { loved: boolean; source: string }) => {
      const result = await request<Love>(`/v1/films/${filmId}/${partId ? `parts/${partId}/` : ''}love`, {
        method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ loved, source }),
      });
      return result;
    },
    onSuccess: result => {
      if (!partId) queries.setQueriesData<{ pages: { items: Film[]; nextCursor: string | null }[]; pageParams: unknown[] }>({ queryKey: ['films'] }, old => !old ? old : ({
        ...old, pages: old.pages.map(page => ({ ...page, items: page.items.map(film => film.id === filmId ? { ...film, loves: result.count, views: result.views ?? film.views } : film) })),
      }));
      queries.setQueryData<Loves>(key, old => !old ? old : ({
        film: partId ? old.film : { ...old.film, ...result },
        parts: old.parts.map(part => part.partId === partId ? { ...part, ...result, partId } : part),
      }));
    },
  });
  return {
    loved: value?.loved ?? false, count: value?.count ?? 0, views: value?.views,
    pending: mutation.isPending || query.isPending,
    error: mutation.isError || query.isError,
    setLoved: (loved: boolean, source = 'button') => {
      if (!mutation.isPending && (!value || value.loved !== loved)) mutation.mutate({ loved, source });
    },
  };
}
export function LoveButton({ love, rail = false }: { love: ReturnType<typeof useLove>; rail?: boolean }) {
  const {t}=useLanguage();
  return <Pressable
    accessibilityRole="button" accessibilityLabel={love.loved ? 'Remove love' : 'Love'}
    accessibilityState={{ selected: love.loved, disabled: love.pending }}
    disabled={love.pending} hitSlop={8}
    onPress={() => love.setLoved(!love.loved)} style={[styles.button,rail && styles.rail]}
  >
    <Ionicons name={love.loved ? 'heart' : 'heart-outline'} size={rail ? 32 : 23} color={love.loved ? '#F25B78' : '#fff'} />
    <Text style={[styles.count, love.loved && styles.selected]}>{love.error ? t('Retry') : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(love.count)}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minWidth: 64, minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(28,28,34,0.72)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },
  heart: { fontSize: 23, lineHeight: 27, color: '#DADAE2' },
  selected: { color: '#F25B78' },
  rail: { flexDirection: 'column', backgroundColor: 'transparent', borderWidth: 0, minWidth: 48, paddingHorizontal: 0, gap: 4 },
  count: { fontSize: 11, fontWeight: '600', color: '#DADAE2', fontVariant: ['tabular-nums'] },
});
