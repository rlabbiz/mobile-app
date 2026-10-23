
import React from 'react';
import {SharedScreen} from './src/sharing';
import {LaunchBoundary} from './src/LaunchScreen';
import { AppState, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator,type NativeStackScreenProps } from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import {ReelsScreen,SavedScreen} from './src/ReelsScreen';
import {ProfileScreen} from './src/ProfileScreen';
import {LanguageProvider,useLanguage} from './src/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomeScreen, FilmScreen, PlayerScreen, BrowseScreen } from './src/screens';
import type { Film, Part } from './src/api/types';
import { flushEvents, track } from './src/api/telemetry';
export type Routes = {
  Browse:{sort:'popular'|'famous'|'new';genre:string;title:string};
  Shared:{filmId:string;partId:string};
  Main:undefined;
  Reels:undefined;
  Saved:undefined;
  Profile:undefined;
  Home: undefined;
  Film: { film: Film };
  Player: { film: Film; part: Part; next?: Part; parts?: Part[] };
};
export type TabScreenProps<Name extends 'Home'|'Reels'|'Saved'>={navigation:Pick<NativeStackScreenProps<Routes>['navigation'],'navigate'>;route:NativeStackScreenProps<Routes,Name>['route']};
const linking:LinkingOptions<Routes>={prefixes:['koreva://'],config:{initialRouteName:'Main' as const,screens:{Shared:'watch/:filmId/:partId'}}};
const Stack = createNativeStackNavigator<Routes>();
const Tabs=createBottomTabNavigator<Pick<Routes,'Home'|'Reels'|'Saved'|'Profile'>>();
function MainTabs({navigation}:NativeStackScreenProps<Routes,'Main'>){
  const {t}=useLanguage();
  return <Tabs.Navigator screenOptions={({route})=>({headerShown:false,tabBarLabel:t(route.name==='Saved'?'My List':route.name),tabBarActiveTintColor:'#A855F7',tabBarInactiveTintColor:'#7D809F',tabBarStyle:{backgroundColor:'#050518',borderTopColor:'#1C2140',paddingTop:6},tabBarLabelStyle:{fontSize:10,fontWeight:'600'},tabBarIcon:({color,size,focused})=><Ionicons name={route.name==='Home'?(focused?'home':'home-outline'):route.name==='Reels'?(focused?'play-circle':'play-circle-outline'):route.name==='Saved'?(focused?'heart':'heart-outline'):(focused?'person':'person-outline')} color={color} size={size}/>})}>
    <Tabs.Screen name="Home">{props=><HomeScreen navigation={navigation} route={{key:props.route.key,name:'Home'}}/>}</Tabs.Screen>
    <Tabs.Screen name="Reels">{props=><ReelsScreen navigation={navigation} route={{key:props.route.key,name:'Reels'}}/>}</Tabs.Screen>
    <Tabs.Screen name="Saved">{props=><SavedScreen navigation={navigation} route={{key:props.route.key,name:'Saved'}}/>}</Tabs.Screen>
    <Tabs.Screen name="Profile" component={ProfileScreen}/>
  </Tabs.Navigator>;
}
const queries = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      gcTime: 300000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
export default function App() {
  React.useEffect(() => {
    track('app_open');
    let previous = AppState.currentState;
    const listener = AppState.addEventListener('change', state => {
      if (state === previous) return;
      if (state === 'active') track('app_foreground');
      else if (previous === 'active') void track('app_background').then(() => flushEvents());
      previous = state;
    });
    return () => listener.remove();
  }, []);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queries}>
        <LanguageProvider><StatusBar barStyle="light-content" />
        <LaunchBoundary><NavigationContainer linking={linking} theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: '#050518', card: '#050518', primary: '#A855F7', border: '#1C2140' } }}>
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: '#050518' },
              headerTintColor: '#F8F7FF',
              headerShadowVisible: false,
              headerTitleStyle: { fontSize: 14, fontWeight: '600' },
              contentStyle: { backgroundColor: '#050518' },
            }}
          >
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="Browse" component={BrowseScreen} options={({route})=>({title:route.params.title})}/>
            <Stack.Screen name="Shared" component={SharedScreen} options={{title:'Koreva'}}/>
            <Stack.Screen
              name="Film"
              component={FilmScreen}
              options={({ route }) => ({ title: route.params.film.title })}
            />
            <Stack.Screen
              name="Player"
              component={PlayerScreen}
              options={{ headerShown: false, orientation: 'portrait', animation: 'none', gestureEnabled: false }}
            />
          </Stack.Navigator>
        </NavigationContainer></LaunchBoundary></LanguageProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
