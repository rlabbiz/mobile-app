
import React from 'react';
import { AppState, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator,type NativeStackScreenProps } from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import {ReelsScreen,SavedScreen} from './src/ReelsScreen';
import {ProfileScreen} from './src/ProfileScreen';
import {LanguageProvider,useLanguage} from './src/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomeScreen, FilmScreen, PlayerScreen } from './src/screens';
import type { Film, Part } from './src/api/types';
import { flushEvents, track } from './src/api/telemetry';
export type Routes = {
  Main:undefined;
  Reels:undefined;
  Saved:undefined;
  Profile:undefined;
  Home: undefined;
  Film: { film: Film };
  Player: { film: Film; part: Part; next?: Part; parts?: Part[] };
};
export type TabScreenProps<Name extends 'Home'|'Reels'|'Saved'>={navigation:Pick<NativeStackScreenProps<Routes>['navigation'],'navigate'>;route:NativeStackScreenProps<Routes,Name>['route']};
const Stack = createNativeStackNavigator<Routes>();
const Tabs=createBottomTabNavigator<Pick<Routes,'Home'|'Reels'|'Saved'|'Profile'>>();
function MainTabs({navigation}:NativeStackScreenProps<Routes,'Main'>){
  const {t}=useLanguage();
  return <Tabs.Navigator screenOptions={({route})=>({headerShown:false,tabBarLabel:t(route.name),tabBarActiveTintColor:'#F25B78',tabBarInactiveTintColor:'#777782',tabBarStyle:{backgroundColor:'#0C0C0F',borderTopColor:'#202027'},tabBarLabelStyle:{fontSize:10,fontWeight:'600'},tabBarIcon:({color,size})=><Ionicons name={route.name==='Home'?'home-outline':route.name==='Reels'?'play-circle-outline':route.name==='Saved'?'bookmark-outline':'person-outline'} color={color} size={size}/>})}>
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
        <NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: '#0C0C0F', card: '#0C0C0F', primary: '#F25B78', border: '#202027' } }}>
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: '#0C0C0F' },
              headerTintColor: '#F5F5F7',
              headerShadowVisible: false,
              headerTitleStyle: { fontSize: 14, fontWeight: '600' },
              contentStyle: { backgroundColor: '#0C0C0F' },
            }}
          >
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{ headerShown: false }}
            />
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
        </NavigationContainer></LanguageProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
