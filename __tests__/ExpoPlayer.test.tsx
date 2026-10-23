import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ActivityIndicator } from 'react-native';
import ExpoPlayer, { type PlayerHandle } from '../src/ExpoPlayer';

const mockPlayer = { status: 'readyToPlay', currentTime: 0, duration: 60, playing: false, muted: false, loop: false, play: jest.fn(), pause: jest.fn(), replaceAsync: jest.fn(async () => undefined) };
const mockListeners: Record<string, (event: any) => void> = {};
jest.mock('expo-video', () => ({ useVideoPlayer: () => mockPlayer, VideoView: () => null }));
jest.mock('expo', () => ({ useEventListener: (_player: unknown, name: string, listener: (event: any) => void) => { mockListeners[name] = listener; } }));
test('loops the selected trailer range without showing a replay state',async()=>{
  mockPlayer.status='readyToPlay';mockPlayer.playing=true;mockPlayer.currentTime=0;
  const props={url:'https://media.example/trailer.m3u8',paused:false,muted:true,loop:true,previewSeconds:30,initialPosition:async()=>0,onLoad:jest.fn(),onProgress:jest.fn(),onEnd:jest.fn(),onError:jest.fn()};
  let renderer:ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async()=>{renderer=ReactTestRenderer.create(<ExpoPlayer {...props}/>);});
  mockPlayer.play.mockClear();
  await ReactTestRenderer.act(async()=>mockListeners.timeUpdate({currentTime:30}));
  expect(mockPlayer.currentTime).toBe(0);expect(mockPlayer.play).toHaveBeenCalled();expect(props.onEnd).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async()=>renderer!.unmount());mockPlayer.playing=false;
});

test('autoplays after loading, retries readiness and clamps seeks to the part', async () => {
  mockPlayer.currentTime = 0;
  const controls = React.createRef<PlayerHandle>();
  const props = { controlRef: controls, url: 'https://media.example/part.m3u8', paused: false, initialPosition: async () => 12, onLoad: jest.fn(), onProgress: jest.fn(), onEnd: jest.fn(), onError: jest.fn() };
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => { renderer = ReactTestRenderer.create(<ExpoPlayer {...props} />); });
  expect(mockPlayer.currentTime).toBe(12);
  expect(mockPlayer.play).toHaveBeenCalled();
  mockPlayer.play.mockClear();
  await ReactTestRenderer.act(async () => mockListeners.statusChange({ status: 'readyToPlay' }));
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  expect(controls.current!.seekBy(5)).toBe(17);
  expect(controls.current!.seekBy(-100)).toBe(0);
  expect(controls.current!.seekBy(100)).toBeCloseTo(59.9);
  controls.current!.replay();
  expect(mockPlayer.currentTime).toBe(0);
  await ReactTestRenderer.act(async () => renderer!.update(<ExpoPlayer {...props} paused muted />));
  expect(mockPlayer.pause).toHaveBeenCalled();
  expect(mockPlayer.muted).toBe(true);
  await ReactTestRenderer.act(async () => mockListeners.statusChange({ status: 'loading' }));
  expect(renderer!.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  mockPlayer.play.mockClear();
  await ReactTestRenderer.act(async () => mockListeners.statusChange({ status: 'readyToPlay' }));
  expect(mockPlayer.play).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('waits for native readiness and ignores premature completion when a part opens', async () => {
  mockPlayer.status = 'loading';
  mockPlayer.currentTime = 0;
  mockPlayer.play.mockClear();
  const props = { url: 'https://media.example/new-part.m3u8', paused: false, initialPosition: async () => 0, onLoad: jest.fn(), onProgress: jest.fn(), onEnd: jest.fn(), onError: jest.fn() };
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => { renderer = ReactTestRenderer.create(<ExpoPlayer {...props} />); });
  await ReactTestRenderer.act(async () => mockListeners.playToEnd({}));
  expect(props.onEnd).not.toHaveBeenCalled();
  expect(mockPlayer.play).not.toHaveBeenCalled();
  mockPlayer.status = 'readyToPlay';
  await ReactTestRenderer.act(async () => mockListeners.statusChange({ status: 'readyToPlay' }));
  expect(mockPlayer.currentTime).toBe(0);
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(async () => { mockListeners.playingChange({ isPlaying: true }); mockListeners.playToEnd({}); });
  expect(props.onLoad).toHaveBeenCalledTimes(1);
  expect(props.onEnd).not.toHaveBeenCalled();
  mockPlayer.currentTime = 60;
  await ReactTestRenderer.act(async () => mockListeners.playToEnd({}));
  expect(props.onEnd).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('reports source and selected-track dimensions for the uncropped video frame',async()=>{
 const onVideoSize=jest.fn();const props={url:'https://media.example/sized.m3u8',paused:false,initialPosition:async()=>0,onLoad:jest.fn(),onProgress:jest.fn(),onEnd:jest.fn(),onError:jest.fn(),onVideoSize};let renderer:ReactTestRenderer.ReactTestRenderer;
 await ReactTestRenderer.act(async()=>{renderer=ReactTestRenderer.create(<ExpoPlayer {...props}/>);});
 await ReactTestRenderer.act(async()=>mockListeners.sourceLoad({availableVideoTracks:[{size:{width:1920,height:1032}}]}));
 expect(onVideoSize).toHaveBeenLastCalledWith({width:1920,height:1032});
 await ReactTestRenderer.act(async()=>mockListeners.videoTrackChange({videoTrack:{size:{width:1080,height:1920}}}));
 expect(onVideoSize).toHaveBeenLastCalledWith({width:1080,height:1920});
 await ReactTestRenderer.act(async()=>mockListeners.videoTrackChange({videoTrack:null}));expect(onVideoSize).toHaveBeenCalledTimes(2);
 await ReactTestRenderer.act(async()=>renderer!.unmount());
});
