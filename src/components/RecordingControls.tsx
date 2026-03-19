import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Download, Loader2, Save, Video } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  startRecording,
  stopRecording,
  getSavedRecordings,
  type SavedRecording,
} from '@/lib/streamingUtils';

interface RecordingControlsProps {
  isRecording: boolean;
  recordingId: string | null;
  onRecordingChange?: (recording: boolean, id: string | null) => void;
}

const RecordingControls: React.FC<RecordingControlsProps> = ({
  isRecording,
  recordingId,
  onRecordingChange,
}) => {
  const [recordingName, setRecordingName] = useState('Educational Session');
  const [autoSave, setAutoSave] = useState(true);
  const [quality, setQuality] = useState([720]);
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const { toast } = useToast();

  // Fetch library on mount and when a recording finishes
  useEffect(() => {
    loadRecordings();
  }, [isRecording]);

  const loadRecordings = async () => {
    try {
      const list = await getSavedRecordings();
      setSavedRecordings(list);
    } catch {
      // server may not be reachable
    }
  };

  const handleStartRecording = async () => {
    setIsBusy(true);
    try {
      const id = await startRecording({
        name: recordingName || `Recording ${savedRecordings.length + 1}`,
        quality: quality[0],
        autoSave,
      });
      onRecordingChange?.(true, id);
      toast({ title: 'Recording started', description: `Recording "${recordingName}"` });
    } catch (error) {
      toast({ title: 'Recording failed', description: String(error), variant: 'destructive' });
    } finally {
      setIsBusy(false);
    }
  };

  const handleStopRecording = async () => {
    if (!recordingId) return;
    setIsBusy(true);
    try {
      const result = await stopRecording(recordingId);
      onRecordingChange?.(false, null);
      toast({
        title: 'Recording saved',
        description: `Duration: ${result.duration} — Size: ${result.size}`,
      });
      await loadRecordings();
    } catch (error) {
      toast({ title: 'Stop failed', description: String(error), variant: 'destructive' });
    } finally {
      setIsBusy(false);
    }
  };

  const downloadRecording = (id: string | number) => {
    const piHost = import.meta.env.VITE_PI_HOSTNAME || 'raspberrypi.local';
    const piPort = import.meta.env.VITE_PI_CAMERA_PORT || '8080';
    window.open(`http://${piHost}:${piPort}/api/camera/recordings/${id}`, '_blank');
  };

  return (
    <div
      className={cn(
        'w-full max-w-5xl mx-auto rounded-2xl glass-panel overflow-hidden transition-opacity duration-300',
        !isRecording && 'opacity-80',
      )}
    >
      <Tabs defaultValue="settings" className="w-full">
        <div className="px-6 pt-4 border-b border-border/50">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-medium">Recording Controls</h2>
            {isRecording && (
              <div className="px-3 py-1 bg-destructive/10 text-destructive rounded-full text-sm font-medium animate-pulse">
                Recording in progress
              </div>
            )}
          </div>

          <TabsList className="grid grid-cols-2 w-[400px]">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="library">Library</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="settings" className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recording-name">Recording Name</Label>
                <Input
                  id="recording-name"
                  placeholder="Enter recording name"
                  value={recordingName}
                  onChange={(e) => setRecordingName(e.target.value)}
                  disabled={isRecording}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="auto-save">Auto Save Recordings</Label>
                <Switch id="auto-save" checked={autoSave} onCheckedChange={setAutoSave} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Recording Quality</Label>
                  <span className="text-sm">{quality[0]}p</span>
                </div>
                <Slider
                  defaultValue={quality}
                  max={1080}
                  min={360}
                  step={360}
                  onValueChange={setQuality}
                  disabled={isRecording}
                />
              </div>

              <div className="pt-4">
                {isRecording ? (
                  <Button onClick={handleStopRecording} disabled={isBusy} variant="destructive" className="w-full">
                    {isBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                    Stop & Save Recording
                  </Button>
                ) : (
                  <Button onClick={handleStartRecording} disabled={isBusy} className="w-full">
                    {isBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                    Start Recording
                  </Button>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          {savedRecordings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-4 font-medium">Name</th>
                    <th className="text-left p-4 font-medium">Date</th>
                    <th className="text-left p-4 font-medium">Duration</th>
                    <th className="text-left p-4 font-medium">Size</th>
                    <th className="text-right p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedRecordings.map((recording) => (
                    <tr
                      key={recording.id}
                      className="border-b border-border/20 hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-4 flex items-center gap-2">
                        <Video className="size-4 text-muted-foreground" />
                        {recording.name}
                      </td>
                      <td className="p-4 text-muted-foreground">{recording.date}</td>
                      <td className="p-4 text-muted-foreground">{recording.duration}</td>
                      <td className="p-4 text-muted-foreground">{recording.size}</td>
                      <td className="p-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => downloadRecording(recording.id)}>
                          <Download className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Video className="size-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No recordings found</h3>
              <p className="text-muted-foreground">Start recording to create educational content</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RecordingControls;
