import React,{createContext,useContext,useEffect,useState} from 'react';
import {View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useQuery} from '@tanstack/react-query';
import {request} from './api/client';
import type {Profile} from './api/profile';
export type Language='en'|'fr'|'ar';
const translations:Record<string,[string,string]>={
 'Popular':['Populaires','الرائجة'],'Famous':['Célèbres','المشهورة'],'New':['Nouveautés','الجديدة'],'Categories':['Catégories','الفئات'],'Continue watching':['Continuer à regarder','تابع المشاهدة'],'LAST WATCHED':['DERNIER FILM VU','آخر ما شاهدته'],'More stories':['Plus d’histoires','المزيد من القصص'],
 'Save an episode to watch it again here.':['Enregistrez un épisode pour le revoir ici.','احفظ جزءًا لتشاهده مجددًا هنا.'],
 'Films':['Films','الأفلام'],'No saved episodes yet':['Aucun épisode enregistré','لا توجد أجزاء محفوظة'],'Save a film to find it here.':['Enregistrez un film pour le retrouver ici.','احفظ فيلمًا لتجده هنا.'],
 'SHORT STORIES. BIG FEELINGS.':['PETITES HISTOIRES. GRANDES ÉMOTIONS.','قصص قصيرة. مشاعر كبيرة.'],'Part':['Épisode','الجزء'],'Reel':['Reel','ريل'],'Watched':['Vu','تمت المشاهدة'],'watched':['vus','شاهدتها'],
 'Find your next story':['Trouvez votre prochaine histoire','اكتشف قصتك التالية'],'No saved stories yet':['Aucune histoire enregistrée','لا توجد قصص محفوظة بعد'],
 'Save a film or part to find it here.':['Enregistrez un film ou un épisode pour le retrouver ici.','احفظ فيلمًا أو جزءًا لتجده هنا.'],'Try a different title or category.':['Essayez un autre titre ou une autre catégorie.','جرّب عنوانًا أو فئة أخرى.'],
 'Published films will appear here. Pull down to refresh.':['Les films publiés apparaîtront ici. Tirez pour actualiser.','ستظهر الأفلام المنشورة هنا. اسحب لأسفل للتحديث.'],
 'Start watching':['Commencer','ابدأ المشاهدة'],'PARTS':['ÉPISODES','أجزاء'],'Retry':['Réessayer','حاول مجددًا'],'views':['vues','مشاهدة'],
 'Home':['Accueil','الرئيسية'],'Reels':['Reels','ريلز'],'Saved':['Enregistrés','المحفوظات'],'Profile':['Profil','الملف الشخصي'],
 'Language':['Langue','اللغة'],'For you':['Pour vous','لك'],'Films & parts':['Films et épisodes','الأفلام والأجزاء'],'Explore':['Découvrir','اكتشف الفيلم'],
 'Search films':['Rechercher des films','ابحث عن الأفلام'],'All':['Tout','الكل'],'Episodes':['Épisodes','الأجزاء'],'Play film':['Voir le film','شغّل الفيلم'],'Try again':['Réessayer','حاول مجددًا'],
 'No films yet':['Aucun film pour le moment','لا توجد أفلام بعد'],'No saved films yet':['Aucun film enregistré','لا توجد أفلام محفوظة'],'No reels yet':['Aucun reel pour le moment','لا توجد ريلز بعد'],'No saved reels yet':['Aucun reel enregistré','لا توجد ريلز محفوظة'],
 'Create account':['Créer un compte','إنشاء حساب'],'Sign in':['Se connecter','تسجيل الدخول'],'Sign out':['Se déconnecter','تسجيل الخروج'],'Save profile':['Enregistrer','حفظ الملف الشخصي'],
 'Name':['Nom','الاسم'],'Email':['E-mail','البريد الإلكتروني'],'Password':['Mot de passe','كلمة المرور'],'Your name':['Votre nom','اسمك'],'Your password':['Votre mot de passe','كلمة المرور'],
 'Watching as a guest':['Vous regardez en tant qu’invité','تشاهد كضيف'],'Your account':['Votre compte','حسابك'],'Your viewing history stays with you.':['Votre historique reste avec vous.','سجل المشاهدة يبقى معك.'],'Guest session':['Session invitée','جلسة ضيف'],'Koreva account':['Compte Koreva','حساب كوريفا'],
 'Take Koreva with you':['Emportez Koreva avec vous','خذ كوريفا معك'],'Create your account':['Créez votre compte','أنشئ حسابك'],'Welcome back':['Bon retour','مرحبًا بعودتك'],'Your details':['Vos informations','معلوماتك'],
 'Create an account to keep your loves, saved films, reels, and watch progress across devices.':['Créez un compte pour retrouver vos favoris, films, reels et progression sur tous vos appareils.','أنشئ حسابًا للحفاظ على الإعجابات والمحفوظات وتقدم المشاهدة عبر أجهزتك.'],
 'Already have an account? Sign in':['Déjà un compte ? Connectez-vous','لديك حساب؟ سجّل الدخول'],'New here? Create an account':['Nouveau ? Créez un compte','مستخدم جديد؟ أنشئ حسابًا'],'Continue as guest':['Continuer comme invité','المتابعة كضيف'],
 'At least 12 characters':['Au moins 12 caractères','12 حرفًا على الأقل'],'Your current session becomes this account. Nothing is reset.':['Votre session actuelle devient ce compte. Tout est conservé.','ستتحول جلستك الحالية إلى حساب. لن تفقد أي شيء.'],
 'Your guest saves, loves, and watch history will join this account.':['Vos favoris et votre historique invité seront ajoutés à ce compte.','ستُنقل محفوظاتك وإعجاباتك وسجل مشاهدتك كضيف إلى هذا الحساب.'],
 'Enter your name.':['Saisissez votre nom.','أدخل اسمك.'],'Enter a valid email address.':['Saisissez une adresse e-mail valide.','أدخل بريدًا إلكترونيًا صالحًا.'],'Use a password with at least 12 characters.':['Utilisez au moins 12 caractères.','استخدم كلمة مرور من 12 حرفًا على الأقل.'],
 'Sign out?':['Se déconnecter ?','تسجيل الخروج؟'],'Cancel':['Annuler','إلغاء'],'Your account’s saves and history stay safe. This phone will continue as a guest.':['Vos favoris et votre historique sont conservés. Ce téléphone continuera en tant qu’invité.','محفوظات حسابك وسجل المشاهدة سيبقيان آمنين. سيواصل هذا الهاتف كضيف.'],
 'Unable to load your profile. Tap to retry.':['Impossible de charger le profil. Touchez pour réessayer.','تعذّر تحميل ملفك الشخصي. اضغط للمحاولة مجددًا.'],
 'Unable to load reels. Tap to retry.':['Impossible de charger les reels. Touchez pour réessayer.','تعذّر تحميل الريلز. اضغط للمحاولة مجددًا.'],
 'Save a reel to watch it again here.':['Enregistrez un reel pour le retrouver ici.','احفظ ريلًا لمشاهدته هنا مجددًا.'],'New clips appear here when films have published discovery reels.':['De nouveaux clips apparaîtront ici dès leur publication.','ستظهر المقاطع الجديدة هنا بعد نشرها.'],
 'You’re caught up · Discover more':['Vous êtes à jour · Découvrir plus','شاهدت كل المقاطع · اكتشف المزيد'],'Watch again':['Revoir','شاهد مجددًا'],'Part finished':['Épisode terminé','انتهى الجزء'],'Muted':['Muet','مكتوم'],'Sound':['Son','الصوت'],
 'Save':['Enregistrer','حفظ'],'Loved':['Aimé','أعجبك'],'Love':['J’aime','إعجاب'],'Saved films':['Films enregistrés','الأفلام المحفوظة'],'parts watched':['Épisodes vus','أجزاء شاهدتها'],
};
const translate=(language:Language,key:string)=>language==='en'?key:translations[key]?.[language==='fr'?0:1]??key;
const Context=createContext({language:'en' as Language,t:(key:string)=>key,setLanguage:async(_language:Language)=>{}});
export const useLanguage=()=>useContext(Context);
export function LanguageProvider({children}:{children:React.ReactNode}){
  const [local,setLocal]=useState<Language>('en');
  const profile=useQuery({queryKey:['profile'],queryFn:()=>request<Profile>('/v1/profile'),staleTime:30000});
  useEffect(()=>{void AsyncStorage.getItem('koreva:language').then(value=>{if(value==='en'||value==='fr'||value==='ar')setLocal(value);});},[]);
  const selected=profile.data?.locale;
  const language:Language=selected==='en'||selected==='fr'||selected==='ar'?selected:local;
  useEffect(()=>{void AsyncStorage.setItem('koreva:language',language);},[language]);
  return <Context.Provider value={{language,t:key=>translate(language,key),setLanguage:async value=>{setLocal(value);await AsyncStorage.setItem('koreva:language',value);}}}><View style={{flex:1,direction:language==='ar'?'rtl':'ltr'}}>{children}</View></Context.Provider>;
}
