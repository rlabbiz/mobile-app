import React from 'react';
import {ActivityIndicator,Image,Pressable,StyleSheet,Text,View,type StyleProp,type ViewStyle} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {brandGradient,colors} from './theme';

export const brandMark = require('../assets/brand/mark.png');
export const launchArtwork = require('../assets/brand/launch.jpg');
export function Brand({large=false}:{large?:boolean}){
 return <View accessibilityLabel="Koreva" style={s.brand}><Image accessible={false} source={brandMark} style={large?s.largeMark:s.mark} resizeMode="contain"/><Text style={[s.wordmark,large&&s.largeWordmark]}>Kore<Text style={s.wordmarkAccent}>va</Text></Text></View>;
}
export function GradientButton({title,onPress,disabled=false,pending=false,accessibilityLabel,style}:{title:string;onPress:()=>void;disabled?:boolean;pending?:boolean;accessibilityLabel?:string;style?:StyleProp<ViewStyle>}){
 return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel??title} accessibilityState={{disabled:disabled||pending,busy:pending}} disabled={disabled||pending} onPress={onPress} style={({pressed})=>[s.button,style,(pressed||disabled||pending)&&s.dim]}><LinearGradient colors={brandGradient} start={{x:0,y:0.5}} end={{x:1,y:0.5}} style={s.buttonFill}>{pending?<ActivityIndicator color="#fff"/>:<Text style={s.buttonText}>{title}</Text>}</LinearGradient></Pressable>;
}
const s=StyleSheet.create({brand:{flexDirection:'row',alignItems:'center',gap:7},mark:{width:31,height:31},largeMark:{width:76,height:76},wordmark:{fontSize:26,fontWeight:'800',letterSpacing:-1.1,color:colors.text},largeWordmark:{fontSize:45,letterSpacing:-1.8},wordmarkAccent:{color:'#DDA3FF'},button:{borderRadius:24,overflow:'hidden'},buttonFill:{minHeight:46,alignItems:'center',justifyContent:'center',paddingHorizontal:20,paddingVertical:12},buttonText:{color:'#fff',fontSize:13,fontWeight:'700'},dim:{opacity:0.6}});
