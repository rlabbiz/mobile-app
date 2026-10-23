import React,{useState} from 'react';
import {ActivityIndicator,Alert,KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useIsFocused} from '@react-navigation/native';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import {randomUUID} from 'expo-crypto';
import {request} from './api/client';
import {changeAccount,type Profile} from './api/profile';
import {flushEvents,clearPendingEvents} from './api/telemetry';
import {clearWatchHistory} from './api/watch-progress';
import {useLanguage,type Language} from './i18n';
import {GradientButton} from './brand';
export function ProfileScreen(){
  const focused=useIsFocused(),queries=useQueryClient();
  const {language,t,setLanguage}=useLanguage();
  const profile=useQuery({queryKey:['profile'],enabled:focused,queryFn:()=>request<Profile>('/v1/profile'),staleTime:30000});
  const [mode,setMode]=useState<'profile'|'register'|'login'>('profile');
  const [nameDraft,setName]=useState<string|undefined>(),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[visible,setVisible]=useState(false),[validation,setValidation]=useState('');
  const name=nameDraft??profile.data?.displayName??'';
  const linked=profile.data?.status==='linked';
  const account=useMutation({mutationFn:async(action:'register'|'login'|'logout')=>{
    await flushEvents();await queries.cancelQueries();
    const result=await changeAccount(action,action==='logout'?undefined:{email:email.trim().toLowerCase(),password,...action==='register'?{displayName:name.trim()}:{}});
    if(action==='logout'){await clearPendingEvents();await clearWatchHistory();}
    return result;
  },onSuccess:async(result)=>{setPassword('');setName(undefined);setVisible(false);setMode('profile');setValidation('');await queries.resetQueries();queries.setQueryData(['profile'],result);}});
  const edit=useMutation({mutationFn:()=>request<Profile>('/v1/profile',{method:'POST',headers:{'Idempotency-Key':randomUUID()},body:JSON.stringify({displayName:name.trim()})}),onSuccess:result=>queries.setQueryData(['profile'],result)});
  const locale=useMutation({mutationFn:(value:Language)=>request<Profile>('/v1/profile',{method:'POST',headers:{'Idempotency-Key':randomUUID()},body:JSON.stringify({locale:value})}),onSuccess:async(result)=>{queries.setQueryData(['profile'],result);await setLanguage(result.locale as Language);}});
  const busy=account.isPending||edit.isPending||locale.isPending;
  const submit=()=>{
    setValidation('');
    if(mode==='profile'){if(!name.trim())return setValidation(t('Enter your name.'));edit.mutate();return;}
    if(mode==='register'&&!name.trim())return setValidation(t('Enter your name.'));
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))return setValidation(t('Enter a valid email address.'));
    if(password.length<12)return setValidation(t('Use a password with at least 12 characters.'));
    account.mutate(mode);
  };
  const switchMode=(next:'register'|'login'|'profile')=>{setMode(next);setPassword('');setValidation('');account.reset();edit.reset();};
  const error=validation||account.error?.message||edit.error?.message||locale.error?.message;
  return <SafeAreaView edges={['top','left','right']} style={s.page}><KeyboardAvoidingView style={s.page} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <View style={s.header}><Text style={s.heading}>{t('Profile')}</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh profile" disabled={busy} onPress={()=>void profile.refetch()}><Ionicons name="reload-outline" size={20} color="#B9B9C3"/></Pressable></View>
    {profile.isPending?<ActivityIndicator color="#A855F7"/>:profile.isError?<Pressable onPress={()=>void profile.refetch()}><Text style={s.error}>{t('Unable to load your profile. Tap to retry.')}</Text></Pressable>:<>
      <View style={s.identity}><View style={s.avatar}><Text style={s.initial}>{(profile.data?.displayName??'K').slice(0,1).toUpperCase()}</Text></View><Text style={s.name}>{profile.data?.displayName||(linked?t('Your account'):t('Watching as a guest'))}</Text><Text style={s.note}>{linked?profile.data?.email:t('Your viewing history stays with you.')}</Text><Text style={s.badge}>{linked?t('Koreva account'):t('Guest session')}</Text></View>
      {mode==='profile'&&!linked?<View style={s.card}><Text style={s.title}>{t('Take Koreva with you')}</Text><Text style={s.note}>{t('Create an account to keep your loves, saved films, reels, and watch progress across devices.')}</Text><GradientButton title={t('Create account')} accessibilityLabel="Create account" onPress={()=>switchMode('register')}/><Pressable accessibilityRole="button" accessibilityLabel="Sign in" onPress={()=>switchMode('login')} style={s.secondary}><Text style={s.buttonText}>{t('Already have an account? Sign in')}</Text></Pressable></View>:<View style={s.card}>
        <Text style={s.title}>{mode==='register'?t('Create your account'):mode==='login'?t('Welcome back'):t('Your details')}</Text>
        {mode!=='login'&&<><Text style={s.label}>{t('Name')}</Text><TextInput accessibilityLabel="Name" value={name} onChangeText={setName} placeholder={t('Your name')} placeholderTextColor="#6E6E79" maxLength={120} autoComplete="name" editable={!busy} style={s.input}/></>}
        {mode!=='profile'&&<><Text style={s.label}>{t('Email')}</Text><TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" maxLength={254} placeholder="you@example.com" placeholderTextColor="#6E6E79" editable={!busy} style={s.input}/><Text style={s.label}>{t('Password')}</Text><View style={s.password}><TextInput accessibilityLabel="Password" value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete={mode==='register'?'new-password':'current-password'} maxLength={128} placeholder={mode==='register'?t('At least 12 characters'):t('Your password')} placeholderTextColor="#6E6E79" editable={!busy} style={[s.input,s.passwordInput]}/><Pressable accessibilityRole="button" accessibilityLabel={visible?'Hide password':'Show password'} onPress={()=>setVisible(v=>!v)} style={s.eye}><Ionicons name={visible?'eye-off-outline':'eye-outline'} color="#A3A3AE" size={20}/></Pressable></View><Text style={s.note}>{mode==='register'?t('Your current session becomes this account. Nothing is reset.'):t('Your guest saves, loves, and watch history will join this account.')}</Text></>}
        {error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
        <GradientButton title={mode==='register'?t('Create account'):mode==='login'?t('Sign in'):t('Save profile')} pending={busy} onPress={submit}/>
        {mode!=='profile'&&<><Pressable disabled={busy} onPress={()=>switchMode(mode==='login'?'register':'login')} style={s.secondary}><Text style={s.buttonText}>{mode==='login'?t('New here? Create an account'):t('Already have an account? Sign in')}</Text></Pressable><Pressable disabled={busy} onPress={()=>switchMode('profile')} style={s.secondary}><Text style={s.note}>{t('Continue as guest')}</Text></Pressable></>}
      </View>}
      <View style={s.card}><Text style={s.title}>{t('Language')}</Text><View style={{flexDirection:'row',gap:8}}>{([['en','English'],['fr','Français'],['ar','العربية']] as const).map(([value,label])=><Pressable key={value} accessibilityRole="button" accessibilityLabel={`Language: ${label}`} accessibilityState={{selected:language===value}} disabled={busy} onPress={()=>locale.mutate(value)} style={{flex:1,paddingVertical:11,borderRadius:10,alignItems:'center',backgroundColor:language===value?'#38205B':'#151832'}}><Text style={s.buttonText}>{label}</Text></Pressable>)}</View>{locale.error&&<Text style={s.error}>{locale.error.message}</Text>}</View>
      {linked&&mode==='profile'&&<Pressable accessibilityRole="button" accessibilityLabel="Sign out" disabled={busy} style={s.secondary} onPress={()=>Alert.alert(t('Sign out?'),t('Your account’s saves and history stay safe. This phone will continue as a guest.'),[{text:t('Cancel'),style:'cancel'},{text:t('Sign out'),style:'destructive',onPress:()=>account.mutate('logout')}])}><Text style={s.signout}>{t('Sign out')}</Text></Pressable>}
    </>}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:'#050518'},content:{padding:20,paddingBottom:32,gap:20},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},heading:{color:'#fff',fontSize:23,fontWeight:'700'},identity:{alignItems:'center',gap:9,paddingVertical:14},avatar:{height:64,width:64,borderRadius:32,backgroundColor:'#38205B',alignItems:'center',justifyContent:'center'},initial:{color:'#E1B5FF',fontSize:26,fontWeight:'700'},name:{color:'#F5F5F8',fontSize:18,fontWeight:'600'},badge:{color:'#C084FC',fontSize:10,backgroundColor:'#221237',borderRadius:12,paddingHorizontal:10,paddingVertical:5},card:{backgroundColor:'#0D1024',borderWidth:1,borderColor:'#1C2140',borderRadius:18,padding:18,gap:12},title:{color:'#fff',fontSize:17,fontWeight:'600'},note:{color:'#9999A6',fontSize:12,lineHeight:19},label:{color:'#BABAC5',fontSize:11,marginBottom:-5},input:{height:44,borderRadius:10,borderWidth:1,borderColor:'#222647',backgroundColor:'#080B20',paddingHorizontal:12,fontSize:13,color:'#fff'},password:{flexDirection:'row',alignItems:'center'},passwordInput:{flex:1,paddingRight:44},eye:{position:'absolute',right:0,width:44,height:44,alignItems:'center',justifyContent:'center'},primary:{height:44,borderRadius:12,backgroundColor:'#962AFF',alignItems:'center',justifyContent:'center',marginTop:4},primaryText:{color:'#fff',fontSize:13,fontWeight:'600'},secondary:{alignItems:'center',padding:10},buttonText:{color:'#D9D9E1',fontSize:12},signout:{color:'#F17C95',fontSize:13},error:{color:'#F48A9F',fontSize:12,lineHeight:18},disabled:{opacity:0.5}});
