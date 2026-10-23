import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Share} from 'react-native';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {sharePart,SharedScreen,validContentId} from '../src/sharing';
import {request} from '../src/api/client';
import {track} from '../src/api/telemetry';
import type {Film,Part} from '../src/api/types';
jest.mock('../src/api/client',()=>({request:jest.fn()}));
jest.mock('../src/api/telemetry',()=>({track:jest.fn(async()=>undefined)}));
jest.mock('@expo/vector-icons/Ionicons',()=>({__esModule:true,default:()=>null}));
jest.mock('expo-linear-gradient',()=>({LinearGradient:require('react-native').View}));
jest.mock('@react-native-async-storage/async-storage',()=>({getItem:jest.fn(),setItem:jest.fn()}));
const film={id:'11111111-1111-4111-8111-111111111111',title:'A story'} as Film;
const part={id:'22222222-2222-4222-8222-222222222222',title:'Episode 2'} as Part;
const url=`koreva://watch/${film.id}/${part.id}`;
afterEach(()=>jest.restoreAllMocks());
test('shares a validated app link through the native sheet without signed video URLs',async()=>{
 (request as jest.Mock).mockResolvedValue({film,part,parts:[part],url});(track as jest.Mock).mockClear();const native=jest.spyOn(Share,'share').mockResolvedValue({action:Share.sharedAction});
 await sharePart(film,part);expect(native).toHaveBeenCalledTimes(1);expect(JSON.stringify(native.mock.calls[0])).toContain(url);expect(JSON.stringify(native.mock.calls[0])).not.toContain('X-Amz');expect(track).toHaveBeenCalledWith('session_activity',film.id,part.id,{screen:'reel',source:'share_sheet_closed'});
 native.mockResolvedValue({action:Share.dismissedAction});await sharePart(film,part);expect(track).toHaveBeenLastCalledWith('session_activity',film.id,part.id,{screen:'reel',source:'share_dismissed'});
});
test('does not open the sheet for an untrusted returned URL',async()=>{
 (request as jest.Mock).mockResolvedValue({url:'https://other.example/private-token'});const native=jest.spyOn(Share,'share');await expect(sharePart(film,part)).rejects.toThrow('cannot be shared');expect(native).not.toHaveBeenCalled();
});
test.each([false,true])('incoming episode/reel link resolves exactly its playable target (reel=%s)',async isReel=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}}),replace=jest.fn(),target={...part,isReel};(request as jest.Mock).mockResolvedValue({film,part:target,parts:[part],url});let renderer:ReactTestRenderer.ReactTestRenderer;
 try{await ReactTestRenderer.act(async()=>{renderer=ReactTestRenderer.create(<QueryClientProvider client={client}><SharedScreen route={{key:'shared',name:'Shared',params:{filmId:film.id,partId:part.id}}} navigation={{replace} as any}/></QueryClientProvider>);});await ReactTestRenderer.act(async()=>{await new Promise<void>(r=>setTimeout(r,30));});expect(replace).toHaveBeenCalledWith('Player',{film,part:target,parts:isReel?[target]:[part]});}
 finally{await ReactTestRenderer.act(async()=>renderer!.unmount());client.clear();}
});
test('rejects malformed link IDs before making any authenticated request',async()=>{
 expect(validContentId('../profile')).toBe(false);const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});(request as jest.Mock).mockClear();let renderer:ReactTestRenderer.ReactTestRenderer;
 await ReactTestRenderer.act(async()=>{renderer=ReactTestRenderer.create(<QueryClientProvider client={client}><SharedScreen route={{key:'bad',name:'Shared',params:{filmId:'../profile',partId:part.id}}} navigation={{replace:jest.fn()} as any}/></QueryClientProvider>);});expect(request).not.toHaveBeenCalled();expect(JSON.stringify(renderer!.toJSON())).toContain('invalid');await ReactTestRenderer.act(async()=>renderer!.unmount());client.clear();
});
