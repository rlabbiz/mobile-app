import {useLanguage} from '../i18n';
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient, useIsMutating } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { request } from './client';
type Saves = { film: { saved: boolean }; parts: { partId: string; saved: boolean }[] };
export function useSave(filmId: string, partId?: string) {
  const queries = useQueryClient(), key = ['saves',filmId], mutationKey=['save-mutation',filmId];
  const saving=useIsMutating({mutationKey})>0;
  const query = useQuery({ queryKey: key, queryFn: ({signal}) => request<Saves>(`/v1/films/${filmId}/saves`,{signal}), staleTime: 0 });
  const saved = (partId ? query.data?.parts?.find(part => part.partId === partId)?.saved : query.data?.film?.saved) ?? false;
  const mutation = useMutation({
    mutationKey,
    mutationFn: (value: boolean) => request<{ saved: boolean }>(`/v1/films/${filmId}/${partId ? `parts/${partId}/` : ''}save`, { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ saved: value }) }),
    onMutate:async()=>{await queries.cancelQueries({queryKey:key});},
    onSuccess: result => {
      queries.setQueryData<Saves>(key,old => !old ? old : ({ film: partId ? old.film : result, parts: old.parts.map(part => part.partId === partId ? { ...part,...result } : part) }));
      void queries.invalidateQueries({ queryKey: ['films-saved'] });
      void queries.invalidateQueries({ queryKey: ['reel-feed',true] });
      void queries.invalidateQueries({queryKey:key});
    },
  });
  return { saved, parts: query.data?.parts ?? [], pending: query.isPending || saving, error: query.isError || mutation.isError, toggle: () => { if (!query.isPending && queries.isMutating({mutationKey})===0) mutation.mutate(!saved); } };
}
export function SaveButton({ save, rail = false }: { save: ReturnType<typeof useSave>; rail?: boolean }) {
  const {t}=useLanguage();
  return <Pressable accessibilityRole="button" accessibilityLabel={save.saved ? 'Remove from saved' : 'Save'} accessibilityState={{ selected: save.saved, disabled: save.pending }} disabled={save.pending} onPress={save.toggle} style={[styles.button,rail && styles.rail]}>
    <Ionicons name={save.saved ? 'bookmark' : 'bookmark-outline'} size={rail ? 29 : 19} color={save.saved ? '#F25B78' : '#fff'} />
    <Text style={[styles.label,rail && styles.railLabel]}>{t(save.error ? 'Retry' : save.saved ? 'Saved' : 'Save')}</Text>
  </Pressable>;
}
const styles=StyleSheet.create({ button: { minHeight:44, paddingHorizontal:12, borderRadius:22, flexDirection:'row', alignItems:'center',justifyContent:'center',gap:6,backgroundColor:'rgba(28,28,34,0.72)' }, label:{fontSize:11,color:'#fff',fontWeight:'600'},rail:{flexDirection:'column',paddingHorizontal:0,gap:4,backgroundColor:'transparent',minWidth:48},railLabel:{fontSize:10,textShadowColor:'#000',textShadowRadius:4} });
