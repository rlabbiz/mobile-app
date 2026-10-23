import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,Platform,Pressable,Share,StyleSheet,Text,View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useQuery} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {Routes} from '../App';
import type {Film,FilmDetail,Part} from './api/types';
import {request} from './api/client';
import {track} from './api/telemetry';
import {useLanguage} from './i18n';
import {GradientButton} from './brand';
export type SharedPart=FilmDetail&{part:Part;url:string};
export const validContentId=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export async function sharePart(film:Film,part:Part){
  const data=await request<SharedPart>(`/v1/films/${encodeURIComponent(film.id)}/parts/${encodeURIComponent(part.id)}/share`);
  const expected=`koreva://watch/${film.id}/${part.id}`;
  if(data.url!==expected)throw new Error('This story cannot be shared right now.');
  // A share-sheet handoff is observable; Android cannot confirm delivery to another person.
  await track('session_activity',film.id,part.id,{screen:'reel',source:'share_opened'});
  const caption=`${film.title} · ${part.title}\nWatch on Koreva`;
  const result=await Share.share(Platform.OS==='ios'?{title:film.title,message:caption,url:data.url}:{title:film.title,message:`${caption}\n${data.url}`});
  await track('session_activity',film.id,part.id,{screen:'reel',source:result.action===Share.dismissedAction?'share_dismissed':'share_sheet_closed'});
}
export function SharePartButton({film,part,onOpenChange}:{film:Film;part:Part;onOpenChange?:(open:boolean)=>void}){
  const {t}=useLanguage(),[pending,setPending]=useState(false),busy=useRef(false);
  async function open(){
    if(busy.current)return;busy.current=true;setPending(true);onOpenChange?.(true);
    try{await sharePart(film,part);}catch(error){Alert.alert(t('Share'),error instanceof Error?error.message:'Unable to share this story.');}
    finally{busy.current=false;setPending(false);onOpenChange?.(false);}
  }
  return <Pressable accessibilityRole="button" accessibilityLabel={t(part.isReel?'Share this reel':'Share this episode')} accessibilityState={{disabled:pending,busy:pending}} disabled={pending} onPress={()=>void open()} style={styles.share}>
    {pending?<ActivityIndicator color="#fff" size="small"/>:<Ionicons name="arrow-redo" size={27} color="#fff"/>}<Text style={styles.label}>{t('Share')}</Text>
  </Pressable>;
}
export function SharedScreen({route,navigation}:NativeStackScreenProps<Routes,'Shared'>){
  const {t}=useLanguage(),{filmId,partId}=route.params;
  const valid=validContentId(filmId)&&validContentId(partId);
  const result=useQuery({queryKey:['shared-part',filmId,partId],enabled:valid,retry:false,queryFn:({signal})=>request<SharedPart>(`/v1/films/${filmId}/parts/${partId}/share`,{signal})});
  useEffect(()=>{if(result.data)navigation.replace('Player',{film:result.data.film,part:result.data.part,parts:result.data.part.isReel?[result.data.part]:result.data.parts});},[result.data,navigation]);
  return <View style={styles.loading}>{valid&&!result.isError?<><ActivityIndicator color="#A855F7"/><Text style={styles.text}>{t('Opening your story')}</Text></>:<><Text style={styles.text}>{valid?(result.error instanceof Error?result.error.message:'This story is unavailable.'):'This link is invalid.'}</Text>{valid&&<GradientButton title={t('Try again')} onPress={()=>void result.refetch()}/>}<GradientButton title={t('Home')} onPress={()=>navigation.replace('Main')}/></>}</View>;
}
const styles=StyleSheet.create({share:{width:76,minWidth:76,minHeight:44,alignItems:'center',justifyContent:'center',gap:4},label:{fontSize:11,lineHeight:16,width:76,textAlign:'center',fontWeight:'600',color:'#fff',textShadowColor:'#000',textShadowRadius:4},loading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#050518',padding:24,gap:18},text:{color:'#D8DAE9',textAlign:'center'}});
