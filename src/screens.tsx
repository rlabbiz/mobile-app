import PagerView from 'react-native-pager-view';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  AppState,
  Image,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView,useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ExpoPlayer, { type PlayerHandle } from './ExpoPlayer';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Routes,TabScreenProps } from '../App';
import type { Film, Part, FilmDetail, Playback } from './api/types';
import { request } from './api/client';
import { track, flushEvents } from './api/telemetry';
import { LoveButton, useLove } from './api/loves';
import { SaveButton, useSave } from './api/saves';
import { clampPosition } from './storage/progress';
import { useFilmProgress, useWatchSummaries, useRecordWatch, type WatchSummary } from './api/watch-progress';
import {useLanguage} from './i18n';
import {Brand,GradientButton} from './brand';
import {brandGradient} from './theme';
import {SharePartButton} from './sharing';
import {FilmCover} from './FilmCover';
import {fitVideoFrame,playerBottomPadding} from './player-layout';
const timeLabel = (seconds: number) => {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return value >= 3600 ? `${Math.floor(value / 3600)}:${String(Math.floor(value / 60) % 60).padStart(2,'0')}:${String(value % 60).padStart(2,'0')}` : `${Math.floor(value / 60)}:${String(value % 60).padStart(2,'0')}`;
};
const compactViews = (count = 0,label='views') => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(count) + ' '+label;
const minutes = (seconds: number) =>
  `${Math.max(1, Math.round(seconds / 60))} min`;
function ProgressLine({percent,label}:{percent:number;label:string}) {
  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{min:0,max:100,now:Math.round(percent)}} style={s.watchTrack}><LinearGradient colors={brandGradient} start={{x:0,y:0}} end={{x:1,y:0}} style={[s.watchFill,{width:`${Math.min(100,Math.max(0,percent))}%`}]} /></View>;
}
function Button({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <GradientButton title={title} onPress={onPress}/>
  );
}
function ErrorView({ error, retry }: { error: unknown; retry: () => void }) {
  const {t}=useLanguage();
  return (
    <View style={s.message}>
      <Text style={s.text}>
        {error instanceof Error ? error.message : 'Unable to load this page.'}
      </Text>
      <Button title={t('Try again')} onPress={retry} />
    </View>
  );
}
function ContinueCard({film,progress,onPress}:{film:Film;progress?:WatchSummary;onPress:()=>void}){
 const {t}=useLanguage();const percent=Math.min(100,Math.max(0,progress?.percentComplete??0));
 return <Pressable accessibilityRole="button" accessibilityLabel={`Continue watching ${film.title}`} onPress={onPress} style={({pressed})=>[s.resumeCard,pressed&&s.pressed]}>
  <View style={s.resumeMedia}>
   <FilmCover film={film}/>
   <View pointerEvents="none" style={s.resumeVideoPlay}><Ionicons name="play" size={19} color="#fff"/></View>
  </View>
  <View style={s.resumeInfo}>
   <View style={s.resumeBadge}><Text style={s.resumeBadgeText}>{t('LAST WATCHED')}</Text></View>
   <Text numberOfLines={2} style={s.resumeTitle}>{film.title}</Text>
   {progress&&<Text style={s.cardStat}>{progress.watchedParts}/{progress.totalParts} {t('episodes watched')}</Text>}
   <View accessibilityRole="progressbar" accessibilityLabel="Continue watching progress" accessibilityValue={{min:0,max:100,now:Math.round(percent)}} style={s.resumeTrack}><View style={[s.resumeProgress,{width:`${percent}%`}]}/></View>
   <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Text style={s.resumeAction}>{t('Continue watching')}</Text><Ionicons name="arrow-forward" size={12} color="#A855F7"/></View>

  </View>
 </Pressable>;
}
function SavedFilmCard({film,progress,onPress}:{film:Film;progress?:WatchSummary;onPress:()=>void}){
 const {t}=useLanguage();
 return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${film.title}`} onPress={onPress} style={({pressed})=>[s.savedFilmRow,pressed&&s.pressed]}>
  <View style={s.savedFilmCover}><FilmCover film={film}/></View>
  <View style={s.savedFilmCopy}><Text numberOfLines={2} style={s.cardTitle}>{film.title}</Text><Text numberOfLines={1} style={s.muted}>{film.genres?.slice(0,2).join(' · ')} · {minutes(film.durationSeconds)}</Text><Text style={s.muted}>{progress?.watchedParts??0}/{progress?.totalParts??0} {t('episodes watched')}</Text><ProgressLine percent={progress?.percentComplete??0} label={`${film.title} watch progress`}/></View>
  <Ionicons name="chevron-forward" size={18} color="#8D8FAB"/>
 </Pressable>;
}
const FilmCard = memo(function FilmCardView({
  film,
  onPress,
  progress,
}: {
  film: Film;
  onPress: () => void;
  progress?: WatchSummary;
}) {
  const {t}=useLanguage();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${film.title}`}
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && s.pressed]}
    >
      <View style={s.poster}>
        <FilmCover film={film}/>
      </View>
      <View style={s.cardContent}>
        <Text numberOfLines={2} style={s.cardTitle}>{film.title}</Text>
        <Text numberOfLines={1} style={s.cardTag}>{film.genres?.[0]??minutes(film.durationSeconds)}</Text>
        <View style={s.cardStats}>
          <View style={s.cardMetric} accessibilityLabel={compactViews(film.views,t('views'))}><Ionicons name="play" size={10} color="#A0A3BD"/><Text style={s.cardStat}>{new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(film.views??0)}</Text></View>
          <View style={s.cardMetric}><Ionicons name="heart-outline" size={11} color="#FFA3C5"/><Text style={s.cardStat}>{new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(film.loves??0)}</Text></View>
        </View>
        {progress&&progress.watchedParts>0&&<><Text style={s.cardStat}>{progress.watchedParts}/{progress.totalParts} {t('episodes watched')}</Text><ProgressLine percent={progress.percentComplete} label={film.title+' watch progress'}/></>}
      </View>
    </Pressable>
  );
});
const FilmGridCell=memo(function FilmGridCell({film,progress,onOpen}:{film:Film;progress?:WatchSummary;onOpen:(film:Film)=>void}){
 return <View style={{flex:1,marginHorizontal:4,marginBottom:18}}><FilmCard film={film} progress={progress} onPress={()=>onOpen(film)}/></View>;
});
export interface HomeCategory {id:string;name:string;sort:'popular'|'new'|'famous';genre:string|null;isForYou:boolean}
const AnimatedPager=Animated.createAnimatedComponent(PagerView);
const HOME_TAB_WIDTH=100;
export function HomeScreen({navigation,forceSaved=false,embedded=false}:TabScreenProps<'Home'>&{forceSaved?:boolean;embedded?:boolean}) {
 const focused=useIsFocused(),{t}=useLanguage(),queries=useQueryClient();
 const [refreshing,setRefreshing]=useState(false),refreshLock=useRef(false);
 const [searchOpen,setSearchOpen]=useState(false),[search,setSearch]=useState(''),[query,setQuery]=useState('');
 useEffect(()=>{if(focused)track('home_view',undefined,undefined,{screen:'home'});},[focused]);
 useEffect(()=>{const timer=setTimeout(()=>setQuery(search.trim()),300);return()=>clearTimeout(timer);},[search]);
 useEffect(()=>{if(query)track('search',undefined,undefined,{query,screen:'home'});},[query]);
 const categories=useQuery({queryKey:['home-categories'],queryFn:({signal})=>request<{items:HomeCategory[]}>('/v1/home/categories',{signal}),staleTime:30000,enabled:focused&&!forceSaved});
 async function refreshHome(){if(refreshLock.current)return;refreshLock.current=true;setRefreshing(true);try{await Promise.all([forceSaved?Promise.resolve():categories.refetch(),queries.refetchQueries({queryKey:[forceSaved?'films-saved':'films'],type:'active'}),queries.refetchQueries({queryKey:['watch-summaries'],type:'active'}),queries.refetchQueries({queryKey:['last-watched'],type:'active'})]);}finally{refreshLock.current=false;setRefreshing(false);}}
 const refreshButton=<Pressable accessibilityRole="button" accessibilityLabel="Refresh films" accessibilityState={{disabled:refreshing}} disabled={refreshing} onPress={()=>void refreshHome()} style={s.searchButton}>{refreshing?<ActivityIndicator color="#A855F7"/>:<Ionicons name="reload-outline" size={21} color="#F8F7FF"/>}</Pressable>;
 return <SafeAreaView style={s.fill} edges={embedded?['left','right']:['top','left','right']}>
  <View style={s.homeHeader}>
   {!embedded&&<View style={s.brandHeading}><Brand/><View style={{flexDirection:'row'}}>{refreshButton}<Pressable accessibilityRole="button" accessibilityLabel="Search films" accessibilityState={{expanded:searchOpen}} onPress={()=>{setSearchOpen(value=>!value);setSearch('');}} style={s.searchButton}><Ionicons name={searchOpen?'close-outline':'search-outline'} size={24} color="#F8F7FF"/></Pressable></View></View>}
   {(searchOpen||forceSaved)&&<View style={s.searchWrap}><Ionicons name="search-outline" color="#A0A3BD" size={18}/><TextInput accessibilityLabel="Search film titles" autoFocus={!forceSaved} value={search} onChangeText={setSearch} maxLength={100} placeholder={t('Find your next story')} placeholderTextColor="#7D809F" style={s.search} autoCorrect={false} autoCapitalize="none" returnKeyType="search"/>{search.length>0&&<Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={12} onPress={()=>setSearch('')}><Text style={s.clearSearch}>×</Text></Pressable>}{embedded&&refreshButton}</View>}
  </View>
  {forceSaved||query?<HomeBrowsePage navigation={navigation} browse="new" query={query} genre="" savedOnly={forceSaved} focused={focused} foreground={focused} preload={false} refreshCategories={categories.refetch}/>:categories.isPending?<ActivityIndicator color="#A855F7"/>:categories.isError?<ErrorView error={categories.error} retry={()=>void categories.refetch()}/>:<HomeCategoryPager key={categories.data.items.map(item=>item.id).join(',')} categories={categories.data.items} navigation={navigation} focused={focused} refreshCategories={categories.refetch}/>}
 </SafeAreaView>;
}
function HomeCategoryPager({categories,navigation,focused,refreshCategories}:{categories:HomeCategory[];navigation:TabScreenProps<'Home'>['navigation'];focused:boolean;refreshCategories:()=>unknown}){
 const initial=Math.max(0,categories.findIndex(item=>item.isForYou));
 const [selected,setSelected]=useState(initial),[visited,setVisited]=useState<number[]>([initial]);
 const pager=useRef<PagerView>(null),tabs=useRef<ScrollView>(null);
 const [tabViewport,setTabViewport]=useState(0);
 const [position]=useState(()=>new Animated.Value(initial)),[offset]=useState(()=>new Animated.Value(0));
 const progress=useMemo(()=>Animated.add(position,offset),[position,offset]);
 const onPageScroll=useMemo(()=>Animated.event([{nativeEvent:{position,offset}}],{useNativeDriver:true}),[position,offset]);
 function select(index:number){setSelected(index);setVisited(values=>values.includes(index)?values:[...values,index]);tabs.current?.scrollTo({x:Math.max(0,12+(index+0.5)*HOME_TAB_WIDTH-tabViewport/2),animated:true});}
 return <View style={{flex:1}}>
  <ScrollView testID="home-category-tabs" ref={tabs} style={s.homeTabScroll} horizontal scrollEnabled nestedScrollEnabled directionalLockEnabled bounces={false} showsHorizontalScrollIndicator={false} onLayout={event=>setTabViewport(event.nativeEvent.layout.width)} contentContainerStyle={[s.homeTabs,{width:categories.length*HOME_TAB_WIDTH+24}]}>

   {categories.map((item,index)=><Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={'Category: '+item.name} accessibilityState={{selected:selected===index}} onPress={()=>pager.current?.setPage(index)} style={s.homeTab}>
    <Text numberOfLines={1} style={s.homeTabText}>{item.name}</Text>
    <Animated.Text numberOfLines={1} style={[s.homeTabText,s.homeTabSelected,{opacity:progress.interpolate({inputRange:[index-1,index,index+1],outputRange:[0,1,0],extrapolate:'clamp'})}]}>{item.name}</Animated.Text>
   </Pressable>)}
   <Animated.View pointerEvents="none" style={[s.homeTabIndicator,{transform:[{translateX:Animated.multiply(progress,HOME_TAB_WIDTH)}]}]}/>
  </ScrollView>
  <AnimatedPager testID="home-category-pager" ref={pager} style={{flex:1}} initialPage={initial} offscreenPageLimit={1} layoutDirection="ltr" onPageScroll={onPageScroll} onPageSelected={event=>select(event.nativeEvent.position)}>
   {categories.map((category,index)=><View key={category.id} collapsable={false} style={{width:'100%',height:'100%'}}>
    {(visited.includes(index)||Math.abs(selected-index)<=1)&&<HomeBrowsePage navigation={navigation} browse={category.sort} query="" genre={category.genre??''} category={category} savedOnly={false} focused={focused&&selected===index} foreground={focused} preload={focused&&Math.abs(selected-index)===1} refreshCategories={refreshCategories}/>}
   </View>)}
  </AnimatedPager>
 </View>;
}
export function BrowseScreen({navigation,route}:NativeStackScreenProps<Routes,'Browse'>){
 const focused=useIsFocused();return <SafeAreaView style={s.fill} edges={['left','right']}><HomeBrowsePage navigation={navigation} browse={route.params.sort} query="" genre={route.params.genre} savedOnly={false} focused={focused} foreground={focused} preload={false} refreshCategories={()=>undefined}/></SafeAreaView>;
}
function HomeBrowsePage({navigation,browse,query,genre,savedOnly,focused,preload,category}:{navigation:TabScreenProps<'Home'>['navigation'];browse:'popular'|'famous'|'new';query:string;genre:string;savedOnly:boolean;focused:boolean;foreground:boolean;preload:boolean;refreshCategories:()=>unknown;category?:HomeCategory}){
 const {t}=useLanguage();
 const openFilm=useCallback((film:Film)=>navigation.navigate('Film',{film}),[navigation]);
  const [visibleFilm, setVisibleFilm] = useState<string | undefined>();
  const viewability = useMemo(() => ({ itemVisiblePercentThreshold: 65, minimumViewTime: 500 }), []);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: { item: Film; isViewable: boolean; index: number | null }[] }) => {
    const candidates=viewableItems.filter(item=>item.isViewable).sort((a,b)=>(a.index??0)-(b.index??0));
    const visible=candidates[0];
    setVisibleFilm(visible?.item.id);
  }, []);
  const films = useInfiniteQuery({
    queryKey: [savedOnly ? 'films-saved' : 'films', query, genre,browse,category?.id],
    enabled:focused||preload,staleTime:60000,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      request<{ items: Film[]; nextCursor: string | null }>(
        `${category?'/v1/home/categories/'+category.id+'/films':'/v1/films'}?limit=20&q=${encodeURIComponent(query)}&genre=${encodeURIComponent(genre)}&saved=${savedOnly}&sort=${savedOnly?'new':browse}${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
        { signal },
      ),
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
  const recent=useQuery({queryKey:['last-watched'],queryFn:({signal})=>request<{film:Film|null}>('/v1/films/last-watched',{signal}),enabled:focused&&!!category?.isForYou,staleTime:15000});
  const refreshRecent=recent.refetch;
  useEffect(()=>{if(focused&&category?.isForYou){void flushEvents();void refreshRecent();}},[focused,category?.isForYou,refreshRecent]);
  const recentFilm=category?.isForYou?recent.data?.film:null;
  const orderedFilms=useMemo(()=>(films.data?.pages.flatMap(page=>page.items)??[]).filter(film=>film.id!==recentFilm?.id),[films.data,recentFilm?.id]);
  // The progress endpoint accepts at most 50 IDs; remaining pages load as they become visible.
  const progressPage=Math.floor(Math.max(0,orderedFilms.findIndex(item=>item.id===visibleFilm))/30);
  const filmIds=useMemo(()=>orderedFilms.slice(progressPage*30,progressPage*30+30).map(item=>item.id),[orderedFilms,progressPage]);
  const watch=useWatchSummaries(recentFilm?[recentFilm.id,...filmIds.filter(id=>id!==recentFilm.id)].slice(0,50):filmIds,focused);
 return <View style={{flex:1}}>
      {films.isPending ? (
        <ActivityIndicator color="#A855F7" />
      ) : films.isError ? (
        <ErrorView error={films.error} retry={() => void films.refetch()} />
      ) : (
        <FlashList
          key={JSON.stringify([query, genre, savedOnly,browse])}
          data={orderedFilms}
          numColumns={savedOnly?1:3}
          ListHeaderComponent={recentFilm?<View style={{paddingHorizontal:4,paddingTop:4}}><ContinueCard film={recentFilm} progress={watch.data?.items.find(item=>item.filmId===recentFilm.id)} onPress={()=>navigation.navigate('Film',{film:recentFilm})}/></View>:undefined}
          extraData={watch.data}
          viewabilityConfig={viewability}
          onViewableItemsChanged={onViewableItemsChanged}
          keyExtractor={film => film.id}
          renderItem={({ item }) => savedOnly ? <SavedFilmCard film={item} progress={watch.data?.items.find(progress=>progress.filmId===item.id)} onPress={()=>navigation.navigate('Film',{film:item})}/> : (
            <FilmGridCell film={item} progress={watch.data?.items.find(progress=>progress.filmId===item.id)} onOpen={openFilm}/>
          )}
          contentContainerStyle={s.list}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (focused && films.hasNextPage && !films.isFetchingNextPage) {
              void films.fetchNextPage();
            }
          }}
          ListFooterComponent={
            films.isFetchingNextPage ? (
              <ActivityIndicator color="#A855F7" />
            ) : null
          }
          ListEmptyComponent={
            <View style={s.message}>
              <Text style={s.heading}>{savedOnly ? t('No saved stories yet') : t('No films yet')}</Text>
              <Text style={s.muted}>
                {savedOnly ? t('Save a film to find it here.') : query || genre
                  ? t('Try a different title or category.')
                  : t('Published films will appear here. Tap refresh to check again.')}
              </Text>
            </View>
          }
        />
      )}
 </View>;
}
export function FilmScreen({
  route,
  navigation,
}: NativeStackScreenProps<Routes, 'Film'>) {
  const { film } = route.params;
  const love = useLove(film.id);
  const save = useSave(film.id);
  const focused = useIsFocused();
  const {t}=useLanguage();
  const watch=useFilmProgress(film.id,focused);
  const progressById=useMemo(()=>new Map(watch.data?.parts.map(part=>[part.partId,part])),[watch.data]);
  useEffect(() => { if (focused) track('film_opened', film.id, undefined, { screen: 'film' }); }, [film.id, focused]);
  const detail = useQuery({
    queryKey: ['film', film.id],
    queryFn: ({ signal }) =>
      request<FilmDetail>(`/v1/films/${film.id}`, { signal }),
  });
  if (detail.isPending) {
    return <ActivityIndicator style={s.message} color="#A855F7" />;
  }
  if (detail.isError) {
    return (
      <ErrorView error={detail.error} retry={() => void detail.refetch()} />
    );
  }
  const current = detail.data.film;
  const playableParts=detail.data.parts.filter(part=>part.accessPolicy==='free'||part.previewAllowed);
  const resumePart=playableParts.find(part=>{const progress=progressById.get(part.id);return progress&&!progress.completed&&progress.positionSeconds>0;})??playableParts.find(part=>!progressById.get(part.id)?.completed)??playableParts[0];
  const watchTitle=(watch.data?.percentComplete??0)>0&&(watch.data?.percentComplete??0)<100?t('Continue watching'):t('Start watching');
  return (
    <FlashList
      data={detail.data.parts}
      extraData={watch.data}
      keyExtractor={part => part.id}
      contentContainerStyle={s.partsList}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={s.partHeader}>
          <View style={s.hero}>
            {current.posterUrl && <Image source={{ uri: current.posterUrl }} style={s.heroPoster} />}
            <View style={s.heroCopy}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={[s.eyebrow,{flex:1}]}>
              {current.genres.join(' / ') || 'KOREVA'}
            </Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh film details" disabled={detail.isRefetching} onPress={()=>{void detail.refetch();void watch.refetch();}} style={s.searchButton}><Ionicons name="reload-outline" size={20} color="#F8F7FF"/></Pressable></View>
            <Text style={s.heroTitle}>{current.title}</Text>
            <View style={{flexDirection:'row',gap:8}}><LoveButton love={love} /><SaveButton save={save} /></View>
            <Text style={s.muted}>
              {[
                current.year,
                current.ageRating,
                minutes(current.durationSeconds),
                compactViews(love.views ?? current.views,t('views')),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            </View>
          </View>
          {current.synopsis ? (
            <Text numberOfLines={3} style={s.synopsis}>{current.synopsis}</Text>
          ) : null}
          <View style={s.filmProgress}>
            <View style={s.sectionRow}><Text style={s.watchLabel}>{watch.data?.watchedParts ?? 0} / {detail.data.parts.length} {t('episodes watched')}</Text><Text style={s.muted}>{Math.round(watch.data?.percentComplete ?? 0)}%</Text></View>
            <ProgressLine percent={watch.data?.percentComplete ?? 0} label="Film watch progress" />
          </View>
          {resumePart && <Pressable
            accessibilityRole="button" accessibilityLabel={watchTitle}
            style={({ pressed }) => [s.watchButton, pressed && s.pressed]}
            onPress={() => {
              navigation.navigate('Player', { film: current, part: resumePart, parts: detail.data.parts });
            }}
          ><LinearGradient colors={brandGradient} start={{x:0,y:0}} end={{x:1,y:0}} style={s.watchButtonGradient}><Ionicons name="play" color="#fff" size={16}/><Text style={s.watchButtonText}>{watchTitle}</Text></LinearGradient></Pressable>}
          <View style={s.sectionRow}><Text style={s.heading}>{t('Episodes')}</Text><Text style={s.sectionNote}>{detail.data.parts.length} {t('EPISODES')}</Text></View>
        </View>
      }
      renderItem={({ item: part, index }) => (
        <Pressable
          accessibilityRole="button"
          key={part.id}
          style={({ pressed }) => [s.part, pressed && s.pressed]}
          onPress={() => {
            if (part.accessPolicy !== 'free' && !part.previewAllowed) {
              Alert.alert(
                'Episode locked',
                part.accessPolicy === 'premium'
                  ? 'This episode requires a premium entitlement.'
                  : 'This episode requires a rewarded-ad unlock.',
              );
              return;
            }
            navigation.navigate('Player', {
              film: current,
              part,
              next: detail.data.parts[index + 1],
              parts: detail.data.parts,
            });
          }}
        >
          <View style={s.episodeThumb}>{current.posterUrl&&<Image source={{uri:current.posterUrl}} style={s.image} resizeMode="cover"/>}<View style={s.episodeNumber}><Text style={s.number}>{String(part.position).padStart(2, '0')}</Text></View></View>
          <View style={s.partCopy}>
            <Text numberOfLines={1} style={s.cardTitle}>{part.title.replace(/^part\s*(\d+)\b/i,t('Episode')+' $1')}</Text>
            <Text style={s.muted}>
              {save.parts.some(item => item.partId === part.id && item.saved) ? 'Saved · ' : ''}{timeLabel(part.durationSeconds)} ·{' '}
              {part.accessPolicy === 'free'
                ? 'Watch now'
                : part.previewAllowed
                ? 'Watch preview'
                : 'Locked'}
            </Text>
            {(progressById.get(part.id)?.positionSeconds ?? 0)>0 && <View style={s.partProgress}>
              <ProgressLine percent={progressById.get(part.id)?.percentComplete ?? 0} label={`${part.title} watch progress`} />
              <Text style={s.progressNote}>{progressById.get(part.id)?.completed ? t('Watched') : `${timeLabel(progressById.get(part.id)?.positionSeconds ?? 0)} ${t('watched')}`}</Text>
            </View>}
          </View>
          <View style={s.partPlay}><Text style={s.partPlayGlyph}>{part.accessPolicy === 'free' || part.previewAllowed ? '▶' : '—'}</Text></View>
        </Pressable>
      )}
    />
  );
}
export function PlayerScreen({ route, navigation }: NativeStackScreenProps<Routes, 'Player'>) {
  const { film, part, next } = route.params;
  // Natural episode order: dragging up reveals the next page below this one.
  const parts = useMemo(() => [...(route.params.parts ?? [part, ...(next ? [next] : [])])].sort((a,b) => a.position - b.position), [route.params.parts, part, next]);
  const initialIndex = Math.max(0, parts.findIndex(item => item.id === part.id));
  const [index, setIndex] = useState(initialIndex);
  const [height, setHeight] = useState(0);
  const focused = useIsFocused();
  const queries = useQueryClient();
  const [muted, setMuted] = useState(false);
  const viewability = useMemo(() => ({ itemVisiblePercentThreshold: 80 }), []);
  const episodePager=useRef<FlatList<Part>>(null);
  const lastVisible = useRef(initialIndex);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: { index: number | null; isViewable: boolean }[] }) => {
    const visible = viewableItems.find(item => item.isViewable && item.index !== null);
    if (visible?.index !== null && visible?.index !== undefined) {
      const partIndex = visible.index;
      if (lastVisible.current !== partIndex) track('reel_swiped', film.id, parts[partIndex]?.id, { direction: partIndex > lastVisible.current ? 'next' : 'previous', screen: 'reel' });
      lastVisible.current = partIndex;
      setIndex(partIndex);
    }
  }, [film.id, parts]);
  useEffect(() => {
    const upcoming = parts[index + 1];
    if (!focused || !upcoming || (upcoming.accessPolicy !== 'free' && !upcoming.previewAllowed)) return;
    const preview = upcoming.accessPolicy !== 'free';
    // Warm only the next grant, not another decoder or the film itself.
    void queries.prefetchQuery({
      queryKey: ['playback', film.id, upcoming.id, preview],
      queryFn: () => request<Playback>(`/v1/films/${film.id}/parts/${upcoming.id}/playback?preview=${preview}`),
      staleTime: 20000,
      gcTime: 60000,
    });
  }, [film.id, focused, index, parts, queries]);
  const current = parts[index];
  return (
    <View style={s.reel} onLayout={event => setHeight(event.nativeEvent.layout.height)}>
      {height > 0 && <FlatList
        ref={episodePager}
        data={parts}
        pagingEnabled
        decelerationRate="fast"
        disableIntervalMomentum
        snapToInterval={height}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, itemIndex) => ({ length: height, offset: height * itemIndex, index: itemIndex })}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        extraData={index}
        viewabilityConfig={viewability}
        onViewableItemsChanged={onViewableItemsChanged}
        renderItem={({ item, index: itemIndex }) => (
          <View style={{ height, width: '100%', backgroundColor: '#000' }}>
            {itemIndex === index
              ? <PartReel key={item.id} film={film} part={item} allParts={parts} onNext={parts[itemIndex+1]&&(parts[itemIndex+1].accessPolicy==='free'||parts[itemIndex+1].previewAllowed)?()=>episodePager.current?.scrollToIndex({index:itemIndex+1,animated:true}):undefined} focused={focused} muted={muted} onMute={() => setMuted(value => !value)} />
              : film.posterUrl && <Image source={{ uri: film.posterUrl }} style={[s.videoFrame,StyleSheet.absoluteFill]} resizeMode="contain" />}
          </View>
        )}
      />}
      <SafeAreaView style={s.reelTop} edges={['top']} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel="Back to films" hitSlop={12} onPress={() => { track('navigation_back', film.id, current?.id, { screen: 'reel' }); navigation.goBack(); }} style={s.backIcon}>
          <Ionicons name="arrow-back" color="#fff" size={23}/>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
export function PartReel({ film, part, allParts, focused, muted, onMute,onExplore,onNext,bottomInsetHandled=false }: { film: Film; part: Part; allParts?:Part[]; focused: boolean; muted: boolean; onMute: () => void;onExplore?:()=>void;onNext?:()=>void;bottomInsetHandled?:boolean }) {
  const {t}=useLanguage();
  const insets=useSafeAreaInsets();
  const [viewport,setViewport]=useState({width:0,height:0});
  const [videoRatio,setVideoRatio]=useState<number|null>(null);
  const [readyUrl,setReadyUrl]=useState<string|null>(null);
  const [footerHeight,setFooterHeight]=useState(110);
  const videoFrame=fitVideoFrame(viewport.width,viewport.height,videoRatio);
  const reportVideoSize=useCallback(({width,height}:{width:number;height:number})=>{if(width>0&&height>0)setVideoRatio(width/height);},[]);
  const historyParts=useMemo(()=>allParts??[part],[allParts,part]);
  const persistProgress=useRecordWatch(film.id,part,historyParts);
  const position = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [sharing,setSharing]=useState(false);
  const [timelineWidth,setTimelineWidth]=useState(0);
  const love = useLove(film.id, part.id);
  const save = useSave(film.id,part.id);
  const player = useRef<PlayerHandle | null>(null);
  const lastTapZone = useRef('center');
  const [seekFeedback, setSeekFeedback] = useState<'left' | 'right' | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [expandedDescription, setExpandedDescription] = useState(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heart = useMemo(() => new Animated.Value(0), []);
  const heartAnimation = useRef<Animated.CompositeAnimation | undefined>(undefined);
  useEffect(() => {
    track('part_opened', film.id, part.id, { screen: 'reel' });
    return () => { if (tapTimer.current) clearTimeout(tapTimer.current); if (feedbackTimer.current) clearTimeout(feedbackTimer.current); heartAnimation.current?.stop(); };
  }, [film.id, part.id]);
  const preview = part.accessPolicy !== 'free';
  const lastSaved = useRef(0);
  const lastHeartbeat = useRef(0);
  const watched = useRef(0);
  const previousTime = useRef<number | null>(null);
  const started = useRef(false);
  const recovered = useRef(false);
  const renewing = useRef(false);
  const ended = useRef(false);
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [failure, setFailure] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const playback = useQuery({
    queryKey: ['playback', film.id, part.id, preview],
    queryFn: () =>
      request<Playback>(
        `/v1/films/${film.id}/parts/${part.id}/playback?preview=${preview}`,
      ),
    staleTime: 20000,
    gcTime: 60000,
    retry: false,
  });
  const expiry = useRef<string | undefined>(undefined);
  useEffect(() => { expiry.current = playback.data?.expiresAt; }, [playback.data?.expiresAt]);
  const refetch = playback.refetch;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state !== 'active' && !preview && !part.isReel) {
        void persistProgress(position.current, ended.current).catch(
          () => undefined,
        );
      }
      if (
        state === 'active' &&
        expiry.current &&
        Date.parse(expiry.current) < Date.now() + 60000
      ) {
        void refetch();
      }
    });
    return () => {
      subscription.remove();
      if (started.current)
        track('video_end', film.id, part.id, {
          watchedSeconds: Math.min(21600, Math.floor(watched.current)),
          positionSeconds: Math.min(21600, position.current),
          source:preview ? 'preview' : 'reel',
        });
      if (!preview && !part.isReel) {
        void persistProgress(position.current, ended.current).catch(
          () => undefined,
        );
      }
    };
  }, [film.id, part.id, part.isReel, preview, refetch, persistProgress]);
  function seekPart(seconds: number,source?:string) {
    const target = player.current?.seekBy(seconds);
    if (target === undefined) return;
    position.current = target;
    setElapsed(Math.floor(target));
    previousTime.current = null;
    ended.current = false;
    if (completed) setUserPaused(true);
    setCompleted(false);
    setSeekFeedback(seconds > 0 ? 'right' : 'left');
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setSeekFeedback(null),700);
    track('video_seek',film.id,part.id,{positionSeconds:Math.min(21600,target),source:source??(seconds > 0 ? 'forward_5s' : 'backward_5s')});
  }
  function replayPart() {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = undefined;
    player.current?.replay();
    position.current = 0;
    setElapsed(0);
    ended.current = false;
    previousTime.current = null;
    setCompleted(false);
    setUserPaused(false);
    track('video_play',film.id,part.id,{positionSeconds:0,source:'replay'});
  }
  function tapReel(zone = 'center') {
    if (tapTimer.current && lastTapZone.current === zone) {
      clearTimeout(tapTimer.current);
      tapTimer.current = undefined;
      if (zone !== 'center') {
        seekPart(zone === 'right' ? 5 : -5);
        return;
      }
      love.setLoved(true, 'double_tap');
      heartAnimation.current?.stop();
      heart.setValue(0);
      heartAnimation.current = Animated.sequence([
        Animated.spring(heart, { toValue: 1, speed: 22, bounciness: 9, useNativeDriver: true }),
        Animated.delay(300),
        Animated.timing(heart, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]);
      heartAnimation.current.start();
    } else {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      lastTapZone.current = zone;
      tapTimer.current = setTimeout(() => {
        tapTimer.current = undefined;
        if (completed) { replayPart(); return; }
        const paused = !userPaused;
        setUserPaused(paused);
        track(paused ? 'video_pause' : 'video_play', film.id, part.id, { positionSeconds: Math.min(21600, position.current), source: preview ? 'preview' : 'tap' });
      }, 250);
    }
  }
  if (playback.isPending) {
    return <View style={s.reel}><FilmCover film={film}/><LinearGradient colors={['rgba(5,5,24,0.4)','rgba(5,5,24,0.8)']} style={StyleSheet.absoluteFill}/><View style={s.reelStatus}><ActivityIndicator accessibilityLabel="Loading video" color="#fff"/></View></View>;
  }
  if (playback.isError || failure) {
    return (
      <Pressable style={s.reelStatus} accessibilityRole="button" accessibilityLabel="Retry playback" onPress={() => {
        recovered.current = false;
        setFailure(null);
        void playback.refetch();
      }}>
        <Text style={s.reelError}>{playback.error instanceof Error ? playback.error.message : failure}</Text>
      </Pressable>
    );
  }
  return (
    <View testID="part-reel" style={s.reel} onLayout={event=>{const {width,height}=event.nativeEvent.layout;setViewport({width,height});}}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>{film.posterUrl&&<Image testID="player-backdrop" source={{uri:film.posterUrl}} blurRadius={28} resizeMode="cover" style={[s.image,{opacity:0.65}]}/>}<LinearGradient colors={['rgba(5,5,24,0.6)','rgba(5,5,24,0.28)','rgba(5,5,24,0.82)']} style={StyleSheet.absoluteFill}/></View>
      <View testID="player-video-frame" style={[s.videoFrame,videoFrame??StyleSheet.absoluteFill]}>
        {readyUrl!==playback.data?.url&&<ActivityIndicator pointerEvents="none" color="#fff" style={{position:'absolute',top:'50%',alignSelf:'center'}}/>}
        <View style={[StyleSheet.absoluteFill,{opacity:readyUrl===playback.data?.url?1:0}]}>
        {playback.data && (
          <ExpoPlayer
            onVideoSize={reportVideoSize}
            controlRef={player}
            key={playback.data.url}
            url={playback.data.url}
            paused={!active || !focused || completed || userPaused || sharing}
            muted={muted}
            contentFit="contain"
            initialPosition={async () => {
              // Every newly opened part starts at zero. Only a renewed grant
              // within the current reel preserves the in-memory position.
              return started.current ? clampPosition(position.current, playback.data.durationSeconds) : 0;
            }}
            onLoad={() => {
              setReadyUrl(playback.data.url);
              previousTime.current = null;
              if (!started.current) {
                started.current = true;
                track('part_started', film.id, part.id);
                track('video_play', film.id, part.id, { source: 'autoplay' });
              }
            }}
            onProgress={event => {
              // Renew only during active playback, before segment signatures expire.
              if (
                active &&
                focused &&
                !renewing.current &&
                Date.parse(playback.data.expiresAt) < Date.now() + 45000
              ) {
                renewing.current = true;
                void playback.refetch().finally(() => {
                  renewing.current = false;
                });
              }
              if (previousTime.current !== null && active && focused) {
                const delta = event.currentTime - previousTime.current;
                if (delta > 0 && delta < 2.5) watched.current += delta;
              }
              if (Date.now() - lastHeartbeat.current > 15000) {
                lastHeartbeat.current = Date.now();
                track('session_activity', film.id, part.id, { positionSeconds: Math.min(21600, event.currentTime),source:preview?'preview':'reel' });
              }
              previousTime.current = event.currentTime;
              position.current = event.currentTime;
              setElapsed(Math.floor(Math.min(playback.data.durationSeconds,event.currentTime)));
              if (!preview && !part.isReel && Date.now() - lastSaved.current > 10000) {
                lastSaved.current = Date.now();
                void persistProgress(event.currentTime).catch(
                  () => undefined,
                );
              }
            }}
            onEnd={() => {
              if (ended.current) return;
              if (!preview)
                track('part_completed', film.id, part.id, {
                  percentComplete: 100,positionSeconds:Math.min(21600,playback.data.durationSeconds),
                });
              ended.current = true;
              position.current = playback.data.durationSeconds;
              setElapsed(Math.floor(playback.data.durationSeconds));
              setCompleted(true);
              if (!preview && !part.isReel) {
                void persistProgress(position.current, true).catch(
                  () => undefined,
                );
              }
            }}
            onError={() => {
              track('video_error', film.id, part.id, { errorCode: 'PLAYBACK_FAILED', positionSeconds: Math.min(21600, position.current) });
              if (!recovered.current) {
                recovered.current = true;
                void playback.refetch();
              } else {
                setFailure(
                  'Playback failed. Check your connection and try again.',
                );
              }
            }}
          />
        )}
        </View>
      </View>
      <LinearGradient pointerEvents="none" colors={['transparent','rgba(0,0,0,0.72)']} style={[s.reelScrim,{height:footerHeight+100}]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Double tap to rewind 5 seconds" style={[s.reelTap,s.seekLeft]} onPress={() => tapReel('left')}>
        {seekFeedback === 'left' && !userPaused && <View style={s.seekToast}><Ionicons name="play-back" size={27} color="#fff" /><Text style={s.seekLabel}>−5s</Text></View>}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Double tap to skip forward 5 seconds" style={[s.reelTap,s.seekRight]} onPress={() => tapReel('right')}>
        {seekFeedback === 'right' && !userPaused && <View style={s.seekToast}><Ionicons name="play-forward" size={27} color="#fff" /><Text style={s.seekLabel}>+5s</Text></View>}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={completed ? 'Replay part' : userPaused ? 'Resume part' : 'Pause part'}
        style={[s.reelTap,s.tapCenter]}
        onPress={() => completed ? replayPart() : tapReel()}
      >
        {completed ? <View style={s.finishedCard}><Text style={s.finishedLabel}>{t(part.isReel?'Reel finished':'Episode finished')}</Text><View style={s.replayButton}><Ionicons name="play" size={19} color="#111" /><Text style={s.replayText}>{t('Watch again')}</Text></View>{onNext&&<Pressable accessibilityRole="button" accessibilityLabel={t('Next episode')} onPress={event=>{event.stopPropagation();onNext();}} style={s.nextEpisode}><LinearGradient colors={brandGradient} style={s.nextEpisodeGradient}><Ionicons name="play" color="#fff" size={17}/><Text style={s.nextEpisodeText}>{t('Next episode')}</Text></LinearGradient></Pressable>}</View> : userPaused && <View style={s.resumeButton}><Ionicons name="play" size={32} color="#fff" /></View>}
        <Animated.Text pointerEvents="none" style={{ position: 'absolute', fontSize: 90, color: '#FF3C83', opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) }] }}>♥</Animated.Text>
      </Pressable>
      {userPaused && !completed && <View style={s.pausedControls} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel="Rewind 5 seconds" onPress={() => seekPart(-5)} style={s.pausedSeek}><Ionicons name="play-back" size={24} color="#fff" /><Text style={s.seekLabel}>−5s</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Forward 5 seconds" onPress={() => seekPart(5)} style={s.pausedSeek}><Ionicons name="play-forward" size={24} color="#fff" /><Text style={s.seekLabel}>+5s</Text></Pressable>
      </View>}
      <View testID="player-action-rail" style={[s.actionRail,{bottom:footerHeight+12}]} pointerEvents="box-none">
        <LoveButton love={love} rail />
        <SaveButton save={save} rail />
        <SharePartButton film={film} part={part} onOpenChange={setSharing}/>
        {onExplore&&<Pressable accessibilityRole="button" accessibilityLabel={t('Explore film')} onPress={onExplore} style={s.railStat}><Ionicons name="film-outline" size={27} color="#fff"/><Text style={s.railLabel}>{t('Explore')}</Text></Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel={t(muted ? 'Unmute video' : 'Mute video')} onPress={() => { onMute(); track('session_activity',film.id,part.id,{source:preview ? 'preview' : muted ? 'unmuted' : 'muted',positionSeconds:Math.min(21600,position.current)}); }} style={s.railStat}><Ionicons name={muted ? 'volume-mute-outline' : 'volume-high-outline'} size={25} color="#fff" /></Pressable>
      </View>
      <View testID="player-footer" onLayout={event=>setFooterHeight(event.nativeEvent.layout.height)} style={[s.playerFooter,{paddingBottom:playerBottomPadding(insets.bottom,bottomInsetHandled)}]} pointerEvents="box-none">
      <View style={s.reelDetail} pointerEvents="box-none">
        <Text numberOfLines={1} style={s.reelFilmTitle}>{film.title}</Text>
        <Text numberOfLines={1} style={s.reelCaption}>{part.isReel?t('Reel'):`${t('Episode')} ${part.position}`} · {part.title}</Text>
        {(film.synopsis || part.description) && <Pressable accessibilityRole="button" accessibilityLabel={expandedDescription ? 'Collapse description' : 'Expand description'} onPress={() => setExpandedDescription(value => !value)}><Text numberOfLines={expandedDescription ? 4 : 1} style={s.reelDescription}>{film.synopsis || part.description}</Text></Pressable>}
      </View>
      <View style={s.timeline} pointerEvents="box-none">
        <Pressable accessibilityRole="adjustable" accessibilityLabel="Seek episode" accessibilityValue={{min:0,max:Math.floor(playback.data?.durationSeconds??part.durationSeconds),now:elapsed}} accessibilityActions={[{name:'increment',label:'Forward 5 seconds'},{name:'decrement',label:'Rewind 5 seconds'}]} onAccessibilityAction={event=>seekPart(event.nativeEvent.actionName==='increment'?5:-5)} onLayout={event=>setTimelineWidth(event.nativeEvent.layout.width)} onPress={event=>{if(timelineWidth>0)seekPart(Math.min(Math.max(0,event.nativeEvent.locationX/timelineWidth),1)*Math.max(0,(playback.data?.durationSeconds??part.durationSeconds)-0.1)-position.current,'timeline');}} style={s.timelineTouch}>
        <View accessibilityRole="progressbar" accessibilityLabel={part.isReel?'Reel progress':'Episode progress'} accessibilityValue={{ min:0,max:playback.data?.durationSeconds ?? part.durationSeconds,now:elapsed }} style={s.timelineTrack}><LinearGradient colors={brandGradient} start={{x:0,y:0}} end={{x:1,y:0}} style={[s.timelineFill,{width:`${Math.min(100,100 * elapsed / Math.max(1,playback.data?.durationSeconds ?? part.durationSeconds))}%`}]} /></View>
        </Pressable>
        <View pointerEvents="none" style={s.timelineTimes}><Text style={s.timeCurrent}>{timeLabel(elapsed)}</Text><Text style={s.timeTotal}>{timeLabel(playback.data?.durationSeconds ?? part.durationSeconds)}</Text></View>
      </View>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  homeTabScroll:{width:'100%',height:54,flexGrow:0,flexShrink:0},homeTabs:{paddingHorizontal:12,paddingBottom:10},homeTab:{width:HOME_TAB_WIDTH,flexShrink:0,height:44,alignItems:'center',justifyContent:'center'},homeTabText:{fontSize:14,fontWeight:'700',color:'#80839D',maxWidth:94},homeTabSelected:{position:'absolute',color:'#F8F7FF'},homeTabIndicator:{position:'absolute',left:28,bottom:8,width:68,height:3,borderRadius:2,backgroundColor:'#A855F7'},
  searchButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  genrePills:{gap:8,paddingVertical:3},genrePill:{overflow:'hidden',borderRadius:18,paddingHorizontal:16,minHeight:35,alignItems:'center',justifyContent:'center',backgroundColor:'#101327'},genrePillSelected:{backgroundColor:'#7828FF'},
  shelves:{paddingBottom:28},heroShelf:{paddingHorizontal:16,paddingTop:4,paddingBottom:4},shelf:{marginTop:16},shelfHeading:{paddingTop:16,paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:8},seeAll:{minHeight:36,flexDirection:'row',alignItems:'center',gap:3},seeAllText:{color:'#C084FC',fontSize:12,fontWeight:'600'},filmRow:{flexDirection:'row',paddingHorizontal:16,gap:9,marginBottom:18},filmCell:{flex:1,minWidth:0},
  fill: { flex: 1, backgroundColor: '#050518' },
  featuredCard:{height:184,borderRadius:18,overflow:'hidden',backgroundColor:'#151832',marginBottom:12},featuredBadge:{position:'absolute',top:12,left:12,paddingHorizontal:10,paddingVertical:5,borderRadius:14,backgroundColor:'rgba(120,40,255,0.65)'},featuredBadgeText:{fontSize:9,fontWeight:'700',color:'#fff'},featuredCopy:{position:'absolute',bottom:16,left:16,right:16,flexDirection:'row',alignItems:'flex-end',gap:12},featuredMeta:{fontSize:11,color:'#DDDDEA',lineHeight:16},featuredTitle:{fontSize:20,lineHeight:25,fontWeight:'700',color:'#fff',letterSpacing:-0.5},featuredPlay:{width:42,height:42,borderRadius:21,alignItems:'center',justifyContent:'center'},genreTile:{flex:1,height:132,margin:6,borderRadius:15,overflow:'hidden',backgroundColor:'#151832'},genreCaption:{position:'absolute',bottom:12,left:12,right:12,flexDirection:'row',alignItems:'center',gap:4},genreName:{flex:1,fontSize:14,fontWeight:'700',color:'#fff'},
  savedFilmRow:{marginHorizontal:6,paddingVertical:14,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#222647',flexDirection:'row',alignItems:'center',gap:13},savedFilmCover:{width:66,height:86,borderRadius:11,overflow:'hidden',backgroundColor:'#151832',alignItems:'center',justifyContent:'center'},savedFilmCopy:{flex:1,gap:5},
  homeHeader: { paddingHorizontal:20,paddingTop:8,gap:10,paddingBottom:10 },
  brandRow: { gap: 4 },
  brandHeading: { flexDirection:'row',justifyContent:'space-between',alignItems:'center' },
  libraryButton: { minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:22,backgroundColor:'#0D1024' },
  brand: { color: '#F8F7FF', fontSize: 26, fontWeight: '800', letterSpacing: -1 },
  brandNote: { color: '#7D809F', fontSize: 9, fontWeight: '600', letterSpacing: 1.4 },
  accent: { color: '#A855F7' },
  searchWrap: { height: 38, flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D1024', borderWidth: 1, borderColor: '#1C2140', borderRadius: 10, paddingHorizontal: 12, gap: 9 },
  searchIcon: { color: '#A0A3BD', fontSize: 23, lineHeight: 26 },
  search: { flex: 1, color: '#F8F7FF', paddingVertical: 0, fontSize: 13, height: 38 },
  clearSearch: { color: '#A0A3BD', fontSize: 22 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { color: '#F8F7FF', fontSize: 18, fontWeight: '700', letterSpacing: -0.4, marginVertical: 8 },
  sectionNote: { color: '#7D809F', fontSize: 9, fontWeight: '600', letterSpacing: 1.1 },
  text: { color: '#F8F7FF', fontSize: 14, lineHeight: 22 },
  muted: { color: '#A0A3BD', fontSize: 11, lineHeight: 17 },
  list: { paddingHorizontal: 12, paddingBottom: 32 },
  resumeSection:{paddingHorizontal:6,paddingTop:8},resumeHeading:{color:'#F8F7FF',fontSize:19,fontWeight:'700',marginBottom:12},resumeCard:{direction:'ltr',width:'100%',height:122,borderRadius:15,overflow:'hidden',backgroundColor:'#11142B',borderWidth:1,borderColor:'#222647',marginBottom:12,flexDirection:'row'},resumeMedia:{width:84,height:'100%',backgroundColor:'#080B20',overflow:'hidden'},resumeInfo:{flex:1,padding:10,gap:4,justifyContent:'center'},resumeBadge:{alignSelf:'flex-start',paddingHorizontal:7,paddingVertical:4,borderRadius:6,backgroundColor:'rgba(168,85,247,0.17)'},resumeBadgeText:{fontSize:9,fontWeight:'800',letterSpacing:0.6,color:'#DCA2FF'},resumeTitle:{fontSize:16,lineHeight:19,fontWeight:'800',color:'#fff',letterSpacing:-0.4},resumeVideoPlay:{position:'absolute',bottom:12,left:12,width:32,height:32,borderRadius:16,backgroundColor:'rgba(0,0,0,0.5)',alignItems:'center',justifyContent:'center'},resumeAction:{fontSize:11,fontWeight:'700',color:'#A855F7'},resumeTrack:{height:3,borderRadius:2,backgroundColor:'rgba(255,255,255,0.15)',overflow:'hidden',marginVertical:2},resumeProgress:{height:'100%',backgroundColor:'#A855F7'},browseTabs:{direction:'ltr',flexDirection:'row',marginTop:2,backgroundColor:'#0D1024',borderRadius:22},browseTab:{flex:1,minHeight:44,alignItems:'center',justifyContent:'center',zIndex:1},browseText:{fontSize:12,fontWeight:'600',color:'#9699B6'},browseActiveText:{position:'absolute',color:'#F8F7FF'},browseIndicator:{position:'absolute',left:4,top:4,height:36,borderRadius:18,overflow:'hidden',backgroundColor:'#A855F7'},
  card: { width:'100%', marginTop:0, marginBottom:0 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  poster: { width:'100%', aspectRatio:0.7, backgroundColor:'#10152B', borderRadius:7, overflow:'hidden' },
  image: { position:'absolute', top:0, left:0, width:'100%', height:'100%' },
  posterBadge: { backgroundColor: 'rgba(255,255,255,0.13)', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)' },
  posterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  posterMark: { color: '#A855F7', fontSize: 25, marginBottom: 12 },
  posterTitle: { color: '#F8F7FF', fontSize: 18, fontWeight: '700', paddingBottom: 24 },
  cardTitle: { color: '#fff', fontSize: 13, fontWeight: '500', lineHeight: 17, letterSpacing: -0.1 },
  cardShade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '54%' },
  cardContent: { paddingTop:7,gap:4 },
  cardTagRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTag: { color:'#D1D1DE',fontSize:11,fontWeight:'500',flex:1 },
  cardYear: { color: 'rgba(255,255,255,0.55)', fontSize: 10 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardStats: { flexDirection:'row',alignItems:'center',gap:10,flexWrap:'wrap' },
  cardMetric:{flexDirection:'row',alignItems:'center',gap:4},
  cardStat: { fontSize: 10, color: 'rgba(255,255,255,0.78)', fontVariant: ['tabular-nums'] },
  categories: { gap: 8, paddingVertical: 2 },
  category: { paddingHorizontal: 15, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D1024', borderWidth: StyleSheet.hairlineWidth, borderColor: '#222647' },
  categorySelected: { backgroundColor: '#A855F7', borderColor: '#A855F7' },
  categoryText: { color: '#A8A8B3', fontSize: 12, fontWeight: '500' },
  categoryTextSelected: { color: '#fff', fontWeight: '700' },
  message: { padding: 24, gap: 14 },
  button: { backgroundColor: '#23232B', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9, alignSelf: 'flex-start' },
  buttonText: { color: '#F8F7FF', fontWeight: '600', fontSize: 12 },
  partsList: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30 },
  partHeader: { gap: 16, paddingBottom: 4 },
  hero: { gap: 14, alignItems: 'stretch', paddingVertical: 12 },
  heroPoster: { width: '100%', height: 190, borderRadius: 18, backgroundColor: '#0D1024' },
  heroCopy: { gap: 8 },
  heroTitle: { color: '#F8F7FF', fontWeight: '700', fontSize: 25, letterSpacing: -0.7 },
  eyebrow: { color: '#C084FC', fontSize: 11, fontWeight: '600', letterSpacing: 1.1 },
  synopsis: { color:'#B5B6CB',fontSize:14,lineHeight:21 },
  watchButtonGradient:{minHeight:46,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',width:'100%'},
  episodeThumb:{width:80,height:62,borderRadius:10,overflow:'hidden',backgroundColor:'#151832'},episodeNumber:{position:'absolute',bottom:5,left:5,paddingHorizontal:5,paddingVertical:2,borderRadius:4,backgroundColor:'rgba(5,5,24,0.7)'},
  watchButton: { minHeight:46,borderRadius:24,overflow:'hidden',alignItems:'center',justifyContent:'center' },
  watchButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  part: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#1C2140', gap: 14 },
  number: { color: '#fff', fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },
  partCopy: { flex: 1, gap: 3 },
  partPlay: { height: 30, width: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7828FF' },
  partPlayGlyph: { fontSize: 10, color: '#DADAE2' },
  filmProgress:{gap:9,paddingVertical:12},
  watchLabel:{fontSize:12,fontWeight:'600',color:'#DADAE2'},
  watchTrack:{height:4,borderRadius:4,backgroundColor:'#292931',overflow:'hidden'},
  watchFill:{height:4,borderRadius:4,backgroundColor:'#A855F7'},
  partProgress:{gap:5,paddingTop:7},
  progressNote:{fontSize:10,color:'#A4A4AE'},
  reel: { flex: 1, backgroundColor: '#070B19' },
  reelTop: { position: 'absolute', top: 0, left: 16, paddingTop: 8 },
  backIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.2)' },
  backGlyph: { color: '#fff', fontSize: 40, lineHeight: 42, marginTop: -3 },
  playerFooter:{position:'absolute',bottom:0,left:0,right:0,paddingHorizontal:16,paddingTop:10,gap:6},
  reelDetail: { gap:4,paddingRight:8 },
  nextEpisode:{borderRadius:24,overflow:'hidden',marginTop:8},nextEpisodeGradient:{minHeight:44,paddingHorizontal:24,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},nextEpisodeText:{color:'#fff',fontWeight:'700',fontSize:13},
  timelineTouch:{minHeight:26,justifyContent:'center'},
  timeline:{gap:0},
  timelineTrack:{height:3,borderRadius:3,backgroundColor:'rgba(255,255,255,0.2)',overflow:'hidden'},
  timelineFill:{height:3,borderRadius:3,backgroundColor:'#A855F7'},
  timelineTimes:{flexDirection:'row',justifyContent:'space-between'},
  timeCurrent:{fontSize:10,fontWeight:'600',color:'#fff',fontVariant:['tabular-nums']},
  timeTotal:{fontSize:10,color:'rgba(255,255,255,0.55)',fontVariant:['tabular-nums']},
  pausedControls:{position:'absolute',top:'50%',left:'20%',right:'20%',marginTop:-28,flexDirection:'row',justifyContent:'space-between'},
  pausedSeek:{width:56,height:56,borderRadius:28,backgroundColor:'rgba(20,20,25,0.72)',alignItems:'center',justifyContent:'center',gap:4},
  resumeButton:{width:68,height:68,borderRadius:34,backgroundColor:'rgba(20,20,25,0.72)',alignItems:'center',justifyContent:'center'},
  finishedCard:{alignItems:'center',gap:14},
  finishedLabel:{fontSize:13,color:'rgba(255,255,255,0.8)'},
  replayButton:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:17,paddingVertical:13,borderRadius:25,backgroundColor:'#fff'},
  replayText:{fontSize:12,fontWeight:'700',color:'#111'},
  reelFilmTitle:{fontSize:16,fontWeight:'700',color:'#fff',textShadowColor:'#000',textShadowRadius:5},
  reelDescription:{fontSize:12,lineHeight:18,color:'rgba(255,255,255,0.78)',textShadowColor:'#000',textShadowRadius:4},
  reelScrim:{position:'absolute',bottom:0,left:0,right:0},
  actionRail:{position:'absolute',right:6,gap:8,alignItems:'center',width:76,direction:'ltr'},
  
  railLabel:{fontSize:11,lineHeight:16,fontWeight:'600',color:'#fff',textAlign:'center',width:76,textShadowColor:'rgba(0,0,0,0.8)',textShadowRadius:3},railStat:{width:76,minWidth:76,minHeight:48,alignItems:'center',justifyContent:'center',gap:4},
  railCount:{fontSize:10,fontWeight:'600',color:'#fff',textShadowColor:'#000',textShadowRadius:4,fontVariant:['tabular-nums']},
  seekLeft:{right:'70%'},seekRight:{left:'70%'},tapCenter:{left:'30%',right:'30%'},
  seekToast:{alignItems:'center',justifyContent:'center',width:72,height:72,borderRadius:36,backgroundColor:'rgba(0,0,0,0.35)',gap:4},
  seekLabel:{fontSize:12,fontWeight:'700',color:'#fff'},
  reelCaption: { fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.9)', textShadowColor: '#000', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  reelTap: { position: 'absolute', top: '15%', bottom: '15%', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  pauseIcon: { fontSize: 44, color: 'rgba(255,255,255,0.85)', textShadowColor: '#000', textShadowRadius: 10 },
  reelInfo: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 18 },
  reelViews: { fontSize: 10, lineHeight: 14, color: 'rgba(255,255,255,0.6)', fontVariant: ['tabular-nums'], textShadowColor: '#000', textShadowRadius: 4 },
  reelStatus: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  reelError: { color: '#aaa', fontSize: 13, textAlign: 'center' },
  videoFrame: { position:'absolute',backgroundColor:'transparent' },
  video: { width: '100%', height: '100%' },
});
