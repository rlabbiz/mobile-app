import React,{useRef,useState} from 'react';
import {Image,StyleSheet,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useQueryClient,type QueryClient} from '@tanstack/react-query';
import type {Film} from './api/types';
const refreshedAt=new WeakMap<QueryClient,number>();

// Remote React Native images need concrete bounds; absolute edges alone can
// leave their intrinsic dimensions unset on the native image surface.
export function FilmCover({film}:{film:Film}){
  const queries=useQueryClient(),retried=useRef(false),[failedUri,setFailedUri]=useState<string|null>(null);
  const uri=film.posterUrl;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <LinearGradient colors={['#352044','#11182C','#090C1D']} style={StyleSheet.absoluteFill}/>
    {uri&&failedUri!==uri?<Image testID="film-cover" accessibilityLabel={`${film.title} cover`} source={{uri}} resizeMode="cover" style={styles.image} onError={()=>{
      setFailedUri(uri);
      if(!retried.current){retried.current=true;const last=refreshedAt.get(queries);if(last===undefined||Date.now()-last>30000){refreshedAt.set(queries,Date.now());void queries.invalidateQueries({queryKey:['films']});void queries.invalidateQueries({queryKey:['film',film.id]});void queries.invalidateQueries({queryKey:['last-watched']});}}
    }}/>:<View style={styles.fallback}><Ionicons name="film-outline" size={36} color="#9B81B3"/></View>}
  </View>;
}
const styles=StyleSheet.create({image:{position:'absolute',top:0,left:0,width:'100%',height:'100%'},fallback:{flex:1,alignItems:'center',justifyContent:'center',paddingBottom:46}});
