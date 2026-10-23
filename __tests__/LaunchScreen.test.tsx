import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text} from 'react-native';
import {LaunchBoundary} from '../src/LaunchScreen';
import {Asset} from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';

jest.mock('../src/i18n',()=>({useLanguage:()=>({t:(key:string)=>key})}));
jest.mock('expo-asset',()=>({Asset:{loadAsync:jest.fn()}}));
jest.mock('expo-splash-screen',()=>({preventAutoHideAsync:jest.fn(async()=>undefined),hideAsync:jest.fn(async()=>undefined)}));
jest.mock('expo-linear-gradient',()=>({LinearGradient:require('react-native').View}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:require('react-native').View}));

test('launch waits for image decode before native handoff and cannot get stuck on asset failure',async()=>{
 jest.useFakeTimers();
 (SplashScreen.hideAsync as jest.Mock).mockClear();
 let settle!:(value:unknown)=>void;
 (Asset.loadAsync as jest.Mock).mockImplementation(()=>new Promise(resolve=>{settle=resolve;}));
 let renderer!:ReactTestRenderer.ReactTestRenderer;
 try {
  await ReactTestRenderer.act(async()=>{renderer=ReactTestRenderer.create(<LaunchBoundary><Text>Catalogue</Text></LaunchBoundary>);});
  expect(renderer.root.findAll(n=>n.props.testID==='koreva-launch-screen').length).toBeGreaterThan(0);
  await ReactTestRenderer.act(async()=>{settle([]);});
  expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async()=>{renderer.root.findAll(n=>n.props.testID==='launch-artwork'&&typeof n.props.onLoadEnd==='function')[0].props.onLoadEnd();});
  expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(async()=>{jest.advanceTimersByTime(1000);});
  expect(renderer.root.findAll(n=>n.props.testID==='koreva-launch-screen')).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).toContain('Catalogue');
  await ReactTestRenderer.act(async()=>renderer.unmount());
  (Asset.loadAsync as jest.Mock).mockRejectedValue(new Error('Local asset could not be decoded'));
  await ReactTestRenderer.act(async()=>{renderer=ReactTestRenderer.create(<LaunchBoundary><Text>Offline catalogue</Text></LaunchBoundary>);});
  await ReactTestRenderer.act(async()=>{jest.advanceTimersByTime(5000);});
  await ReactTestRenderer.act(async()=>{jest.advanceTimersByTime(1000);});
  expect(renderer.root.findAll(n=>n.props.testID==='koreva-launch-screen')).toHaveLength(0);
 } finally {await ReactTestRenderer.act(async()=>renderer.unmount());jest.useRealTimers();}
});
