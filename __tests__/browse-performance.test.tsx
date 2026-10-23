import React from 'react';
import ReactTestRenderer,{act} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {Image} from 'react-native';
import {useWatchSummaries,useFilmProgress} from '../src/api/watch-progress';
import {FilmCover} from '../src/FilmCover';
import {request} from '../src/api/client';
import {flushEvents} from '../src/api/telemetry';
jest.mock('../src/api/client',()=>({request:jest.fn()}));
jest.mock('../src/api/telemetry',()=>({flushEvents:jest.fn(()=>new Promise(()=>{}))}));
jest.mock('@react-native-async-storage/async-storage',()=>({getItem:jest.fn(async()=>null),setItem:jest.fn(async()=>{})}));
jest.mock('expo-linear-gradient',()=>({LinearGradient:require('react-native').View}));
jest.mock('@expo/vector-icons/Ionicons',()=>({__esModule:true,default:()=>null}));
function Progress(){useWatchSummaries(['film'],true);useFilmProgress('film',true);return null;}
test('progress requests finish even while analytics uploads never resolve',async()=>{
 (request as jest.Mock).mockImplementation(async(path:string)=>path.includes('progress?')?{items:[{filmId:'film',totalParts:1,watchedParts:0,percentComplete:0}]}:{filmId:'film',totalParts:1,watchedParts:0,percentComplete:0,parts:[]});
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});let tree:ReactTestRenderer.ReactTestRenderer;
 try{await act(async()=>{tree=ReactTestRenderer.create(<QueryClientProvider client={client}><Progress/></QueryClientProvider>);});await act(async()=>{await new Promise<void>(r=>setTimeout(r,30));});
 expect(flushEvents).toHaveBeenCalled();expect(client.getQueryState(['watch-summaries','film'])?.status).toBe('success');expect(client.getQueryState(['watch-progress','film'])?.status).toBe('success');
 }finally{await act(async()=>tree!.unmount());client.clear();}
});
test('a group of failed cover images triggers only one catalogue refresh',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}}),invalidate=jest.spyOn(client,'invalidateQueries');let tree:ReactTestRenderer.ReactTestRenderer;
 try{await act(async()=>{tree=ReactTestRenderer.create(<QueryClientProvider client={client}>{Array.from({length:10},(_,id)=><FilmCover key={id} film={{id:String(id),title:'Film',posterUrl:'https://example.com/'+id+'.jpg'} as any}/>)}</QueryClientProvider>);});
 const images=tree!.root.findAllByType(Image);await act(async()=>{for(const image of images)image.props.onError();});
 expect(invalidate.mock.calls.filter(([filters])=>filters?.queryKey?.[0]==='films')).toHaveLength(1);
 }finally{await act(async()=>tree!.unmount());client.clear();}
});
