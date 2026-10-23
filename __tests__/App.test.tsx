/** @format */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { HomeScreen, PlayerScreen, FilmScreen } from '../src/screens';
import {ReelsScreen,SavedScreen} from '../src/ReelsScreen';
import { AppState, FlatList, View, StyleSheet } from 'react-native';
import ExpoPlayer from '../src/ExpoPlayer';
import { request } from '../src/api/client';
import {flushEvents} from '../src/api/telemetry';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {FlashList} from '@shopify/flash-list';
jest.mock('react-native-pager-view',()=>({__esModule:true,default:class extends require('react').Component {setPage(position:number){this.props.onPageSelected({nativeEvent:{position}});} render(){return require('react').createElement(require('react-native').View,this.props,this.props.children);}}}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));
jest.mock('../src/api/telemetry', () => ({ track: jest.fn(),flushEvents:jest.fn(async()=>undefined) }));
jest.mock('../src/api/client', () => ({
  request: jest.fn(async (path:string) => path==='/v1/home/categories'?{items:[{id:'for-you',name:'For You',sort:'popular',genre:null,isForYou:true}]}:{ items: [], nextCursor: null }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,useSafeAreaInsets:()=>({top:24,bottom:24,left:0,right:0}),
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('../src/ExpoPlayer', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('@shopify/flash-list', () => ({
  FlashList: ({ data, renderItem, ListEmptyComponent, ListHeaderComponent }: any) => require('react').createElement(require('react-native').View, null,ListHeaderComponent,
    data?.length ? data.map((item: any, index: number) => require('react').createElement(require('react').Fragment, { key: item.id ?? item.part?.id ?? item.name }, renderItem({ item, index }))) : ListEmptyComponent),
}));
// Native viewport measurement is unavailable in Jest; render the bounded pages
// so the test can verify player ownership as viewability changes.
jest.mock('react-native/Libraries/Lists/FlatList', () => ({
  __esModule: true,
  default: require('react').forwardRef(({ data, renderItem }: any,ref:any) => { require('react').useImperativeHandle(ref,()=>({scrollToIndex:jest.fn()}));return require('react').createElement(
    require('react-native').View,
    null,
    data.map((item: any, index: number) => require('react').createElement(
      require('react').Fragment, { key: item.id ?? item.part?.id ?? item.name }, renderItem({ item, index }),
    )),
  );}),
}));
test('opens the catalogue without a signup form', async () => {
  jest.useRealTimers();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <QueryClientProvider client={client}>
        <HomeScreen
          navigation={{ navigate: jest.fn() } as any}
          route={{ key: 'home', name: 'Home' }}
        />
      </QueryClientProvider>,
    );
    await new Promise<void>(resolve => setTimeout(() => resolve(), 20));
  });
  for(let attempt=0;attempt<25&&!JSON.stringify(renderer!.toJSON()).includes('For You');attempt++)await ReactTestRenderer.act(async()=>{await new Promise<void>(r=>setTimeout(r,20));});
  const output = JSON.stringify(renderer!.toJSON());
  expect(output).toContain('For You');
  expect(output).not.toContain('Sign up');
  await ReactTestRenderer.act(async () => renderer!.unmount());
  client.clear();
});
test('discovery loads even with stalled analytics, mixes films, and explores the current film',async()=>{
  (flushEvents as jest.Mock).mockImplementationOnce(()=>new Promise(()=>{}));
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{gcTime:0}}});
  const items=[1,2].map(id=>({film:{id:`mix-film-${id}`,title:`Mixed story ${id}`,genres:['Action'],posterUrl:null},part:{id:`mix-reel-${id}`,position:1,title:'Clip',isReel:true,durationSeconds:30,accessPolicy:'free'}}));
  (request as jest.Mock).mockImplementation(async(path:string)=>path.startsWith('/v1/reels?')?{items,nextCursor:null}:path.endsWith('/loves')?{film:{loved:false,count:0},parts:items.map(i=>({partId:i.part.id,loved:false,count:0}))}:path.endsWith('/saves')?{film:{saved:false},parts:items.map(i=>({partId:i.part.id,saved:false}))}:{url:`https://media.example/${path.includes('mix-reel-2')?'second':'first'}.m3u8`,durationSeconds:30,expiresAt:new Date(Date.now()+300000).toISOString()});
  const navigation={navigate:jest.fn()} as any;
  let renderer:ReactTestRenderer.ReactTestRenderer;
  try{
    await ReactTestRenderer.act(async()=>{renderer=ReactTestRenderer.create(<QueryClientProvider client={client}><ReelsScreen navigation={navigation} route={{key:'reels',name:'Reels'}}/></QueryClientProvider>);});
    await ReactTestRenderer.act(async()=>{renderer!.root.findAllByType(View).find(v=>v.props.onLayout)?.props.onLayout({nativeEvent:{layout:{height:800}}});await new Promise<void>(resolve=>setTimeout(resolve,30));});
    await ReactTestRenderer.act(async()=>{await new Promise<void>(r=>setTimeout(r,40));});
    expect(renderer!.root.findAllByType(ExpoPlayer)).toHaveLength(1);
    await ReactTestRenderer.act(async()=>{renderer!.root.findByType(FlatList).props.onViewableItemsChanged({viewableItems:[{index:1,isViewable:true}]});await new Promise<void>(resolve=>setTimeout(resolve,30));});
    expect(renderer!.root.findAllByType(ExpoPlayer)).toHaveLength(1);
    expect(renderer!.root.findByType(ExpoPlayer).props.url).toContain('second');
    expect(StyleSheet.flatten(renderer!.root.findAllByType(View).find(node=>node.props.testID==='player-footer')!.props.style).paddingBottom).toBe(6);
    expect(renderer!.root.findByType(FlatList).props.ListFooterComponent).toBeUndefined();expect(renderer!.root.findByType(FlatList).props.bounces).toBe(false);
    const explore=renderer!.root.findAll(button=>button.props.accessibilityLabel==='Explore film'&&typeof button.props.onPress==='function')[0];
    await ReactTestRenderer.act(async()=>explore.props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith('Film',{film:items[1].film});
  }finally{await ReactTestRenderer.act(async()=>renderer!.unmount());client.clear();}
});

test('reels keep one player active, switch parts in place and offer only minimal controls', async () => {
  AppState.currentState = null as any;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 60000 }, mutations: { gcTime: 0 } } });
  const film = { id: 'film', title: 'A film', posterUrl: null } as any;
  const parts = [1, 2].map(position => ({
    id: `part-${position}`, title: `Chapter ${position}`, position,
    accessPolicy: 'free', previewAllowed: false, durationSeconds: 60,
  })) as any;
  (request as jest.Mock).mockImplementation(async (path: string) => path.endsWith('/save') ? { saved: true } : path.endsWith('/saves') ? { film: { saved: false }, parts: parts.map((part: any) => ({ partId: part.id, saved: false })) } : path.endsWith('/love') ? { loved: true, count: 1, views: 1 } : path.endsWith('/loves') ? { film: { loved: false, count: 0, views: 0 }, parts: parts.map((part: any) => ({ partId: part.id, loved: false, count: 0, views: 0 })) } : ({
    url: `https://media.example/${path.includes('part-2') ? 'second' : 'first'}.m3u8`,
    durationSeconds: 60, expiresAt: new Date(Date.now() + 300000).toISOString(),
  }));
  const navigation = { goBack: jest.fn(), replace: jest.fn() } as any;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  try {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <QueryClientProvider client={client}>
          <PlayerScreen navigation={navigation} route={{ key: 'player', name: 'Player', params: { film, part: parts[0], parts } }} />
        </QueryClientProvider>,
      );
    });
    await ReactTestRenderer.act(async () => {
      renderer!.root.findAllByType(View).find(view => view.props.onLayout)?.props.onLayout({ nativeEvent: { layout: { height: 800 } } });
    });
    await ReactTestRenderer.act(async () => { await new Promise<void>(resolve => setTimeout(resolve, 30)); });
    expect(renderer!.root.findAllByType(ExpoPlayer)).toHaveLength(1);
    expect(renderer!.root.findByType(ExpoPlayer).props.paused).toBe(false);
    expect(renderer!.root.findByType(ExpoPlayer).props.contentFit).toBe('contain');
    const footer=()=>renderer!.root.findAllByType(View).find(node=>node.props.testID==='player-footer')!;
    expect(StyleSheet.flatten(footer().props.style).paddingBottom).toBe(30);
    await ReactTestRenderer.act(async()=>{
      renderer!.root.findAllByType(View).find(node=>node.props.testID==='part-reel')!.props.onLayout({nativeEvent:{layout:{width:390,height:800}}});
      renderer!.root.findByType(ExpoPlayer).props.onVideoSize({width:1920,height:1032});
      footer().props.onLayout({nativeEvent:{layout:{height:108}}});
    });
    const frame=StyleSheet.flatten(renderer!.root.findAllByType(View).find(node=>node.props.testID==='player-video-frame')!.props.style);
    expect(frame.width).toBe(390);expect(frame.height).toBeCloseTo(390*1032/1920);
    expect(StyleSheet.flatten(renderer!.root.findAllByType(View).find(node=>node.props.testID==='player-action-rail')!.props.style).bottom).toBe(120);
    expect(await renderer!.root.findByType(ExpoPlayer).props.initialPosition()).toBe(0);
    expect(JSON.stringify(renderer!.toJSON())).toContain('1:00');
    await ReactTestRenderer.act(async () => renderer!.root.findByType(ExpoPlayer).props.onProgress({ currentTime: 12 }));
    expect(JSON.stringify(renderer!.toJSON())).toContain('0:12');
    const seekBy = jest.fn((_seconds:number) => 5);
    const replay = jest.fn();
    renderer!.root.findByType(ExpoPlayer).props.controlRef.current = { seekBy, replay };
    await ReactTestRenderer.act(async()=>renderer!.root.findAll(node=>node.props.accessibilityLabel==='Seek episode'&&typeof node.props.onLayout==='function')[0].props.onLayout({nativeEvent:{layout:{width:200}}}));
    await ReactTestRenderer.act(async()=>renderer!.root.findAll(node=>node.props.accessibilityLabel==='Seek episode'&&typeof node.props.onPress==='function')[0].props.onPress({nativeEvent:{locationX:100}}));
    expect(seekBy.mock.calls[0][0]).toBeCloseTo(17.95,2);
    for (const [label, seconds] of [['Double tap to skip forward 5 seconds', 5], ['Double tap to rewind 5 seconds', -5]] as const) {
      const edge = renderer!.root.findAll(button => button.props.accessibilityLabel === label && typeof button.props.onPress === 'function')[0];
      await ReactTestRenderer.act(async () => { edge.props.onPress(); edge.props.onPress(); });
      expect(seekBy).toHaveBeenLastCalledWith(seconds);
    }
    const mute = renderer!.root.findAll(button => button.props.accessibilityLabel === 'Mute video' && typeof button.props.onPress === 'function')[0];
    await ReactTestRenderer.act(async () => mute.props.onPress());
    expect(renderer!.root.findByType(ExpoPlayer).props.muted).toBe(true);
    const save = renderer!.root.findAll(button => button.props.accessibilityLabel === 'Save' && typeof button.props.onPress === 'function')[0];
    await ReactTestRenderer.act(async () => { save.props.onPress(); await new Promise<void>(resolve => setTimeout(resolve, 30)); });
    expect((request as jest.Mock).mock.calls.some(([path, options]) => path.endsWith('/parts/part-1/save') && JSON.parse(options.body).saved)).toBe(true);
    const pause = renderer!.root.findAll(button => button.props.accessibilityLabel === 'Pause part' && typeof button.props.onPress === 'function')[0];
    await ReactTestRenderer.act(async () => { pause.props.onPress(); await new Promise<void>(resolve => setTimeout(resolve, 270)); });
    expect(renderer!.root.findByType(ExpoPlayer).props.paused).toBe(true);
    for (const [label, seconds] of [['Rewind 5 seconds',-5],['Forward 5 seconds',5]] as const) {
      const seek = renderer!.root.findAll(button => button.props.accessibilityLabel === label && typeof button.props.onPress === 'function')[0];
      await ReactTestRenderer.act(async () => seek.props.onPress());
      expect(seekBy).toHaveBeenLastCalledWith(seconds);
      expect(renderer!.root.findByType(ExpoPlayer).props.paused).toBe(true);
    }
    const resume = renderer!.root.findAll(button => button.props.accessibilityLabel === 'Resume part' && typeof button.props.onPress === 'function')[0];
    await ReactTestRenderer.act(async () => { resume.props.onPress(); await new Promise<void>(resolve => setTimeout(resolve, 270)); });
    const centre = renderer!.root.findAll(button => button.props.accessibilityLabel === 'Pause part' && typeof button.props.onPress === 'function')[0];
    await ReactTestRenderer.act(async () => { centre.props.onPress(); centre.props.onPress(); });
    await ReactTestRenderer.act(async () => { await new Promise<void>(resolve => setTimeout(resolve, 30)); });
    expect(renderer!.root.findByType(ExpoPlayer).props.paused).toBe(false);
    renderer!.root.findByType(ExpoPlayer).props.controlRef.current = { seekBy,replay };
    await ReactTestRenderer.act(async () => renderer!.root.findByType(ExpoPlayer).props.onEnd());
    expect(JSON.stringify(renderer!.toJSON())).toContain('Watch again');
    expect(renderer!.root.findByType(ExpoPlayer).props.paused).toBe(true);
    const again = renderer!.root.findAll(button => button.props.accessibilityLabel === 'Replay part' && typeof button.props.onPress === 'function')[0];
    await ReactTestRenderer.act(async () => again.props.onPress());
    expect(replay).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(['watch-progress','film'])).toMatchObject({totalParts:2,watchedParts:1,percentComplete:50});
    expect(renderer!.root.findByType(ExpoPlayer).props.paused).toBe(false);
    expect(JSON.stringify(renderer!.toJSON())).not.toContain('Watch again');
    const loveCalls = (request as jest.Mock).mock.calls.filter(([path]) => path.endsWith('/love'));
    expect(loveCalls).toHaveLength(1);
    expect(JSON.parse(loveCalls[0][1].body)).toEqual({ loved: true, source: 'double_tap' });
    await ReactTestRenderer.act(async () => {
      const pager = renderer!.root.findByType(FlatList);
      expect(pager.props.initialScrollIndex).toBe(0);
      expect(pager.props.data.map((part: any) => part.id)).toEqual(['part-1', 'part-2']);
      expect(pager.props.inverted).toBeUndefined();
      pager.props.onViewableItemsChanged({ viewableItems: [{ index: 1, isViewable: true }] });
      await new Promise<void>(resolve => setTimeout(resolve, 30));
    });
    expect(renderer!.root.findAllByType(ExpoPlayer)).toHaveLength(1);
    expect(renderer!.root.findByType(ExpoPlayer).props.url).toContain('second.m3u8');
    expect(renderer!.root.findByType(ExpoPlayer).props.muted).toBe(true);
    expect(navigation.replace).not.toHaveBeenCalled();
    const output = JSON.stringify(renderer!.toJSON());
    expect(output).toContain('Chapter 2');
    expect(output).not.toContain('Next part');
    expect(output).not.toContain('Swipe down');
    await ReactTestRenderer.act(async () => {
      renderer!.root.findByType(FlatList).props.onViewableItemsChanged({ viewableItems: [{ index: 0, isViewable: true }] });
      await new Promise<void>(resolve => setTimeout(resolve, 30));
    });
    expect(renderer!.root.findAllByType(ExpoPlayer)).toHaveLength(1);
    expect(renderer!.root.findByType(ExpoPlayer).props.url).toContain('first.m3u8');
    expect(renderer!.root.findByType(ExpoPlayer).props.paused).toBe(false);
    const back = renderer!.root.findAll(button => button.props.accessibilityLabel === 'Back to films' && typeof button.props.onPress === 'function')[0];
    back.props.onPress();
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  } finally {
    await ReactTestRenderer.act(async () => renderer!.unmount());
    client.clear();
  }
});

test('film details show completed and partial part bars with a film summary',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
  const film={id:'progress-film',title:'Progress story',genres:[],durationSeconds:120,posterUrl:null} as any;
  const parts=[1,2].map(position=>({id:`progress-${position}`,position,title:`Episode ${position}`,durationSeconds:60,accessPolicy:'free'})) as any;
  (request as jest.Mock).mockImplementation(async(path:string)=>path.endsWith('/progress')?{filmId:film.id,totalParts:2,watchedParts:1,percentComplete:75,parts:parts.map((p:any,i:number)=>({partId:p.id,durationSeconds:60,positionSeconds:i?30:60,completed:!i,percentComplete:i?50:100}))}:path.endsWith('/loves')?{film:{loved:false,count:0},parts:[]}:path.endsWith('/saves')?{film:{saved:false},parts:[]}:{film,parts});
  let renderer:ReactTestRenderer.ReactTestRenderer;
  try{
    await ReactTestRenderer.act(async()=>{renderer=ReactTestRenderer.create(<QueryClientProvider client={client}><FilmScreen route={{key:'film',name:'Film',params:{film}}} navigation={{navigate:jest.fn()} as any}/></QueryClientProvider>);});
    await ReactTestRenderer.act(async()=>{await new Promise<void>(resolve=>setTimeout(resolve,30));});
    const bars=renderer!.root.findAll(node=>node.props.accessibilityRole==='progressbar');
    expect(bars.some(bar=>bar.props.accessibilityLabel==='Film watch progress'&&bar.props.accessibilityValue.now===75)).toBe(true);
    expect(bars.some(bar=>bar.props.accessibilityLabel==='Episode 1 watch progress'&&bar.props.accessibilityValue.now===100)).toBe(true);
    expect(bars.some(bar=>bar.props.accessibilityLabel==='Episode 2 watch progress'&&bar.props.accessibilityValue.now===50)).toBe(true);
    expect(JSON.stringify(renderer!.toJSON())).toContain('episodes watched');
  }finally{await ReactTestRenderer.act(async()=>renderer!.unmount());client.clear();}
});
test('film details hides the trailer completely',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
  const film={id:'trailer-film',title:'Trailer story',genres:[],durationSeconds:60,posterUrl:null,trailer:{assetId:'selected-trailer',durationSeconds:30}} as any;
  (request as jest.Mock).mockImplementation(async(path:string)=>path.includes('/playback')?{url:'https://media.example/detail-trailer.m3u8',durationSeconds:60,expiresAt:new Date(Date.now()+300000).toISOString()}:path.endsWith('/progress')?{filmId:film.id,totalParts:0,watchedParts:0,percentComplete:0,parts:[]}:path.endsWith('/loves')?{film:{loved:false,count:0},parts:[]}:path.endsWith('/saves')?{film:{saved:false},parts:[]}:{film,parts:[]});
  let renderer:ReactTestRenderer.ReactTestRenderer;
  try{
    await ReactTestRenderer.act(async()=>{renderer=ReactTestRenderer.create(<QueryClientProvider client={client}><FilmScreen route={{key:'film',name:'Film',params:{film}}} navigation={{navigate:jest.fn()} as any}/></QueryClientProvider>);});
    await ReactTestRenderer.act(async()=>{await new Promise<void>(resolve=>setTimeout(resolve,30));});
    expect(renderer!.root.findAllByType(ExpoPlayer)).toHaveLength(0);
  }finally{await ReactTestRenderer.act(async()=>renderer!.unmount());client.clear();}
});
test('Home uses admin categories with synchronized native paging and no shelves or autoplay',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}}),navigate=jest.fn();
 const categories=[{id:'for-you',name:'For You',sort:'popular',genre:null,isForYou:true},{id:'hot',name:'Hot',sort:'popular',genre:null,isForYou:false},{id:'new',name:'New',sort:'new',genre:null,isForYou:false},{id:'drama',name:'Drama',sort:'new',genre:'Drama',isForYou:false}];
 const films=[1,2,3].map(id=>({id:'film-'+id,title:'Story '+id,posterUrl:'https://media.example/cover-'+id+'.jpg',genres:['Action'],views:12,loves:3,trailer:{assetId:'trailer-'+id,durationSeconds:30}}));
 (request as jest.Mock).mockClear();(request as jest.Mock).mockImplementation(async(path:string)=>path==='/v1/home/categories'?{items:categories}:path==='/v1/films/last-watched'?{film:null}:path.includes('/films/progress?')?{items:[]}:path.includes('/films?')?{items:films,nextCursor:null}:{items:[],nextCursor:null});
 let renderer:ReactTestRenderer.ReactTestRenderer;
 try{
  await ReactTestRenderer.act(async()=>{renderer=ReactTestRenderer.create(<QueryClientProvider client={client}><HomeScreen navigation={{navigate} as any} route={{key:'home',name:'Home'}}/></QueryClientProvider>);});await ReactTestRenderer.act(async()=>{await new Promise<void>(r=>setTimeout(r,80));});
  expect(renderer!.root.findAllByType(ExpoPlayer)).toHaveLength(0);
  expect(renderer!.root.findAll(n=>typeof n.props.accessibilityLabel==='string'&&n.props.accessibilityLabel.startsWith('See all'))).toHaveLength(0);
  for(const category of categories)expect(renderer!.root.findAll(n=>n.props.accessibilityLabel==='Category: '+category.name&&typeof n.props.onPress==='function')).toHaveLength(1);
  expect((request as jest.Mock).mock.calls.some(([path])=>path.includes('/hot/films?'))).toBe(true);
  expect((request as jest.Mock).mock.calls.some(([path])=>path.includes('/drama/films?'))).toBe(false);
  await ReactTestRenderer.act(async()=>renderer!.root.findAll(n=>n.props.accessibilityLabel==='Category: New'&&typeof n.props.onPress==='function')[0].props.onPress());
  expect(renderer!.root.findAll(n=>n.props.accessibilityLabel==='Category: New'&&typeof n.props.onPress==='function')[0].props.accessibilityState.selected).toBe(true);
  expect((request as jest.Mock).mock.calls.some(([path])=>path.includes('/new/films?'))).toBe(true);
  const pager=renderer!.root.findAll(n=>n.props.testID==='home-category-pager'&&typeof n.props.onPageSelected==='function')[0];
  await ReactTestRenderer.act(async()=>pager.props.onPageSelected({nativeEvent:{position:1}}));
  expect(renderer!.root.findAll(n=>n.props.accessibilityLabel==='Category: Hot'&&typeof n.props.onPress==='function')[0].props.accessibilityState.selected).toBe(true);
  expect((request as jest.Mock).mock.calls.some(([path])=>path.includes('/trailer/playback'))).toBe(false);
  for(const list of renderer!.root.findAllByType(FlashList)){expect(list.props.refreshControl).toBeUndefined();expect(list.props.onRefresh).toBeUndefined();}
  const before=(request as jest.Mock).mock.calls.filter(([path])=>path==='/v1/home/categories').length;
  await ReactTestRenderer.act(async()=>renderer!.root.findAll(n=>n.props.accessibilityLabel==='Refresh films'&&typeof n.props.onPress==='function')[0].props.onPress());
  expect((request as jest.Mock).mock.calls.filter(([path])=>path==='/v1/home/categories')).toHaveLength(before+1);

 }finally{await ReactTestRenderer.act(async()=>renderer!.unmount());client.clear();}
});

test('Saved separates Films, Episodes and Reels without a top Saved shortcut',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{gcTime:0}}});(request as jest.Mock).mockClear();(request as jest.Mock).mockResolvedValue({items:[],nextCursor:null});let renderer:ReactTestRenderer.ReactTestRenderer;
 await ReactTestRenderer.act(async()=>{renderer=ReactTestRenderer.create(<QueryClientProvider client={client}><SavedScreen navigation={{navigate:jest.fn()} as any} route={{key:'saved',name:'Saved'}}/></QueryClientProvider>);await new Promise<void>(r=>setTimeout(r,20));});
 for(const kind of ['episodes','reels']){await ReactTestRenderer.act(async()=>{renderer!.root.findAll(n=>n.props.accessibilityLabel==='Saved '+kind&&typeof n.props.onPress==='function')[0].props.onPress();await new Promise<void>(r=>setTimeout(r,20));});expect((request as jest.Mock).mock.calls.some(([path])=>path.includes('/v1/reels?')&&path.includes('saved=true')&&path.includes('kind='+kind))).toBe(true);}
 expect(renderer!.root.findAll(n=>n.props.accessibilityLabel==='Show saved films and parts')).toHaveLength(0);await ReactTestRenderer.act(async()=>renderer!.unmount());client.clear();
});

test('last watched stays in For You and is excluded from that category grid',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}}),items=[1,2].map(id=>({id:'recent-'+id,title:'Story '+id,genres:[],posterUrl:null,durationSeconds:60}));
 (request as jest.Mock).mockImplementation(async(path:string)=>path==='/v1/home/categories'?{items:[{id:'for-you',name:'For You',sort:'popular',genre:null,isForYou:true},{id:'hot',name:'Hot',sort:'popular',genre:null,isForYou:false}]}:path==='/v1/films/last-watched'?{film:items[1]}:path.includes('/films?')?{items,nextCursor:null}:{items:[],nextCursor:null});let renderer:ReactTestRenderer.ReactTestRenderer;
 try{await ReactTestRenderer.act(async()=>{renderer=ReactTestRenderer.create(<QueryClientProvider client={client}><HomeScreen navigation={{navigate:jest.fn()} as any} route={{key:'home',name:'Home'}}/></QueryClientProvider>);});await ReactTestRenderer.act(async()=>{await new Promise<void>(r=>setTimeout(r,80));});
 expect(renderer!.root.findAll(n=>n.props.accessibilityLabel==='Continue watching Story 2'&&typeof n.props.onPress==='function')).toHaveLength(1);
 expect(renderer!.root.findAllByType(ExpoPlayer)).toHaveLength(0);
 }finally{await ReactTestRenderer.act(async()=>renderer!.unmount());client.clear();}
});