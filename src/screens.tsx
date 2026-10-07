import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  AppState,
  Image,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PagerView from 'react-native-pager-view';
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
const timeLabel = (seconds: number) => {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return value >= 3600 ? `${Math.floor(value / 3600)}:${String(Math.floor(value / 60) % 60).padStart(2,'0')}:${String(value % 60).padStart(2,'0')}` : `${Math.floor(value / 60)}:${String(value % 60).padStart(2,'0')}`;
};
const compactViews = (count = 0,label='views') => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(count) + ' '+label;
const minutes = (seconds: number) =>
  `${Math.max(1, Math.round(seconds / 60))} min`;
function ProgressLine({percent,label}:{percent:number;label:string}) {
  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{min:0,max:100,now:Math.round(percent)}} style={s.watchTrack}><View style={[s.watchFill,{width:`${Math.min(100,Math.max(0,percent))}%`}]} /></View>;
}
function Button({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.button}>
      <Text style={s.buttonText}>{title}</Text>
    </Pressable>
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
function ContinueCard({film,progress,onPress,active}:{film:Film;progress?:WatchSummary;onPress:()=>void;active:boolean}){
 const {t}=useLanguage();const percent=Math.min(100,Math.max(0,progress?.percentComplete??0));
 return <Pressable accessibilityRole="button" accessibilityLabel={`Continue watching ${film.title}`} onPress={onPress} style={({pressed})=>[s.resumeCard,pressed&&s.pressed]}>
  <View style={s.resumeMedia}>
   {film.posterUrl&&<Image source={{uri:film.posterUrl}} style={s.image} resizeMode="cover"/>}
   {active&&film.trailer&&<FilmTrailer film={film}/>}
   <View pointerEvents="none" style={s.resumeVideoPlay}><Ionicons name="play" size={19} color="#fff"/></View>
  </View>
  <View style={s.resumeInfo}>
   <View style={s.resumeBadge}><Text style={s.resumeBadgeText}>{t('LAST WATCHED')}</Text></View>
   <Text numberOfLines={2} style={s.resumeTitle}>{film.title}</Text>
   <Text numberOfLines={1} style={s.cardStat}>{film.genres?.slice(0,2).join(' · ')}</Text>
   {progress&&<Text style={s.cardStat}>{progress.watchedParts}/{progress.totalParts} {t('parts watched')}</Text>}
   <View accessibilityRole="progressbar" accessibilityLabel="Continue watching progress" accessibilityValue={{min:0,max:100,now:Math.round(percent)}} style={s.resumeTrack}><View style={[s.resumeProgress,{width:`${percent}%`}]}/></View>

  </View>
 </Pressable>;
}
const FilmCard = memo(function FilmCardView({
  film,
  onPress,
  active,
  progress,
}: {
  film: Film;
  onPress: () => void;
  active: boolean;
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
        {film.posterUrl ? (
          <Image source={{ uri: film.posterUrl }} style={s.image} />
        ) : (
          <>
            <Text style={s.posterMark}>▶</Text>
          </>
        )}
        {active && film.trailer && <FilmTrailer key={film.id} film={film} />}
        <LinearGradient pointerEvents="none" colors={['transparent', 'rgba(8,8,12,0.5)', 'rgba(8,8,12,0.96)']} locations={[0, 0.45, 1]} style={s.cardShade} />
        <View pointerEvents="none" style={s.cardContent}>
          <View style={s.cardTagRow}>
            <Text numberOfLines={1} style={s.cardTag}>{film.genres?.[0] ?? 'STORY'}</Text>
            {film.year && <Text style={s.cardYear}>{film.year}</Text>}
          </View>
          {progress && <Text style={s.cardStat}>{progress.watchedParts} / {progress.totalParts} {t('parts watched')}</Text>}
          <Text numberOfLines={2} style={s.cardTitle}>{film.title}</Text>
          <View style={s.cardBottom}>
            <View style={s.cardStats}>
              <Text style={s.cardStat}>{compactViews(film.views,t('views'))}</Text>
              <Text style={s.cardStat}>♡ {new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(film.loves ?? 0)}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
});
function FilmTrailer({ film,screen='home' }: { film: Film;screen?:'home'|'film' }) {
  const trailer = film.trailer!;
  const [ended, setEnded] = useState(false);
  const [minimumExpiry] = useState(() => Date.now() + 45000);
  const playback = useQuery({
    queryKey: ['trailer-playback', film.id, trailer.assetId],
    queryFn: ({ signal }) => request<Playback>(`/v1/films/${film.id}/trailer/playback`, { signal }),
    staleTime: 20000, gcTime: 60000, retry: false,
  });
  if (!playback.data || playback.isError || ended || Date.parse(playback.data.expiresAt) < minimumExpiry) return null;
  return <View pointerEvents="none" style={s.image}>
    <ExpoPlayer key={playback.data.url} url={playback.data.url} paused={false} muted loop contentFit="contain" previewSeconds={Math.min(30, playback.data.durationSeconds)}
      initialPosition={async () => 0}
      onLoad={() => { track('video_play', film.id, undefined, { screen, source: 'trailer' }); }}
      onProgress={() => undefined}
      onEnd={() => undefined}
      onError={() => { setEnded(true); track('video_error', film.id, undefined, { screen, source: 'trailer', errorCode: 'PREVIEW_FAILED' }); }}
    />
  </View>;
}
export function HomeScreen({
  navigation,
  forceSaved=false,embedded=false,
}: TabScreenProps<'Home'> & {forceSaved?:boolean;embedded?:boolean}) {
  const focused = useIsFocused();
  const {t}=useLanguage();
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);
  useEffect(() => { if (focused) track('home_view', undefined, undefined, { screen: 'home' }); }, [focused]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('');
  const [browse,setBrowse]=useState<'popular'|'famous'|'new'|'categories'>('popular');
  const [savedOnly] = useState(forceSaved);
  const pager=useRef<PagerView>(null);
  const [paging,setPaging]=useState(false);
  const tabs=['popular','famous','new','categories'] as const;
  const changeBrowse=useCallback((value:'popular'|'famous'|'new'|'categories')=>{setGenre('');setBrowse(value);pager.current?.setPage(['popular','famous','new','categories'].indexOf(value));},[]);
  const categories = useQuery({ queryKey: ['film-categories'], queryFn: ({ signal }) => request<{ items: { name: string; count: number }[] }>('/v1/films/categories', { signal }), staleTime: 60000 });
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => { if (query) track('search', undefined, undefined, { query, screen: 'home' }); }, [query]);
  return (
    <SafeAreaView style={s.fill} edges={embedded?['left','right']:['top', 'left', 'right']}>
      <View style={s.homeHeader}>
        <View style={s.brandHeading}><View style={s.brandRow}>
          <Text style={s.brand}>koreva<Text style={s.accent}>.</Text></Text>
          <Text style={s.brandNote}>{t('SHORT STORIES. BIG FEELINGS.')}</Text>
        </View></View>
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            accessibilityLabel="Search films"
            maxLength={100}
            placeholder={t('Find your next story')}
            placeholderTextColor="#777782"
            value={search}
            onChangeText={setSearch}
            style={s.search}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={12} onPress={() => setSearch('')}><Text style={s.clearSearch}>×</Text></Pressable>}
        </View>
        {!savedOnly&&<><View style={s.browseTabs}>{(['popular','famous','new','categories'] as const).map(value=><Pressable key={value} accessibilityRole="button" accessibilityLabel={value[0].toUpperCase()+value.slice(1)} accessibilityState={{selected:browse===value}} onPress={()=>changeBrowse(value)} style={[s.browseTab,browse===value&&s.browseTabSelected]}><Text style={[s.browseText,browse===value&&s.browseTextSelected]}>{t(value[0].toUpperCase()+value.slice(1))}</Text></Pressable>)}</View>
        {browse==='categories'&&<ScrollView horizontal style={{maxHeight:44,marginTop:8}} showsHorizontalScrollIndicator={false} contentContainerStyle={s.categories}>
          {categories.isError?<Pressable onPress={()=>void categories.refetch()}><Text style={s.categoryText}>{t('Retry')}</Text></Pressable>:categories.isPending?<ActivityIndicator color="#F25B78"/>:['',...(categories.data?.items.map(item=>item.name)??[])].map(name=><Pressable key={name||'all'} accessibilityRole="button" accessibilityLabel={`Category: ${name||t('All')}`} accessibilityState={{selected:genre===name}} onPress={()=>{setGenre(name);}} style={[s.category,genre===name&&s.categorySelected]}><Text style={[s.categoryText,genre===name&&s.categoryTextSelected]}>{name||t('All')}</Text></Pressable>)}
        </ScrollView>}</>}
        <View style={s.sectionRow}>
          <Text style={s.heading}>{savedOnly ? 'Your saved stories' : query ? 'Search results' : t(browse==='categories'?genre||'Discover films':browse[0].toUpperCase()+browse.slice(1))}</Text>
          <Text style={s.sectionNote}>{query ? 'MATCHING STORIES' : 'PICK A STORY'}</Text>
        </View>
      </View>
      {savedOnly?<HomeBrowsePage navigation={navigation} browse="new" query={query} genre={genre} savedOnly focused={focused} foreground={foreground} preload={false} refreshCategories={categories.refetch}/>:<PagerView ref={pager} testID="home-browse-pager" style={{flex:1,direction:'ltr'}} initialPage={0} layoutDirection="ltr" orientation="horizontal" overScrollMode="never" keyboardDismissMode="on-drag" offscreenPageLimit={1}
        onPageScrollStateChanged={event=>setPaging(event.nativeEvent.pageScrollState!=='idle')}
        onPageSelected={event=>{const next=tabs[event.nativeEvent.position];if(next){setBrowse(next);if(next!=='categories')setGenre('');}}}>
        {tabs.map((value,index)=><View key={value} collapsable={false} style={{width:'100%',height:'100%'}}><HomeBrowsePage navigation={navigation} browse={value} query={query} genre={value==='categories'?genre:''} savedOnly={false} focused={focused&&browse===value} foreground={foreground&&!paging} preload={focused&&Math.abs(index-tabs.indexOf(browse))<=1} refreshCategories={categories.refetch}/></View>)}
      </PagerView>}

    </SafeAreaView>
  );
}
function HomeBrowsePage({navigation,browse,query,genre,savedOnly,focused,foreground,preload,refreshCategories}:{navigation:TabScreenProps<'Home'>['navigation'];browse:'popular'|'famous'|'new'|'categories';query:string;genre:string;savedOnly:boolean;focused:boolean;foreground:boolean;preload:boolean;refreshCategories:()=>unknown}){
 const {t}=useLanguage();
  const [visibleFilm, setVisibleFilm] = useState<string | undefined>();
  const [continueVisible,setContinueVisible]=useState(true);
  const viewability = useMemo(() => ({ itemVisiblePercentThreshold: 65, minimumViewTime: 500 }), []);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: { item: Film; isViewable: boolean; index: number | null }[] }) => {
    const candidates=viewableItems.filter(item=>item.isViewable).sort((a,b)=>(a.index??0)-(b.index??0));
    const visible=candidates.find(item=>item.item.trailer)??candidates[0];
    setVisibleFilm(visible?.item.id);
  }, []);
  const films = useInfiniteQuery({
    queryKey: [savedOnly ? 'films-saved' : 'films', query, genre,browse],
    enabled:focused||preload,staleTime:60000,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      request<{ items: Film[]; nextCursor: string | null }>(
        `/v1/films?limit=20&q=${encodeURIComponent(query)}&genre=${encodeURIComponent(genre)}&saved=${savedOnly}&sort=${savedOnly?'new':browse==='categories'?'new':browse}${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
        { signal },
      ),
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
  const recent=useQuery({queryKey:['last-watched-film'],enabled:focused&&!savedOnly&&!query&&!genre&&browse==='popular',staleTime:0,
    queryFn:async({signal})=>{await flushEvents();return request<{film:Film|null}>('/v1/films/last-watched',{signal});}});
  const recentFilm=!savedOnly&&!query&&!genre&&browse==='popular'?recent.data?.film:null;
  const orderedFilms=useMemo(()=>{const items=films.data?.pages.flatMap(page=>page.items)??[];return recentFilm?items.filter(item=>item.id!==recentFilm.id):items;},[films.data,recentFilm]);
  const filmIds=[...(recentFilm?[recentFilm.id]:[]),...orderedFilms.map(item=>item.id)];
  const watch=useWatchSummaries(filmIds,focused);
 return <View style={{flex:1}}>
      {films.isPending ? (
        <ActivityIndicator color="#F25B78" />
      ) : films.isError ? (
        <ErrorView error={films.error} retry={() => void films.refetch()} />
      ) : (
        <FlashList
          key={JSON.stringify([query, genre, savedOnly,browse])}
          ListHeaderComponent={recentFilm?<View style={s.resumeSection}><ContinueCard film={recentFilm} active={focused&&foreground&&continueVisible} progress={watch.data?.items.find(p=>p.filmId===recentFilm.id)} onPress={()=>navigation.navigate('Film',{film:recentFilm})}/>{orderedFilms.length>0&&<View style={s.sectionRow}><Text style={s.heading}>{t('More stories')}</Text><Text style={s.sectionNote}>KOREVA PICKS</Text></View>}</View>:null}
          data={orderedFilms}
          numColumns={2}
          extraData={{ visibleFilm, focused, foreground, watch:watch.data }}
          viewabilityConfig={viewability}
          onViewableItemsChanged={onViewableItemsChanged}
          keyExtractor={film => film.id}
          renderItem={({ item }) => (
            <FilmCard
              film={item}
              progress={watch.data?.items.find(progress=>progress.filmId===item.id)}
              active={focused && foreground && (!recentFilm?.trailer||!continueVisible) && (visibleFilm ?? (!recentFilm?.trailer?orderedFilms.slice(0,2).find(film=>film.trailer)?.id:undefined)) === item.id}
              onPress={() => navigation.navigate('Film', { film: item })}
            />
          )}
          contentContainerStyle={s.list}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={event=>setContinueVisible(event.nativeEvent.contentOffset.y<180)} scrollEventThrottle={32}
          refreshControl={
            <RefreshControl
              refreshing={films.isRefetching}
              onRefresh={() => { void films.refetch(); refreshCategories(); void watch.refetch(); if(!savedOnly&&!query&&!genre)void recent.refetch(); }}
              tintColor="#F25B78"
            />
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (films.hasNextPage && !films.isFetchingNextPage) {
              void films.fetchNextPage();
            }
          }}
          ListFooterComponent={
            films.isFetchingNextPage ? (
              <ActivityIndicator color="#F25B78" />
            ) : null
          }
          ListEmptyComponent={recentFilm?null:
            <View style={s.message}>
              <Text style={s.heading}>{savedOnly ? t('No saved stories yet') : t('No films yet')}</Text>
              <Text style={s.muted}>
                {savedOnly ? t('Save a film to find it here.') : query || genre
                  ? t('Try a different title or category.')
                  : t('Published films will appear here. Pull down to refresh.')}
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
    return <ActivityIndicator style={s.message} color="#F25B78" />;
  }
  if (detail.isError) {
    return (
      <ErrorView error={detail.error} retry={() => void detail.refetch()} />
    );
  }
  const current = detail.data.film;
  return (
    <FlashList
      data={detail.data.parts}
      extraData={watch.data}
      keyExtractor={part => part.id}
      contentContainerStyle={s.partsList}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={detail.isRefetching}
          onRefresh={() => void detail.refetch()}
          tintColor="#F25B78"
        />
      }
      ListHeaderComponent={
        <View style={s.partHeader}>
          <View style={s.hero}>
            {current.posterUrl && <Image source={{ uri: current.posterUrl }} style={s.heroPoster} />}
            <View style={s.heroCopy}>
            <Text style={s.eyebrow}>
              {current.genres.join(' / ') || 'KOREVA'}
            </Text>
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
            <View style={s.sectionRow}><Text style={s.watchLabel}>{watch.data?.watchedParts ?? 0} / {detail.data.parts.length} {t('parts watched')}</Text><Text style={s.muted}>{Math.round(watch.data?.percentComplete ?? 0)}%</Text></View>
            <ProgressLine percent={watch.data?.percentComplete ?? 0} label="Film watch progress" />
          </View>
          {detail.data.parts.some(part => part.accessPolicy === 'free' || part.previewAllowed) && <Pressable
            accessibilityRole="button" accessibilityLabel="Start watching"
            style={({ pressed }) => [s.watchButton, pressed && s.pressed]}
            onPress={() => {
              const first = detail.data.parts.find(part => part.accessPolicy === 'free' || part.previewAllowed)!;
              navigation.navigate('Player', { film: current, part: first, parts: detail.data.parts });
            }}
          ><Text style={s.watchButtonText}>▶  {t('Start watching')}</Text></Pressable>}
          <View style={s.sectionRow}><Text style={s.heading}>{t('Episodes')}</Text><Text style={s.sectionNote}>{detail.data.parts.length} {t('PARTS')}</Text></View>
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
                'Part locked',
                part.accessPolicy === 'premium'
                  ? 'This part requires a premium entitlement.'
                  : 'This part requires a rewarded-ad unlock.',
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
          <Text style={s.number}>{String(part.position).padStart(2, '0')}</Text>
          <View style={s.partCopy}>
            <Text numberOfLines={1} style={s.cardTitle}>{part.title}</Text>
            <Text style={s.muted}>
              {save.parts.some(item => item.partId === part.id && item.saved) ? 'Saved · ' : ''}{timeLabel(part.durationSeconds)} · {compactViews(part.views)} ·{' '}
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
        data={parts}
        pagingEnabled
        decelerationRate="fast"
        disableIntervalMomentum
        snapToInterval={height}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, itemIndex) => ({ length: height, offset: height * itemIndex, index: itemIndex })}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        bounces
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        extraData={index}
        viewabilityConfig={viewability}
        onViewableItemsChanged={onViewableItemsChanged}
        renderItem={({ item, index: itemIndex }) => (
          <View style={{ height, width: '100%', backgroundColor: '#000' }}>
            {itemIndex === index
              ? <PartReel key={item.id} film={film} part={item} allParts={parts} focused={focused} muted={muted} onMute={() => setMuted(value => !value)} />
              : film.posterUrl && <Image source={{ uri: film.posterUrl }} style={s.videoFrame} resizeMode="contain" />}
          </View>
        )}
      />}
      <SafeAreaView style={s.reelTop} edges={['top']} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel="Back to films" hitSlop={12} onPress={() => { track('navigation_back', film.id, current?.id, { screen: 'reel' }); navigation.goBack(); }} style={s.backIcon}>
          <Text style={s.backGlyph}>‹</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
export function PartReel({ film, part, allParts, focused, muted, onMute,onExplore }: { film: Film; part: Part; allParts?:Part[]; focused: boolean; muted: boolean; onMute: () => void;onExplore?:()=>void }) {
  const {t}=useLanguage();
  const historyParts=useMemo(()=>allParts??[part],[allParts,part]);
  const persistProgress=useRecordWatch(film.id,part,historyParts);
  const position = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
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
  function seekPart(seconds: number) {
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
    track('video_seek',film.id,part.id,{positionSeconds:Math.min(21600,target),source:seconds > 0 ? 'forward_5s' : 'backward_5s'});
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
    return <View style={s.reelStatus}><ActivityIndicator color="#fff" /></View>;
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
    <View style={s.reel}>
      <View style={s.videoFrame}>
        {playback.data && (
          <ExpoPlayer
            controlRef={player}
            key={playback.data.url}
            url={playback.data.url}
            paused={!active || !focused || completed || userPaused}
            muted={muted}
            contentFit="contain"
            initialPosition={async () => {
              // Every newly opened part starts at zero. Only a renewed grant
              // within the current reel preserves the in-memory position.
              return started.current ? clampPosition(position.current, playback.data.durationSeconds) : 0;
            }}
            onLoad={() => {
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
      <LinearGradient pointerEvents="none" colors={['transparent','rgba(0,0,0,0.72)']} style={s.reelScrim} />
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
        {completed ? <View style={s.finishedCard}><Text style={s.finishedLabel}>{t('Part finished')}</Text><View style={s.replayButton}><Ionicons name="play" size={19} color="#111" /><Text style={s.replayText}>{t('Watch again')}</Text></View></View> : userPaused && <View style={s.resumeButton}><Ionicons name="play" size={32} color="#fff" /></View>}
        <Animated.Text pointerEvents="none" style={{ position: 'absolute', fontSize: 90, color: '#F25B78', opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) }] }}>♥</Animated.Text>
      </Pressable>
      {userPaused && !completed && <View style={s.pausedControls} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel="Rewind 5 seconds" onPress={() => seekPart(-5)} style={s.pausedSeek}><Ionicons name="play-back" size={24} color="#fff" /><Text style={s.seekLabel}>−5s</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Forward 5 seconds" onPress={() => seekPart(5)} style={s.pausedSeek}><Ionicons name="play-forward" size={24} color="#fff" /><Text style={s.seekLabel}>+5s</Text></Pressable>
      </View>}
      <SafeAreaView edges={['bottom']} style={s.actionRail} pointerEvents="box-none">
        <LoveButton love={love} rail />
        <View style={s.railStat} accessibilityLabel={compactViews(love.views ?? part.views)}><Ionicons name="eye-outline" size={25} color="#fff" /><Text style={s.railCount}>{new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(love.views ?? part.views ?? 0)}</Text></View>
        <SaveButton save={save} rail />
        {onExplore&&<Pressable accessibilityRole="button" accessibilityLabel="Explore film" onPress={onExplore} style={s.railStat}><Ionicons name="film-outline" size={27} color="#fff"/><Text style={s.railCount}>{t('Explore')}</Text></Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Unmute video' : 'Mute video'} onPress={() => { onMute(); track('session_activity',film.id,part.id,{source:preview ? 'preview' : muted ? 'unmuted' : 'muted',positionSeconds:Math.min(21600,position.current)}); }} style={s.railStat}><Ionicons name={muted ? 'volume-mute-outline' : 'volume-high-outline'} size={27} color="#fff" /><Text style={s.railCount}>{muted ? t('Muted') : t('Sound')}</Text></Pressable>
      </SafeAreaView>
      <SafeAreaView style={s.reelDetail} edges={['bottom']} pointerEvents="box-none">
        <Text numberOfLines={1} style={s.reelFilmTitle}>{film.title}</Text>
        <Text numberOfLines={1} style={s.reelCaption}>{part.isReel?t('Reel'):`${t('Part')} ${part.position}`} · {part.title}</Text>
        {(film.synopsis || part.description) && <Pressable accessibilityRole="button" accessibilityLabel={expandedDescription ? 'Collapse description' : 'Expand description'} onPress={() => setExpandedDescription(value => !value)}><Text numberOfLines={expandedDescription ? 6 : 2} style={s.reelDescription}>{film.synopsis || part.description}</Text></Pressable>}
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={s.timeline} pointerEvents="none">
        <View accessibilityRole="progressbar" accessibilityLabel="Part progress" accessibilityValue={{ min:0,max:playback.data?.durationSeconds ?? part.durationSeconds,now:elapsed }} style={s.timelineTrack}><View style={[s.timelineFill,{width:`${Math.min(100,100 * elapsed / Math.max(1,playback.data?.durationSeconds ?? part.durationSeconds))}%`}]} /></View>
        <View style={s.timelineTimes}><Text style={s.timeCurrent}>{timeLabel(elapsed)}</Text><Text style={s.timeTotal}>{timeLabel(playback.data?.durationSeconds ?? part.durationSeconds)}</Text></View>
      </SafeAreaView>
    </View>
  );
}
const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0C0C0F' },
  homeHeader: { paddingHorizontal: 20, paddingTop: 12, gap: 14, paddingBottom: 6 },
  brandRow: { gap: 4 },
  brandHeading: { flexDirection:'row',justifyContent:'space-between',alignItems:'center' },
  libraryButton: { minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:22,backgroundColor:'#18181D' },
  brand: { color: '#F5F5F7', fontSize: 26, fontWeight: '800', letterSpacing: -1 },
  brandNote: { color: '#777782', fontSize: 9, fontWeight: '600', letterSpacing: 1.4 },
  accent: { color: '#F25B78' },
  searchWrap: { height: 38, flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181D', borderWidth: 1, borderColor: '#25252D', borderRadius: 10, paddingHorizontal: 12, gap: 9 },
  searchIcon: { color: '#9696A1', fontSize: 23, lineHeight: 26 },
  search: { flex: 1, color: '#F5F5F7', paddingVertical: 0, fontSize: 13, height: 38 },
  clearSearch: { color: '#9696A1', fontSize: 22 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { color: '#F5F5F7', fontSize: 18, fontWeight: '700', letterSpacing: -0.4, marginVertical: 8 },
  sectionNote: { color: '#777782', fontSize: 9, fontWeight: '600', letterSpacing: 1.1 },
  text: { color: '#F5F5F7', fontSize: 14, lineHeight: 22 },
  muted: { color: '#9696A1', fontSize: 11, lineHeight: 17 },
  list: { paddingHorizontal: 14, paddingBottom: 32 },
  resumeSection:{paddingHorizontal:6,paddingTop:8},resumeHeading:{color:'#F5F5F7',fontSize:19,fontWeight:'700',marginBottom:12},resumeCard:{direction:'ltr',width:'100%',height:124,borderRadius:15,overflow:'hidden',backgroundColor:'#1A1A22',borderWidth:1,borderColor:'#30303B',marginBottom:12,flexDirection:'row'},resumeMedia:{width:'32%',height:124,backgroundColor:'#101014',overflow:'hidden'},resumeInfo:{flex:1,padding:10,gap:4,justifyContent:'center'},resumeBadge:{alignSelf:'flex-start',paddingHorizontal:7,paddingVertical:4,borderRadius:6,backgroundColor:'rgba(242,91,120,0.15)'},resumeBadgeText:{fontSize:8,fontWeight:'800',letterSpacing:0.6,color:'#F58BA0'},resumeTitle:{fontSize:16,lineHeight:19,fontWeight:'800',color:'#fff',letterSpacing:-0.4},resumeVideoPlay:{position:'absolute',bottom:12,left:12,width:32,height:32,borderRadius:16,backgroundColor:'rgba(0,0,0,0.5)',alignItems:'center',justifyContent:'center'},resumeAction:{fontSize:11,fontWeight:'700',color:'#F25B78'},resumeTrack:{height:3,borderRadius:2,backgroundColor:'rgba(255,255,255,0.15)',overflow:'hidden',marginVertical:2},resumeProgress:{height:'100%',backgroundColor:'#F25B78'},browseTabs:{flexDirection:'row',gap:4,marginTop:8},browseTab:{flex:1,minHeight:40,alignItems:'center',justifyContent:'center',borderBottomWidth:2,borderBottomColor:'transparent'},browseTabSelected:{borderBottomColor:'#F25B78'},browseText:{fontSize:12,fontWeight:'600',color:'#92929D'},browseTextSelected:{color:'#F5F5F7'},
  card: { flex: 1, marginHorizontal: 6, marginTop: 8, marginBottom: 14 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  poster: { aspectRatio: 0.64, backgroundColor: '#1C1C25', borderRadius: 13, overflow: 'hidden', justifyContent: 'center', padding: 14, borderWidth: 1, borderColor: '#25252D' },
  image: { position: 'absolute', top: 0, left: 0, bottom: 0, right: 0 },
  posterBadge: { backgroundColor: 'rgba(255,255,255,0.13)', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)' },
  posterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  posterMark: { color: '#F25B78', fontSize: 25, marginBottom: 12 },
  posterTitle: { color: '#F5F5F7', fontSize: 18, fontWeight: '700', paddingBottom: 24 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 20, letterSpacing: -0.2, textShadowColor: '#000', textShadowRadius: 8 },
  cardShade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%' },
  cardContent: { position: 'absolute', bottom: 12, left: 11, right: 11, gap: 6 },
  cardTagRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTag: { color: '#F4A2B3', fontSize: 8, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase',flex:1 },
  cardYear: { color: 'rgba(255,255,255,0.55)', fontSize: 10 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardStats: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardStat: { fontSize: 9, color: 'rgba(255,255,255,0.78)', fontVariant: ['tabular-nums'] },
  categories: { gap: 8, paddingVertical: 2 },
  category: { paddingHorizontal: 15, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#18181D', borderWidth: StyleSheet.hairlineWidth, borderColor: '#303038' },
  categorySelected: { backgroundColor: '#F25B78', borderColor: '#F25B78' },
  categoryText: { color: '#A8A8B3', fontSize: 12, fontWeight: '500' },
  categoryTextSelected: { color: '#fff', fontWeight: '700' },
  message: { padding: 24, gap: 14 },
  button: { backgroundColor: '#23232B', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9, alignSelf: 'flex-start' },
  buttonText: { color: '#F5F5F7', fontWeight: '600', fontSize: 12 },
  partsList: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30 },
  partHeader: { gap: 16, paddingBottom: 4 },
  hero: { flexDirection: 'row', gap: 16, alignItems: 'center', paddingVertical: 12 },
  heroPoster: { width: 88, height: 132, borderRadius: 10, backgroundColor: '#18181D' },
  heroCopy: { flex: 1, gap: 8 },
  heroTitle: { color: '#F5F5F7', fontWeight: '700', fontSize: 25, letterSpacing: -0.7 },
  eyebrow: { color: '#F25B78', fontSize: 9, fontWeight: '600', letterSpacing: 1.1 },
  synopsis: { color: '#9696A1', fontSize: 12, lineHeight: 19 },
  watchButton: { height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F25B78' },
  watchButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  part: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#202027', gap: 14 },
  number: { color: '#5F5F6C', fontSize: 15, fontWeight: '600', width: 26, fontVariant: ['tabular-nums'] },
  partCopy: { flex: 1, gap: 3 },
  partPlay: { height: 30, width: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#202027' },
  partPlayGlyph: { fontSize: 10, color: '#DADAE2' },
  filmProgress:{gap:9,paddingVertical:12},
  watchLabel:{fontSize:12,fontWeight:'600',color:'#DADAE2'},
  watchTrack:{height:4,borderRadius:4,backgroundColor:'#292931',overflow:'hidden'},
  watchFill:{height:4,borderRadius:4,backgroundColor:'#F25B78'},
  partProgress:{gap:5,paddingTop:7},
  progressNote:{fontSize:10,color:'#A4A4AE'},
  reel: { flex: 1, backgroundColor: '#000' },
  reelTop: { position: 'absolute', top: 0, left: 16, paddingTop: 8 },
  backIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.2)' },
  backGlyph: { color: '#fff', fontSize: 40, lineHeight: 42, marginTop: -3 },
  reelDetail: { position: 'absolute', bottom: 42, left: 0, right: 78, paddingLeft: 20, paddingBottom: 18, gap:5 },
  timeline:{position:'absolute',left:20,right:20,bottom:0,paddingBottom:12,gap:7},
  timelineTrack:{height:3,borderRadius:3,backgroundColor:'rgba(255,255,255,0.2)',overflow:'hidden'},
  timelineFill:{height:3,borderRadius:3,backgroundColor:'#F25B78'},
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
  reelFilmTitle:{fontSize:17,fontWeight:'700',color:'#fff',textShadowColor:'#000',textShadowRadius:5},
  reelDescription:{fontSize:12,lineHeight:18,color:'rgba(255,255,255,0.78)',textShadowColor:'#000',textShadowRadius:4},
  reelScrim:{position:'absolute',bottom:0,left:0,right:0,height:'42%'},
  actionRail:{position:'absolute',right:12,bottom:110,gap:19,alignItems:'center',width:52},
  railStat:{minWidth:48,minHeight:44,alignItems:'center',justifyContent:'center',gap:4},
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
  videoFrame: { position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, backgroundColor: '#000' },
  video: { width: '100%', height: '100%' },
});
