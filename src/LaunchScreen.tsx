import React,{useCallback,useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,ActivityIndicator,Animated,Image,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {LinearGradient} from 'expo-linear-gradient';
import {Asset} from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import {Brand,brandMark,launchArtwork} from './brand';
import {colors} from './theme';
import {useLanguage} from './i18n';

void SplashScreen.preventAutoHideAsync().catch(()=>undefined);
export function LaunchScreen({onArtworkReady}:{onArtworkReady?:()=>void}){
 const {t}=useLanguage();
 return <View testID="koreva-launch-screen" style={s.page}>
  <Image testID="launch-artwork" source={launchArtwork} resizeMode="cover" style={StyleSheet.absoluteFill} onLoadEnd={onArtworkReady}/>
  <LinearGradient colors={['rgba(5,5,24,0.18)','transparent','rgba(5,5,24,0.9)']} locations={[0,0.45,1]} style={StyleSheet.absoluteFill}/>
  <SafeAreaView style={s.content} edges={['top','bottom']}>
   <View style={s.header}><Brand/></View>
   <View style={s.copy}><Text style={s.title}>{t('Short dramas.')}{'\n'}<Text style={s.accent}>{t('Big emotions.')}</Text></Text><View style={s.loading}><ActivityIndicator accessibilityLabel={t('Loading your stories')} color="#DCA2FF" size="small"/><Text style={s.loadingText}>{t('Loading your stories')}</Text></View></View>
  </SafeAreaView>
 </View>;
}
export function LaunchBoundary({children}:{children:React.ReactNode}){
 const [assetsReady,setAssetsReady]=useState(false),[artworkReady,setArtworkReady]=useState(false),[visible,setVisible]=useState(true);
 const [fade]=useState(()=>new Animated.Value(1));
 const reducedMotion=useRef(false);
 const handleArtworkReady=useCallback(()=>setArtworkReady(true),[]);
 useEffect(()=>{
  let active=true;
  void AccessibilityInfo.isReduceMotionEnabled().then(value=>{reducedMotion.current=value;}).catch(()=>undefined);
  void Asset.loadAsync([brandMark,launchArtwork]).catch(()=>undefined).finally(()=>{if(active)setAssetsReady(true);});
  // A decode/download failure in Expo Go must not strand the user at launch.
  const fallback=setTimeout(()=>{if(active){setAssetsReady(true);setArtworkReady(true);}},5000);
  return()=>{active=false;clearTimeout(fallback);};
 },[]);
 useEffect(()=>{
  // Wait for the actual Image load event, not just layout: this prevents showing
  // branding on a blank background while the artwork is still decoding.
  if(!artworkReady)return;
  void SplashScreen.hideAsync().catch(()=>undefined);
 },[artworkReady]);
 useEffect(()=>{
  if(!assetsReady||!artworkReady||!visible)return;
  const animation=Animated.timing(fade,{toValue:0,duration:reducedMotion.current?0:180,useNativeDriver:true});
  animation.start(({finished})=>{if(finished)setVisible(false);});
  return()=>animation.stop();
 },[assetsReady,artworkReady,visible,fade]);
 return <View style={s.page}><View style={s.page} accessibilityElementsHidden={visible} importantForAccessibility={visible?'no-hide-descendants':'auto'}>{children}</View>{visible&&<Animated.View style={[StyleSheet.absoluteFill,{opacity:fade,zIndex:100}]}><LaunchScreen onArtworkReady={handleArtworkReady}/></Animated.View>}</View>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:colors.background},content:{flex:1,justifyContent:'space-between',paddingHorizontal:24},header:{paddingTop:16},copy:{paddingBottom:36,gap:24},title:{fontSize:32,lineHeight:40,fontWeight:'700',letterSpacing:-1,color:'#fff'},accent:{color:'#DCA2FF'},loading:{flexDirection:'row',alignItems:'center',gap:10},loadingText:{fontSize:12,color:'#D3CAE2'}});
