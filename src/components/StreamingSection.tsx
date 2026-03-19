import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Settings, Video, VideoOff, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  initPiCamera,
  startPiCameraStream,
  stopPiCameraStream,
  getCameraStatus,
  type StreamQuality,
} from '@/lib/piCameraUtils';

interface StreamingSectionProps {
  onRecordingChange?: (isRecording: boolean) => void;
}

const StreamingSection: React.FC<StreamingSectionProps> = ({ onRecordingChange }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [streamQuality, setStreamQuality] = useState<StreamQuality>('auto');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [piReachable, setPiReachable] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // On mount, probe the Pi server health
  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const ok = await initPiCamera();
      if (!cancelled) setPiReachable(ok);
    };
    probe();
    return () => { cancelled = true; };
  }, []);

  const toggleStream = async () => {
    if (isStreaming) {
      // ---- Stop ----
      setIsLoading(true);
      try {
        await stopPiCameraStream();
        setConnectionStatus('disconnected');
        setIsStreaming(false);

        if (isRecording) {
          setIsRecording(false);
          onRecordingChange?.(false);
          toast({ title: 'Recording stopped', description: 'Your recording has been saved.' });
        }
      } catch (error) {
        console.error('Disconnect failed:', error);
        toast({ title: 'Disconnect error', description: String(error), variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    } else {
      // ---- Start ----
      if (!videoRef.current) return;
      setIsLoading(true);
      setConnectionStatus('connecting');

      try {
        await startPiCameraStream(videoRef.current, streamQuality);
        setConnectionStatus('connected');
        setIsStreaming(true);
        toast({ title: 'Pi Camera connected', description: `Streaming at ${streamQuality} quality.` });
      } catch (error) {
        console.error('Connect failed:', error);
        setConnectionStatus('error');
        toast({
          title: 'Connection failed',
          description: 'Could not connect to the Pi camera server. Is it running?',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const toggleRecording = () => {
    if (!isStreaming) return;
    setIsRecording(!isRecording);
    onRecordingChange?.(!isRecording);
    toast({
      title: isRecording ? 'Recording stopped' : 'Recording started',
      description: isRecording ? 'Your recording has been saved.' : 'Recording from Pi camera stream.',
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPiCameraStream().catch(() => {});
    };
  }, []);

  const piHost = getCameraStatus().piHost;

  return (
    <div className="w-full max-w-5xl mx-auto rounded-2xl glass-panel overflow-hidden">
      {/* Video Stream Container */}
      <div className="aspect-video bg-black/90 w-full relative">
        {/* Always render the video element so JMuxer can attach */}
        <video
          ref={videoRef}
          className={cn('w-full h-full object-cover', !isStreaming && 'hidden')}
          muted
          playsInline
          autoPlay
          controls
        />

        {!isStreaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-4">
            <VideoOff className="size-16 mb-2 text-white/50" />
            <h3 className="text-xl font-medium">Stream Disconnected</h3>
            <p className="text-white/70 max-w-md text-center">
              Connect to your Raspberry Pi 5 to start streaming and recording educational content.
            </p>

            {/* Pi reachability indicator */}
            <div className="flex items-center gap-2 text-sm text-white/60">
              {piReachable === null ? (
                'Checking Pi…'
              ) : piReachable ? (
                <><Wifi className="size-4 text-green-400" /> Pi server reachable at {piHost}</>
              ) : (
                <><WifiOff className="size-4 text-red-400" /> Pi server unreachable ({piHost})</>
              )}
            </div>

            <Button
              className="mt-4 font-medium"
              onClick={toggleStream}
              disabled={isLoading}
            >
              {isLoading ? 'Connecting…' : 'Connect to Pi'}
            </Button>
          </div>
        )}

        {/* Recording indicator */}
        {isStreaming && isRecording && (
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-destructive/90 text-destructive-foreground rounded-full text-sm animate-pulse-subtle">
            <div className="size-2 rounded-full bg-destructive-foreground" />
            Recording
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={!isStreaming || isLoading}
            onClick={toggleRecording}
            className={cn('transition-all', isRecording && 'text-destructive border-destructive/30')}
          >
            {isRecording ? <Pause className="size-5" /> : <Play className="size-5" />}
          </Button>

          <div className="flex flex-col">
            <h3 className="font-medium">Raspberry Pi Stream</h3>
            <p className="text-xs text-muted-foreground">
              {connectionStatus === 'connected'
                ? `Connected (${streamQuality})`
                : connectionStatus === 'connecting'
                  ? 'Connecting…'
                  : connectionStatus === 'error'
                    ? 'Connection failed'
                    : 'Disconnected'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            className="px-3 py-2 rounded-md text-sm bg-background border border-border"
            value={streamQuality}
            onChange={(e) => setStreamQuality(e.target.value as StreamQuality)}
            disabled={isStreaming || isLoading}
          >
            <option value="auto">Auto Quality</option>
            <option value="high">High (1080p)</option>
            <option value="medium">Medium (720p)</option>
            <option value="low">Low (480p)</option>
          </select>

          <Button
            variant={isStreaming ? 'destructive' : 'default'}
            onClick={toggleStream}
            disabled={isLoading}
            className="font-medium"
          >
            {isLoading ? 'Processing…' : isStreaming ? 'Disconnect' : 'Connect'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StreamingSection;
