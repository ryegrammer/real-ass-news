
import React, { useState } from 'react';
import StreamingSection from '@/components/StreamingSection';
import RecordingControls from '@/components/RecordingControls';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Book, Video } from 'lucide-react';
import { Link } from 'react-router-dom';

const Index = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);

  const handleRecordingChange = (recording: boolean, id?: string | null) => {
    setIsRecording(recording);
    setRecordingId(id ?? null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-primary/10 text-primary text-sm font-medium animate-fade-in">
            Educational Content Creation
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight animate-slide-in">
            Stream and Record with <br className="hidden sm:block" />
            <span className="text-primary">Raspberry Pi 5</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 animate-slide-in" style={{ animationDelay: '100ms' }}>
            Create high-quality educational content and stories with your Raspberry Pi 5.
            Stream, record, and build your educational library.
          </p>
          <div className="flex flex-wrap justify-center gap-4 animate-slide-in" style={{ animationDelay: '200ms' }}>
            <Button size="lg" asChild>
              <a href="#streaming-section">
                Start Streaming
              </a>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/suggestions">
                Development Ideas
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Streaming Section */}
      <section id="streaming-section" className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <StreamingSection onRecordingChange={handleRecordingChange} />
          
          <div className="mt-8">
            <RecordingControls isRecording={isRecording} />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Key Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to create professional educational content with your Raspberry Pi 5
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-background/80 backdrop-blur-sm border-border/50">
              <CardContent className="p-6">
                <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Video className="size-6 text-primary" />
                </div>
                <h3 className="text-xl font-medium mb-2">Live Streaming</h3>
                <p className="text-muted-foreground">
                  Stream directly from your Raspberry Pi 5 camera with low latency and high quality.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-background/80 backdrop-blur-sm border-border/50">
              <CardContent className="p-6">
                <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Book className="size-6 text-primary" />
                </div>
                <h3 className="text-xl font-medium mb-2">Educational Content</h3>
                <p className="text-muted-foreground">
                  Create and organize educational content and stories for your audience.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-background/80 backdrop-blur-sm border-border/50">
              <CardContent className="p-6">
                <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <ArrowRight className="size-6 text-primary" />
                </div>
                <h3 className="text-xl font-medium mb-2">Easy Integration</h3>
                <p className="text-muted-foreground">
                  Simple setup process to connect your Raspberry Pi 5 camera to the platform.
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div className="mt-12 text-center">
            <Link to="/suggestions">
              <Button variant="outline">
                View Development Suggestions <ArrowRight className="ml-2 size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
