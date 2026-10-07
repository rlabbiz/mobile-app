import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,FlatList,Image,Pressable,Text,View,StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useIsFocused} from '@react-navigation/native';
import {useInfiniteQuery,useQueryClient} from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import type {TabScreenProps} from '../App';
import type {ReelItem,Playback} from './api/types';
import {request} from './api/client';
import {track,flushEvents} from './api/telemetry';
import {PartReel,HomeScreen} from './screens';
import {useLanguage} from './i18n';
export function ReelsScreen({navigation,forceSaved=false,embedded=false,episodes=false}:TabScreenProps<'Reels'>&{forceSaved?:boolean;embedded?:boolean;episodes?:boolean}){
  const {t}=useLanguage();
  const focused=useIsFocused(),queries=useQueryClient();
  const [index,setIndex]=useState(0),[height,setHeight]=useState(0),[muted,setMuted]=useState(false);
  const [generation,setGeneration]=useState(0);
  const feed=useInfiniteQuery({queryKey:['reel-feed',forceSaved,episodes,generation],enabled:focused,initialPageParam:null as string|null,
    queryFn:async({pageParam,signal})=>{if(!pageParam)await flushEvents();return request<{items:ReelItem[];nextCursor:string|null}>(`/v1/reels?limit=10&saved=${forceSaved}&kind=${episodes?'episodes':'reels'}${pageParam?`&cursor=${encodeURIComponent(pageParam)}`:''}`,{signal});},
    getNextPageParam:page=>page.nextCursor??undefined,staleTime:forceSaved?0:600000,gcTime:600000});
  const items=useMemo(()=>[...new Map(feed.data?.pages.flatMap(page=>page.items).map(item=>[item.part.id,item])??[]).values()],[feed.data]);
  const viewability=useMemo(()=>({itemVisiblePercentThreshold:80}),[]);
  const onViewableItemsChanged=useCallback(({viewableItems}:{viewableItems:{index:number|null;isViewable:boolean}[]})=>{const visible=viewableItems.find(item=>item.isViewable&&item.index!==null);if(visible?.index!==null&&visible?.index!==undefined)setIndex(visible.index);},[]);
  useEffect(()=>{
    const next=items[index+1];if(!focused||!next)return;
    void queries.prefetchQuery({queryKey:['playback',next.film.id,next.part.id,false],queryFn:()=>request<Playback>(`/v1/films/${next.film.id}/parts/${next.part.id}/playback?preview=false`),staleTime:20000,gcTime:60000});
  },[index,items,focused,queries]);
  const refresh=()=>{setIndex(0);setGeneration(value=>value+1);};
  return <View style={styles.fill} onLayout={event=>setHeight(event.nativeEvent.layout.height)}>
    {feed.isPending?<ActivityIndicator style={styles.center} color="#F25B78"/>:feed.isError?<Pressable style={styles.center} onPress={()=>void feed.refetch()}><Text style={styles.text}>{t('Unable to load reels. Tap to retry.')}</Text></Pressable>:!items.length?<View style={styles.center}><Ionicons name="film-outline" size={40} color="#777782"/><Text style={styles.text}>{forceSaved?t(episodes?'No saved episodes yet':'No saved reels yet'):t('No reels yet')}</Text><Text style={styles.note}>{forceSaved?t(episodes?'Save an episode to watch it again here.':'Save a reel to watch it again here.'):t('New clips appear here when films have published discovery reels.')}</Text></View>:height>0&&<FlatList
      key={feed.data?.pages[0]?.items[0]?.part.id??'feed'} data={items} extraData={{index,focused,muted}} keyExtractor={item=>item.part.id}
      pagingEnabled snapToInterval={height} decelerationRate="fast" disableIntervalMomentum initialNumToRender={1} maxToRenderPerBatch={2} windowSize={3}
      getItemLayout={(_,i)=>({length:height,offset:height*i,index:i})} showsVerticalScrollIndicator={false}
      viewabilityConfig={viewability} onViewableItemsChanged={onViewableItemsChanged} onEndReachedThreshold={2}
      onEndReached={()=>{if(feed.hasNextPage&&!feed.isFetchingNextPage)void feed.fetchNextPage();}}
      renderItem={({item,index:pageIndex})=><View style={{height,backgroundColor:'#000'}}>{pageIndex===index&&focused?<PartReel film={item.film} part={item.part} focused={focused} muted={muted} onMute={()=>setMuted(value=>!value)} onExplore={()=>{track('film_opened',item.film.id,item.part.id,{screen:'reels',source:'explore'});navigation.navigate('Film',{film:item.film});}}/>:item.film.posterUrl&&<Image source={{uri:item.film.posterUrl}} style={styles.poster} resizeMode="contain"/>}</View>}
      ListFooterComponent={feed.isFetchingNextPage?<ActivityIndicator color="#F25B78"/>:!feed.hasNextPage?<Pressable style={styles.feedEnd} onPress={refresh}><Text style={styles.text}>{t('You’re caught up · Discover more')}</Text></Pressable>:null}/>
    }
    {!embedded&&<SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none"><Text style={styles.title}>{t('For you')}</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh reels" onPress={refresh} style={styles.refresh}><Ionicons name="reload-outline" size={20} color="#fff"/></Pressable></SafeAreaView>}
  </View>;
}
export function SavedScreen({navigation}:TabScreenProps<'Saved'>){
  const {t}=useLanguage();
  const [kind,setKind]=useState<'films'|'episodes'|'reels'>('films');
  return <View style={styles.fill}><SafeAreaView edges={['top']} style={styles.savedHeader}><Text style={styles.title}>{t('Saved')}</Text><View style={styles.switcher}>{(['films','episodes','reels'] as const).map(value=><Pressable key={value} accessibilityRole="button" accessibilityLabel={`Saved ${value}`} accessibilityState={{selected:kind===value}} onPress={()=>setKind(value)} style={[styles.switchButton,kind===value&&styles.selected]}><Text style={styles.text}>{value==='films'?t('Films'):value==='episodes'?t('Episodes'):t('Reels')}</Text></Pressable>)}</View></SafeAreaView>{kind==='films'?<HomeScreen navigation={navigation} route={{key:'saved-films',name:'Home'}} forceSaved embedded/>:<ReelsScreen navigation={navigation} route={{key:'saved-reels',name:'Reels'}} forceSaved embedded episodes={kind==='episodes'} key={kind}/>}</View>;
}
const styles=StyleSheet.create({fill:{flex:1,backgroundColor:'#0C0C0F'},center:{flex:1,alignItems:'center',justifyContent:'center',gap:12,padding:28},text:{color:'#F5F5F7',fontSize:13},note:{color:'#9696A1',fontSize:12,textAlign:'center',lineHeight:19},poster:{width:'100%',height:'100%'},top:{position:'absolute',top:0,left:20,right:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:'#fff',fontSize:20,fontWeight:'700'},refresh:{height:44,width:44,alignItems:'center',justifyContent:'center'},feedEnd:{padding:25,alignItems:'center'},savedHeader:{paddingHorizontal:20,paddingTop:8,gap:14,paddingBottom:8},switcher:{flexDirection:'row',gap:8},switchButton:{paddingHorizontal:16,paddingVertical:9,borderRadius:20,backgroundColor:'#18181D'},selected:{backgroundColor:'#4D2430'}});
