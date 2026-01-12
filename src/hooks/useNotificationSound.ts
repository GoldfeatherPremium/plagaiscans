import { useState, useEffect, useCallback, useRef } from 'react';

export const NOTIFICATION_SOUNDS = {
  chime: { name: 'Chime', frequencies: [880, 1100, 1320] },
  bell: { name: 'Bell', frequencies: [523, 659, 784] },
  success: { name: 'Success', frequencies: [440, 554, 659] },
  pop: { name: 'Pop', frequencies: [1000, 800, 600] },
  urgent: { name: 'Urgent', frequencies: [800, 1000, 800, 1000] },
} as const;

export type NotificationSoundType = keyof typeof NOTIFICATION_SOUNDS;

export interface NotificationSoundSettings {
  enabled: boolean;
  soundType: NotificationSoundType;
  volume: number;
  loudMode: boolean;
}

const STORAGE_KEY = 'notification-sound-settings';

const getInitialSettings = (): NotificationSoundSettings => {
  if (typeof window === 'undefined') {
    return { enabled: true, soundType: 'chime', volume: 0.8, loudMode: false };
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        enabled: parsed.enabled ?? true,
        soundType: parsed.soundType ?? 'chime',
        volume: parsed.volume ?? 0.8,
        loudMode: parsed.loudMode ?? false,
      };
    }
  } catch (e) {
    console.error('Failed to parse notification sound settings:', e);
  }
  
  return { enabled: true, soundType: 'chime', volume: 0.8, loudMode: false };
};

export const useNotificationSound = () => {
  const [settings, setSettings] = useState<NotificationSoundSettings>(getInitialSettings);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isInitializedRef = useRef(false);

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save notification sound settings:', e);
    }
  }, [settings]);

  // Initialize AudioContext (requires user interaction first)
  const initAudioContext = useCallback(async (): Promise<AudioContext | null> => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) {
          console.warn('Web Audio API not supported');
          return null;
        }
        audioContextRef.current = new AudioContextClass();
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      isInitializedRef.current = true;
      return audioContextRef.current;
    } catch (e) {
      console.error('Failed to initialize AudioContext:', e);
      return null;
    }
  }, []);

  // Generate and play a loud programmatic tone
  const playProgrammaticTone = useCallback(async (
    ctx: AudioContext,
    frequencies: readonly number[],
    volume: number,
    loudMode: boolean
  ): Promise<void> => {
    const masterGain = ctx.createGain();
    
    // Create compressor for loudMode - makes sound MUCH louder
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    if (loudMode) {
      masterGain.connect(compressor);
      compressor.connect(ctx.destination);
      // Boost volume significantly in loud mode
      masterGain.gain.value = Math.min(volume * 3, 1.5);
    } else {
      masterGain.connect(ctx.destination);
      masterGain.gain.value = volume;
    }

    const duration = 0.12;
    const now = ctx.currentTime;

    // Play each frequency in sequence with slight overlap
    frequencies.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      // Use triangle wave for clearer, more audible tone
      oscillator.type = 'triangle';
      oscillator.frequency.value = freq;
      
      // Envelope for each note
      const startTime = now + i * duration * 0.7;
      const endTime = startTime + duration;
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(loudMode ? 0.8 : 0.5, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(startTime);
      oscillator.stop(endTime + 0.05);
    });

    // Add a second layer with sine wave for richness
    frequencies.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.value = freq * 2; // Octave higher
      
      const startTime = now + i * duration * 0.7;
      const endTime = startTime + duration;
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(loudMode ? 0.4 : 0.2, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(startTime);
      oscillator.stop(endTime + 0.05);
    });
  }, []);

  // Main play function
  const playSound = useCallback(async (overrideSoundType?: NotificationSoundType): Promise<void> => {
    if (!settings.enabled) {
      console.log('[NotificationSound] Sound disabled');
      return;
    }

    const soundType = overrideSoundType || settings.soundType;
    const sound = NOTIFICATION_SOUNDS[soundType];
    
    console.log(`[NotificationSound] Playing ${soundType}, volume: ${settings.volume}, loudMode: ${settings.loudMode}`);

    try {
      const ctx = await initAudioContext();
      if (ctx) {
        await playProgrammaticTone(ctx, sound.frequencies, settings.volume, settings.loudMode);
        console.log('[NotificationSound] Played successfully via Web Audio API');
        return;
      }
    } catch (err) {
      console.warn('[NotificationSound] Web Audio failed:', err);
    }

    // Fallback: Try system beep via console
    try {
      console.log('\x07'); // ASCII bell character
    } catch {
      // Silent fail
    }
  }, [settings, initAudioContext, playProgrammaticTone]);

  // Test sound (always plays regardless of enabled state)
  const testSound = useCallback(async (overrideSoundType?: NotificationSoundType): Promise<void> => {
    const soundType = overrideSoundType || settings.soundType;
    const sound = NOTIFICATION_SOUNDS[soundType];
    
    console.log(`[NotificationSound] Testing ${soundType}`);

    try {
      const ctx = await initAudioContext();
      if (ctx) {
        await playProgrammaticTone(ctx, sound.frequencies, settings.volume, settings.loudMode);
        return;
      }
    } catch (err) {
      console.warn('[NotificationSound] Test failed:', err);
    }
  }, [settings, initAudioContext, playProgrammaticTone]);

  // Settings mutators
  const toggleSound = useCallback(() => {
    setSettings(prev => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const setSoundType = useCallback((type: NotificationSoundType) => {
    setSettings(prev => ({ ...prev, soundType: type }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setSettings(prev => ({ ...prev, volume: Math.max(0, Math.min(1, volume)) }));
  }, []);

  const setLoudMode = useCallback((enabled: boolean) => {
    setSettings(prev => ({ ...prev, loudMode: enabled }));
  }, []);

  // Initialize on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      if (!isInitializedRef.current) {
        initAudioContext();
      }
    };

    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('touchstart', handleInteraction, { once: true });
    document.addEventListener('keydown', handleInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, [initAudioContext]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    settings,
    isEnabled: settings.enabled,
    soundType: settings.soundType,
    volume: settings.volume,
    loudMode: settings.loudMode,
    playSound,
    testSound,
    toggleSound,
    setSoundType,
    setVolume,
    setLoudMode,
  };
};
