import React from 'react';
import ReactTestRenderer,{act} from 'react-test-renderer';
import {Text,StyleSheet} from 'react-native';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {LanguageProvider} from '../src/i18n';
import {SaveButton} from '../src/api/saves';
import {SharePartButton} from '../src/sharing';
import {request} from '../src/api/client';
jest.mock('../src/api/client',()=>({request:jest.fn()}));
jest.mock('../src/api/telemetry',()=>({track:jest.fn(async()=>{})}));
jest.mock('@react-native-async-storage/async-storage',()=>({getItem:jest.fn(async()=>null),setItem:jest.fn(async()=>{})}));
jest.mock('@expo/vector-icons/Ionicons',()=>({__esModule:true,default:()=>null}));
jest.mock('expo-linear-gradient',()=>({LinearGradient:require('react-native').View}));
it.each([['en','Save','Share'],['fr','Enregistrer','Partager'],['ar','حفظ','مشاركة']])('keeps full %s action labels readable',async(language,saveLabel,shareLabel)=>{
 (request as jest.Mock).mockResolvedValue({locale:language});const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});let tree:ReactTestRenderer.ReactTestRenderer;
 try{await act(async()=>{tree=ReactTestRenderer.create(<QueryClientProvider client={client}><LanguageProvider><SaveButton rail save={{saved:false,pending:false,error:false,parts:[],toggle:()=>{}}}/><SharePartButton film={{id:'film',title:'Film'} as any} part={{id:'part',isReel:false} as any}/></LanguageProvider></QueryClientProvider>);});await act(async()=>{await new Promise<void>(r=>setTimeout(r,30));});
  for(const value of [saveLabel,shareLabel]){const label=tree!.root.findAllByType(Text).find(node=>node.props.children===value)!;expect(label).toBeDefined();expect(StyleSheet.flatten(label.props.style)).toMatchObject({width:76,textAlign:'center'});expect(label.props.numberOfLines).toBeUndefined();}
 }finally{await act(async()=>tree!.unmount());client.clear();}
});
