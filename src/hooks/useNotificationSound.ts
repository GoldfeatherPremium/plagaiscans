import { useState, useEffect, useCallback, useRef } from 'react';

// Base64 encoded notification sounds for reliability (no external files needed)
// These are short, pleasant notification tones
const SOUND_DATA = {
  chime: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkpKGc2BcYnF/hoyKg3ZpYmRyfYaMi4Z7cWplbnmEjIyIgHRsaW98hIyMiYF2b2xwfYWMjImBdnBtcn+GjIyJgXZwbnOAh4yMiYF2cG5zgYiMjImBdnBuc4GIjIyJgXZwbnOBiIyMiYF2cG5zgYiMjImBdnBuc4GIjIyJgXZwbnOBiIyMiYF2cG5zgYiMjImBdnBuc4GIjIyJgXZwbnOBiIyMiYF2cG5zgYiMjImBdnBuc4GIjIyJgXZwbnOBiIyMiYF2cG5zgYiMjImBdnBuc4GIjIyJgXZwbnOBiIyMiYF2cG5zgYiMjIl/dG9ucYCGi4uIgHVvbXGAhouLh39zcGtwgIaLi4d/c3BrcIGGi4uGfnNva3CBhouLhn5zcGtxgYaLi4Z+c3BrcYGGi4uGfnNwa3GBhouLhn5zcGtxgYaLi4Z+c3BrcYGGi4uGfnNwa3GBhouLhn5zcGtxgYaLi4Z+c3BrcYGGi4uGfnNwa3GBhouLhn5zcGtxgYaLi4Z+c3BrcYGGi4uGfnNwa3GBhouLhn5zcGtxgYaLi4Z+c3BrcYGGi4uGfnNwa3GAhouLh39zcGtwgIaLi4d/c3BrcICGi4uHf3Nwa3CAhouLh39zcGtwgIaLi4d/c3BrcICGi4uHf3Nwa3CAhouLh39zcGtwgIaLi4d/c3BrcICGi4uHf3Nwa3CAhouLh39zcGtwgIaLi4d/c3BrcICGi4uHf3Nwa3CAhouLh39zcGtwgIaLi4d/c3BrcICGi4uHf3Nwa3CAhouLh39zcGtwgIaLi4d/c3BrcICGi4uHf3Nwa3CAhouLh39zcGtwgIaLi4d/c3BrcICGi4uHf3NwanCAhouLh39zcGpwgIaLi4d/cnBqcICGi4uGfnJvan+GiouFfXFuaX6FiYmEe29sZ3yDh4aBd2xpY3qAhIF8c2hkYHd9gHx3bmZiXXR5fHdybGRfW3F2eHRvamJeW292dnJtaGFdW212dHBsZmBcW2x0c29rZWBcW2xzcm5qZF9bW2tzc25qZF9bW2tzcm5qZF9bW2tycm5qZF9bW2tycm5qZF9bW2tycm5qZF9bW2tycm5qZF9bW2tycm5qZF9bW2tycm5qZF9bW2tycm5qZF9bW2tycm1pZF5bWmtycW1pZF5bWmtxcW1pY15bWmtxcGxoY15aWmpwcGxoY11aWmpwcGxoY11aWmpwcGxoY11aWmpwb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvb2tnYl1ZWWlvbw==',
  bell: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAAB+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg39+goaGg38=',
  success: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAABVYnB+i5aepqyvsK6qpJuRhHZoW1BHTkZBPjw8PT9ESU9XXmZvd4CIj5acoaWoqquppaGbkoh+c2heVU1GPz04NTQ1ODxCS1RdZ3B6g4yTmqCkqKqrqqilnpiPhH12bWVcVE1FPzo3NDMyNDc7QEhQWWJsdX6HkJadoaWoqqurqaWhnpaLgXhwZ19XUEhBOzc0MjEyNDg8QklSW2Vvd4GKkZifpKiqq6yppaGclIqAd29nX1dQSEE7NjMxMDE0Nz1ESVJbZW93gYqRmaCkqautrKilnpeNgnh ubWVdVU1GQDs3NDIxMjQ4PUNKUlplb3iBipKaoKarraypp6OblI2Ed29nX1dQSUA7NzQyMTE0Nz1ES1Rdan6Hj5ifoqWnqKmnpaKclIuCeHBnX1dPR0E8ODU0MjM2OT5FTVZfaXN9hpCYn6OmqampqKajnpWMgnlwa2NbU0xEPjo2MzEyNTo/R09Yame2hI2VnKGmqaqqqqejnpiPhn10a2NbUktEPTk2MzIyNDg9RExUXGVweoONlJyho6epqqmnpJ+YkIeDenJqYlpRSkM9ODU0MjI0OD1ETFRcZnB6hI2UnKGlqKmqp6WgnZaOhXt0bGRcVE5HQDo3NTMyNDg8Q0tSW2Vvd4KLkpmfoqanqKeloZ2Wj4Z9dW1lXldPSEE8ODYzMjM1OD5ES1NcZW94goqSmaChpaeop6Whn5mRiIF4cGhgWFBJQj03NTMxMjU4PUNKUV9obHWAiZCXnqKlqKiop6SgmpOKgXlxaWFeV1BMRT86NzQyMjQ4PEJJU1xmb3iCi5OZn6OmqKiopaKemJGIf3ZuZl5WT0hBOzg1MzIyNTk9Q0pSW2Rxe4SLk5mfoqWnqainpKCbk4uCeXFpYllSTEU/OjY0MjIzNjpARk1WWF9ob3eAh4+WnaKkpqenpqSgnZiSioF5cWphWlRNRj87ODUzMzU4PEFHTldgaXR9hY2UnqKlp6enpaOgnpqUjoaDfndza2tjXVZPSUQ/OzY0MzQ2Oj5ETFRcZHB6goqSmJ6ho6WlpaOgnZiSjId+d3BpYlpUTUdAOzg1MzM1OD1CS1NbZHB6hIyTmJ6ho6SlpKKfnJiTjol/e3ZvamRdV1FNRT88NzUzMzU5PUNKUVplcXyFjZSanqGjo6KhoJ2ZlpGKhX54cmxlX1dSTEdBOzc1MzM2OT1DSVJaY29/iI+VnJ+hn5+en5ublZCKhH94cmtnYFpTTUdBOzc1MzM2OT1CSlFbY29+h4+Wm56fnp2cnJqXko2Gf3hya2RfWFNNRkA6NzQyMzU4PEJIUFhhaHN8hY2Sl5udnp2cnJmWkIqCe3VvaGJcVU9IRD86NzQzMzY5PUJIU1xkcH2HjpWanZ6dn5ycmpaSi4V+d3FqZFxVT0lDPTo2NDIzNjk9Q0lSWmJufYaNk5mdnp+enZuZlpGLhH14cm5oYltVT0dBPDg1MzM1OTxBS1NbY255hIyTmJyfn56dnZqWkYyFf3h0bmdhWlROSEI8ODUzMzU5PERJUV9ocHuFjZKXm52dnZuZl5ORjIZ/eHNtZ2BaU0xHQTs3NDMzNjg8QUhQWGNufYaOlJmcnZ6dnJqXlJCKhH55c2xmX1lSS0ZAPDc1MzMzNjpARk1WXGZ1f4iPlJidnp6dnJqYlJCKhH54c2xlX1lTTEZAPDc1MzMyNjg8QUdPV2BreYOLkpicnp6dnJqYlI+JhH54cm1lXldRSkRAPDc1MzMzNjpARk5VXWZygomPlZqdnZ2cm5mVkY2Hgnt1b2hhWlRPSUM+OjY0MzI1OD1DS1NcZXJ/iI+Wmp2enZuZmJWQi4V/eXNtZ2BZU01HQTs3NDMyNTg8QUhQWGNufYWMkpidnp6cm5mWkouEfnlzbGVfWFFLRT86NjQyMjQ3Oz9GTFRdZ3iChIuRlpmanJyampiVkYyGgHp1b2piXFVPSUQ/OjY0MjM1OD1DSVFaZHB8hIySlpqcnJybmZaSkYyHgXx3cW1nYVtVTklDPjo2NDIzNDc6QEdPWGJueYOJj5WZnJybm5mYlZKOiIOAfHVxbGZgWlROSUM+OTY0MjI1ODxBRk1VX2l0fYWMkpibnJ2cm5mWko6Jg355dHBqZF5XUktFQDw3NTMyNTg8QEdOV2Fsdn+Gjo==',
  pop: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA=',
} as const;

export const NOTIFICATION_SOUNDS = {
  chime: {
    name: 'Chime',
    data: SOUND_DATA.chime,
  },
  bell: {
    name: 'Bell',
    data: SOUND_DATA.bell,
  },
  success: {
    name: 'Success',
    data: SOUND_DATA.success,
  },
  pop: {
    name: 'Pop',
    data: SOUND_DATA.pop,
  },
} as const;

export type NotificationSoundType = keyof typeof NOTIFICATION_SOUNDS;

interface NotificationSoundSettings {
  enabled: boolean;
  soundType: NotificationSoundType;
  volume: number;
}

const DEFAULT_SETTINGS: NotificationSoundSettings = {
  enabled: true,
  soundType: 'chime',
  volume: 0.7,
};

const STORAGE_KEY = 'notificationSoundSettings';

export const useNotificationSound = () => {
  const [settings, setSettings] = useState<NotificationSoundSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Web Audio API for more aggressive sound playback (can bypass silent mode)
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Initialize AudioContext on user interaction
  const initAudioContext = useCallback(async () => {
    if (typeof window === 'undefined') return null;
    
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }
      
      // Resume if suspended (required after user interaction)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      return audioContextRef.current;
    } catch (err) {
      console.log('[NotificationSound] Could not initialize AudioContext:', err);
      return null;
    }
  }, []);

  // Convert base64 to ArrayBuffer
  const base64ToArrayBuffer = useCallback((base64: string): ArrayBuffer => {
    // Remove data URL prefix if present
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }, []);

  const playSound = useCallback(async (overrideSoundType?: NotificationSoundType) => {
    if (!settings.enabled) return;

    const soundType = overrideSoundType || settings.soundType;
    const sound = NOTIFICATION_SOUNDS[soundType];
    
    try {
      const ctx = await initAudioContext();
      if (!ctx) {
        // Fallback to HTML5 Audio if Web Audio API fails
        const audio = new Audio(sound.data);
        audio.volume = settings.volume;
        await audio.play();
        return;
      }
      
      // Get or decode audio buffer
      let buffer = audioBuffersRef.current.get(soundType);
      if (!buffer) {
        try {
          const arrayBuffer = base64ToArrayBuffer(sound.data);
          buffer = await ctx.decodeAudioData(arrayBuffer);
          audioBuffersRef.current.set(soundType, buffer);
        } catch {
          // Fallback to HTML5 Audio
          const audio = new Audio(sound.data);
          audio.volume = settings.volume;
          await audio.play();
          return;
        }
      }
      
      // Create and play source with gain control
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      
      source.buffer = buffer;
      gainNode.gain.value = settings.volume;
      
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
    } catch (err) {
      console.log('[NotificationSound] Could not play sound:', err);
      
      // Final fallback - try basic audio
      try {
        const audio = new Audio(sound.data);
        audio.volume = settings.volume;
        await audio.play();
      } catch {
        // Silent fail
      }
    }
  }, [settings.enabled, settings.soundType, settings.volume, initAudioContext, base64ToArrayBuffer]);

  const toggleSound = useCallback(() => {
    setSettings(prev => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const setSoundType = useCallback((soundType: NotificationSoundType) => {
    setSettings(prev => ({ ...prev, soundType }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setSettings(prev => ({ ...prev, volume: Math.max(0, Math.min(1, volume)) }));
  }, []);

  const testSound = useCallback(async (soundType?: NotificationSoundType) => {
    const type = soundType || settings.soundType;
    
    // Initialize context if needed (requires user interaction)
    await initAudioContext();
    
    // Force play the sound
    const sound = NOTIFICATION_SOUNDS[type];
    try {
      const ctx = audioContextRef.current;
      if (ctx && ctx.state !== 'closed') {
        let buffer = audioBuffersRef.current.get(type);
        if (!buffer) {
          const arrayBuffer = base64ToArrayBuffer(sound.data);
          buffer = await ctx.decodeAudioData(arrayBuffer);
          audioBuffersRef.current.set(type, buffer);
        }
        
        const source = ctx.createBufferSource();
        const gainNode = ctx.createGain();
        
        source.buffer = buffer;
        gainNode.gain.value = settings.volume;
        
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
      } else {
        const audio = new Audio(sound.data);
        audio.volume = settings.volume;
        await audio.play();
      }
    } catch {
      // Fallback
      const audio = new Audio(sound.data);
      audio.volume = settings.volume;
      await audio.play();
    }
  }, [settings.soundType, settings.volume, initAudioContext, base64ToArrayBuffer]);

  return {
    settings,
    playSound,
    toggleSound,
    setSoundType,
    setVolume,
    testSound,
    isEnabled: settings.enabled,
    soundType: settings.soundType,
    volume: settings.volume,
    initAudioContext, // Expose for user interaction initialization
  };
};
