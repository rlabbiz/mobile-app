// Expo's native VideoPlayer exposes writable properties for seeking and buffering.
/* eslint-disable react-hooks/immutability */
import React, { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';

export type PlayerHandle = { seekBy: (seconds: number) => number; replay: () => void };
type Props = {
  controlRef?: React.Ref<PlayerHandle>;
  url: string;
  paused: boolean;
  muted?: boolean;
  loop?: boolean;
  contentFit?: 'contain' | 'cover';
  previewSeconds?: number;
  initialPosition: () => Promise<number>;
  onLoad: () => void;
  onProgress: (event: { currentTime: number }) => void;
  onEnd: () => void;
  onError: () => void;
};

export default function ExpoPlayer(props: Props) {
  const latest = useRef(props);
  useLayoutEffect(() => { latest.current = props; }, [props]);
  const ready = useRef(false);
  const started = useRef(false);
  const sourceLoaded = useRef(false);
  const nativeReady = useRef(false);
  const initialSeek = useRef(0);
  const [loading, setLoading] = useState(true);
  const player = useVideoPlayer(null, video => {
    video.timeUpdateEventInterval = 1;
    video.staysActiveInBackground = false;
    video.bufferOptions = {
      preferredForwardBufferDuration: props.previewSeconds ? 5 : 20,
      minBufferForPlayback: 1.5,
      maxBufferBytes: (props.previewSeconds ? 8 : 24) * 1024 * 1024,
    };
  });
  useImperativeHandle(props.controlRef, () => ({ seekBy: seconds => {
    const target = Math.max(0, Math.min(Math.max(0, player.duration - 0.1), player.currentTime + seconds));
    player.currentTime = target;
    return target;
  }, replay: () => { player.currentTime = 0; } }), [player]);

  useEffect(() => {
    let cancelled = false;
    ready.current = false;
    started.current = false;
    sourceLoaded.current = false;
    nativeReady.current = false;
    void (async () => {
      const resume = await latest.current.initialPosition().catch(() => 0);
      if (cancelled) return;
      initialSeek.current = Math.max(0, Number.isFinite(resume) ? resume : 0);
      await player.replaceAsync({ uri: props.url, contentType: 'hls' });
      if (cancelled) return;
      sourceLoaded.current = true;
      // Android can resolve replaceAsync before the HLS source is prepared.
      if (nativeReady.current || player.status === 'readyToPlay') {
        player.currentTime = initialSeek.current;
        ready.current = true;
        if (!latest.current.paused) player.play();
      }
    })().catch(() => {
      if (!cancelled) latest.current.onError();
    });
    return () => { cancelled = true; ready.current = false; };
  }, [player, props.url]);

  useEffect(() => {
    if (props.paused) player.pause();
    else if (ready.current) player.play();
  }, [player, props.paused]);
  useEffect(() => {
    player.muted = props.muted ?? false;
    player.loop = props.loop ?? false;
  }, [player, props.muted, props.loop]);

  useEventListener(player, 'playingChange', event => {
    if (event.isPlaying && ready.current && !started.current && !latest.current.paused) {
      started.current = true;
      latest.current.onLoad();
    }
  });
  useEventListener(player, 'timeUpdate', event => {
    if (ready.current && player.playing && !latest.current.paused) {
      if (!started.current && event.currentTime > 0) {
        started.current = true;
        latest.current.onLoad();
      }
      if (latest.current.previewSeconds && event.currentTime >= latest.current.previewSeconds) {
        if(latest.current.loop){player.currentTime=0;player.play();return;}
        player.pause();
        latest.current.onEnd();
        return;
      }
      latest.current.onProgress({ currentTime: event.currentTime });
    }
  });
  useEventListener(player, 'playToEnd', () => {
    // Ignore end events from source replacement/initial seeking. They must
    // not put a newly opened reel into the completed/replay state.
    if (ready.current && started.current && player.duration > 0 && player.currentTime > 0 && player.currentTime >= player.duration - 1) latest.current.onEnd();
  });
  useEventListener(player, 'statusChange', event => {
    setLoading(event.status === 'loading' || event.status === 'idle');
    if (event.status === 'error') latest.current.onError();
    if (event.status === 'readyToPlay') {
      nativeReady.current = true;
      if (sourceLoaded.current && !ready.current) {
        player.currentTime = initialSeek.current;
        ready.current = true;
      }
      if (ready.current && !latest.current.paused && !player.playing) player.play();
    }
  });

  return (
    <View style={{ width: '100%', height: '100%' }}>
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      nativeControls={false}
      surfaceType="textureView"
      contentFit={props.contentFit ?? 'contain'}
    />
      {loading && !props.paused && <ActivityIndicator pointerEvents="none" color="#fff" style={{ position: 'absolute', top: '50%', alignSelf: 'center' }} />}
    </View>
  );
}
