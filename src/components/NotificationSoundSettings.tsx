import React from 'react';
import { Volume2, VolumeX, Play, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useNotificationSound, NOTIFICATION_SOUNDS, NotificationSoundType } from '@/hooks/useNotificationSound';

export const NotificationSoundSettings: React.FC = () => {
  const {
    isEnabled,
    soundType,
    volume,
    loudMode,
    toggleSound,
    setSoundType,
    setVolume,
    setLoudMode,
    testSound,
  } = useNotificationSound();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isEnabled ? (
            <Volume2 className="h-5 w-5 text-primary" />
          ) : (
            <VolumeX className="h-5 w-5 text-muted-foreground" />
          )}
          Notification Sound
        </CardTitle>
        <CardDescription>
          Configure sound effects for document completion notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="sound-enabled">Enable Sound</Label>
            <p className="text-sm text-muted-foreground">
              Play a sound when documents are completed
            </p>
          </div>
          <Switch
            id="sound-enabled"
            checked={isEnabled}
            onCheckedChange={toggleSound}
          />
        </div>

        {isEnabled && (
          <>
            {/* Loud Mode Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-accent">
              <div className="space-y-0.5">
                <Label htmlFor="loud-mode" className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Loud Mode
                </Label>
                <p className="text-sm text-muted-foreground">
                  Boost volume significantly for noisy environments
                </p>
              </div>
              <Switch
                id="loud-mode"
                checked={loudMode}
                onCheckedChange={setLoudMode}
              />
            </div>

            {/* Sound Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="sound-type">Sound Type</Label>
              <div className="flex gap-2">
                <Select
                  value={soundType}
                  onValueChange={(value) => setSoundType(value as NotificationSoundType)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a sound" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NOTIFICATION_SOUNDS).map(([key, sound]) => (
                      <SelectItem key={key} value={key}>
                        {sound.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => testSound()}
                  title="Test sound"
                >
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Volume Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sound-volume">Volume</Label>
                <span className="text-sm text-muted-foreground">
                  {Math.round(volume * 100)}%
                </span>
              </div>
              <Slider
                id="sound-volume"
                value={[volume * 100]}
                onValueChange={([value]) => setVolume(value / 100)}
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            {/* Preview All Sounds */}
            <div className="space-y-2">
              <Label>Preview Sounds</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(NOTIFICATION_SOUNDS).map(([key, sound]) => (
                  <Button
                    key={key}
                    variant="secondary"
                    size="sm"
                    onClick={() => testSound(key as NotificationSoundType)}
                    className="gap-1"
                  >
                    <Play className="h-3 w-3" />
                    {sound.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Silent Mode Warning */}
            <Alert>
              <Volume2 className="h-4 w-4" />
              <AlertTitle>Device Silent Mode</AlertTitle>
              <AlertDescription>
                Web browsers cannot play sounds when your device is in silent/vibrate mode. 
                To receive notification sounds, please disable silent mode on your device.
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>
    </Card>
  );
};
