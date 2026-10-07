import {randomUUID} from 'expo-crypto';
import {request,adoptAccountSession,session,ApiError} from './client';
import type {Credentials} from './types';
export type Profile={id:string;status:'anonymous'|'linked';email:string|null;displayName:string|null;locale?:string;emailVerified:boolean;createdAt:string};
export type AccountInput={email:string;password:string;displayName?:string};
export async function changeAccount(action:'register'|'login'|'logout',input?:AccountInput):Promise<Profile>{
  try{
    const result=await request<Profile|{profile:Profile;credentials:Credentials}>(`/v1/auth/${action}`,{method:'POST',headers:{'Idempotency-Key':randomUUID()},body:JSON.stringify(input??{})});
    if('credentials' in result){await adoptAccountSession(result.credentials);return result.profile;}
    return result;
  }catch(error){
    if(error instanceof ApiError)throw error;
    // If the response was lost after commit, refresh follows the same device
    // to its new account. Never replace it with another installation identity.
    try{await session(true);const profile=await request<Profile>('/v1/profile');
      if(action==='logout'?profile.status==='anonymous':profile.status==='linked'&&profile.email===input?.email.trim().toLowerCase())return profile;
    }catch{/* Preserve the original actionable error. */}
    throw error;
  }
}
