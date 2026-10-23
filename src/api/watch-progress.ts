import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { request } from './client';
import { flushEvents } from './telemetry';
import { readProgress, saveProgress } from '../storage/progress';
import type { Part } from './types';
export type WatchSummary = { filmId:string; totalParts:number; watchedParts:number; percentComplete:number };
type PartProgress = { partId:string; durationSeconds:number; positionSeconds:number; completed:boolean; percentComplete:number };
export type FilmProgress = WatchSummary & { parts:PartProgress[] };
const historyKey='filmstream:watch-history:v1';
let writes:Promise<unknown>=Promise.resolve();
export async function clearWatchHistory(){
  await writes;
  const keys=await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter(key=>key===historyKey||key.startsWith('progress:')));
}
async function history():Promise<Record<string,FilmProgress>> {
  try { return JSON.parse(await AsyncStorage.getItem(historyKey) ?? '{}'); } catch { return {}; }
}
function calculate(value:FilmProgress):FilmProgress {
  const duration=value.parts.reduce((sum,p)=>sum+p.durationSeconds,0);
  return {...value,totalParts:value.parts.length,watchedParts:value.parts.filter(p=>p.completed).length,
    percentComplete:duration ? 100*value.parts.reduce((sum,p)=>sum+(p.completed?p.durationSeconds:Math.min(p.durationSeconds,p.positionSeconds)),0)/duration : 0};
}
function merge(server:FilmProgress,local?:FilmProgress):FilmProgress {
  return calculate({...server,parts:server.parts.map(part=>{
    const old=local?.parts.find(p=>p.partId===part.partId);
    const completed=part.completed || old?.completed === true;
    const positionSeconds=Math.min(part.durationSeconds,Math.max(part.positionSeconds,old?.positionSeconds ?? 0));
    return {...part,completed,positionSeconds,percentComplete:completed?100:100*positionSeconds/Math.max(1,part.durationSeconds)};
  })});
}
export function useWatchSummaries(ids:string[],focused:boolean) {
  const queries=useQueryClient();
  return useQuery({queryKey:['watch-summaries',ids.join(',')],enabled:focused && ids.length>0,staleTime:15000,
    queryFn:async()=>{
      void flushEvents();
      const local=await history();
      const batches=[];
      for(let i=0;i<ids.length;i+=50) batches.push(request<{items:WatchSummary[]}>(`/v1/films/progress?filmIds=${ids.slice(i,i+50).join(',')}`));
      const items=(await Promise.all(batches)).flatMap(batch=>batch.items).map(item=>{
        const saved=queries.getQueryData<FilmProgress>(['watch-progress',item.filmId]) ?? local[item.filmId];
        return {...item,watchedParts:Math.min(item.totalParts,Math.max(item.watchedParts,saved?.watchedParts ?? 0)),percentComplete:Math.max(item.percentComplete,saved?.percentComplete ?? 0)};
      });
      return {items};
    }});
}
export function useFilmProgress(filmId:string,focused:boolean) {
  const queries=useQueryClient();
  return useQuery({queryKey:['watch-progress',filmId],enabled:focused,staleTime:0,queryFn:async()=>{
    void flushEvents();
    const server=await request<FilmProgress>(`/v1/films/${filmId}/progress`);
    const local=(await history())[filmId];
    // Preserve progress recorded by earlier app versions on this installation.
    const legacy=await Promise.all(server.parts.map(async p=>({p,saved:await readProgress(p.partId)})));
    const merged=merge(merge(server,local),queries.getQueryData<FilmProgress>(['watch-progress',filmId]));
    const result=calculate({...merged,parts:merged.parts.map(p=>{
      const old=legacy.find(item=>item.p.partId===p.partId)?.saved;
      const completed=p.completed || old?.completed === true;
      const positionSeconds=Math.min(p.durationSeconds,Math.max(p.positionSeconds,old?.position ?? 0));
      return {...p,completed,positionSeconds,percentComplete:completed?100:100*positionSeconds/Math.max(1,p.durationSeconds)};
    })});
    const task=writes.then(async()=>{const saved=await history();saved[filmId]=merge(result,saved[filmId]);await AsyncStorage.setItem(historyKey,JSON.stringify(saved));});
    writes=task.catch(()=>undefined);
    return result;
  }});
}
export function useRecordWatch(filmId:string,part:Part,allParts:Part[]) {
  const queries=useQueryClient();
  return useCallback((position:number,completed=false)=>{
    const old=queries.getQueryData<FilmProgress>(['watch-progress',filmId]);
    const item={partId:part.id,durationSeconds:part.durationSeconds,positionSeconds:Math.max(0,Math.min(part.durationSeconds,position)),completed,percentComplete:0};
    const base=old ?? {filmId,totalParts:allParts.length,watchedParts:0,percentComplete:0,parts:allParts.map(p=>({partId:p.id,durationSeconds:p.durationSeconds,positionSeconds:0,completed:false,percentComplete:0}))};
    const parts=base.parts.some(p=>p.partId===part.id)?base.parts.map(p=>p.partId===part.id?item:p):[...base.parts,item];
    const updated=merge({...base,parts},old);
    queries.setQueryData(['watch-progress',filmId],updated);
    queries.setQueriesData<{items:WatchSummary[]}>({queryKey:['watch-summaries']},previous=>!previous?previous:{items:previous.items.map(p=>p.filmId===filmId?{filmId,totalParts:updated.totalParts,watchedParts:updated.watchedParts,percentComplete:updated.percentComplete}:p)});
    const task=writes.then(async()=>{
      const saved=await history();
      saved[filmId]=merge(updated,saved[filmId]);
      await AsyncStorage.setItem(historyKey,JSON.stringify(saved));
      await saveProgress(part.id,position,saved[filmId].parts.find(p=>p.partId===part.id)?.completed ?? completed);
    });
    writes=task.catch(()=>undefined);
    return task;
  },[filmId,part.id,part.durationSeconds,allParts,queries]);
}
