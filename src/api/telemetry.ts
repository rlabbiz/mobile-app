import { randomUUID as uuid } from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, request } from './client';
type Event = {
  eventId: string; eventName: string; clientTs: string; filmId?: string; partId?: string;
  properties?: { watchedSeconds?: number; positionSeconds?: number; percentComplete?: number; source?: string; screen?: string; direction?: 'next' | 'previous'; query?: string; errorCode?: string };
};
type Batch = { key: string; events: Event[]; sealed?: boolean };
const storageKey = 'filmstream:events:v1';
let writes: Promise<unknown> = Promise.resolve();
let sending: Promise<void> | undefined;
let activeKey: string | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
export async function clearPendingEvents(){
  if(timer){clearTimeout(timer);timer=undefined;}
  if(sending)await sending;
  await locked(()=>AsyncStorage.removeItem(storageKey));
}
function locked<T>(work: () => Promise<T>): Promise<T> {
  const task = writes.then(work); writes = task.catch(() => undefined); return task;
}
async function load(): Promise<Batch[]> {
  const value = await AsyncStorage.getItem(storageKey);
  try { return value ? JSON.parse(value) : []; } catch { return []; }
}
export function flushEvents(): Promise<void> {
  if (sending) return sending;
  sending = (async () => {
    while (true) {
      const batch = await locked(async () => {
        const batches = await load();
        activeKey = batches[0]?.key;
        if (batches[0]) {
          batches[0].sealed = true;
          await AsyncStorage.setItem(storageKey, JSON.stringify(batches));
        }
        return batches[0];
      });
      if (!batch) break;
      try {
        await request('/v1/analytics/events', {
          method: 'POST', headers: { 'Idempotency-Key': batch.key }, body: JSON.stringify({ events: batch.events }),
        });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 400) break;
        await AsyncStorage.setItem('filmstream:events:rejected', JSON.stringify(batch));
      }
      await locked(async () => {
        const batches = await load();
        await AsyncStorage.setItem(storageKey, JSON.stringify(batches.filter(item => item.key !== batch.key)));
      });
    }
  })().catch(() => undefined).finally(() => { sending = undefined; activeKey = undefined; });
  return sending;
}
export function track(eventName: string, filmId?: string, partId?: string, properties?: Event['properties']) {
  const event: Event = { eventId: uuid(), eventName, clientTs: new Date().toISOString(), filmId, partId, properties };
  return locked(async () => {
    const batches = (await load()).filter(batch => Date.parse(batch.events[0].clientTs) > Date.now() - 6 * 86400000);
    const tail = batches[batches.length - 1];
    if (tail && tail.sealed === false && tail.key !== activeKey && tail.events.length < 50) tail.events.push(event);
    else batches.push({ key: uuid(), events: [event], sealed: false });
    await AsyncStorage.setItem(storageKey, JSON.stringify(batches.slice(-100)));
    if (!timer) timer = setTimeout(() => { timer = undefined; void flushEvents(); }, 250);
  }).catch(() => undefined);
}
