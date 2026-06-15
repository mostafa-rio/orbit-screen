import { useState, useEffect, useRef } from 'react';
import { Monitor, AppWindow, Crop, Smartphone, CameraOff, Camera, MicOff, Mic, VolumeX, Volume2, Settings, X, Video } from 'lucide-react';
import './ToolDeck.css';

export default function ToolDeck() {
  const [sourceType, setSourceType] = useState<'screen' | 'window' | 'area' | 'device'>('screen');
  const [isRecording, setIsRecording] = useState(false);
  
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [screens, setScreens] = useState<any[]>([]);

  const [selectedCamera, setSelectedCamera] = useState<string>('none');
  const [selectedMic, setSelectedMic] = useState<string>('none');
  const [selectedScreen, setSelectedScreen] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const exactWidth = Math.ceil(entry.target.getBoundingClientRect().width);
        if (exactWidth > 0) {
          (window as any).ipcRenderer.send('resize-window', { width: exactWidth, height: 70 });
        }
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    async function initMedia() {
      try {
        (window as any).ipcRenderer.send('request-camera-mic');
        // Give macOS a tiny bit of time to show the dialog before we blast getUserMedia
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        // Stop the tracks immediately so we don't hold the mic and cause macOS to duck system audio
        stream.getTracks().forEach(t => t.stop());
        
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        
        setMics(audioInputs);
        setCameras(videoInputs);
        
        if (audioInputs.length > 0) setSelectedMic(audioInputs[0].deviceId);
        if (videoInputs.length > 0) setSelectedCamera(videoInputs[0].deviceId);
      } catch (err) {
        console.error("Failed to get media devices", err);
      }
    }
    initMedia();

    const handleStartRecordingIpc = async (_event: any, { screenId, micId }: any) => {
      setIsRecording(true);
      chunksRef.current = [];
      
      try {
        const screenStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: screenId,
              minFrameRate: 60,
              maxFrameRate: 60
            }
          } as any
        });

        let combinedStream = new MediaStream([...screenStream.getVideoTracks()]);

        if (micId && micId !== 'none') {
           const audioStream = await navigator.mediaDevices.getUserMedia({
             audio: { deviceId: micId ? { exact: micId } : undefined },
             video: false
           });
           audioStream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
        }

        const mediaRecorder = new MediaRecorder(combinedStream, { 
          mimeType: 'video/webm; codecs=vp9,opus',
          videoBitsPerSecond: 8000000 // 8 Mbps for high quality
        });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          (window as any).ipcRenderer.send('recording-stopped');
          const blob = new Blob(chunksRef.current, { type: 'video/webm; codecs=vp9,opus' });
          const buffer = await blob.arrayBuffer();
          (window as any).ipcRenderer.send('save-video', buffer);
          
          combinedStream.getTracks().forEach(t => t.stop());
          setIsRecording(false);
        };

        mediaRecorder.start();
        (window as any).ipcRenderer.send('recording-started');
      } catch (err) {
        console.error("Recording setup failed", err);
        setIsRecording(false);
      }
    };

    const handleForceStop = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };

    (window as any).ipcRenderer.on('start-recording', handleStartRecordingIpc);
    (window as any).ipcRenderer.on('force-stop-recording', handleForceStop);
    return () => {
      (window as any).ipcRenderer.off('start-recording', handleStartRecordingIpc);
      (window as any).ipcRenderer.off('force-stop-recording', handleForceStop);
    };
  }, []);

  useEffect(() => {
    async function fetchScreens() {
      try {
        // Fallback to 'screen' if 'area' or 'device' is selected since we don't have native implementation for those yet
        const fetchType = (sourceType === 'window') ? 'window' : 'screen';
        const response = await (window as any).ipcRenderer.invoke('get-sources', fetchType);
        const electronSources = response?.sources || [];
        setScreens(electronSources);
        if (electronSources.length > 0) {
          setSelectedScreen(electronSources[0].id);
        } else {
          setSelectedScreen('');
        }
      } catch (err) {
        console.error("Failed to get screen sources", err);
      }
    }
    fetchScreens();
  }, [sourceType]);

  useEffect(() => {
    if (selectedCamera && selectedCamera !== 'none') {
      (window as any).ipcRenderer.send('show-camera', selectedCamera);
    } else {
      (window as any).ipcRenderer.send('hide-camera');
    }
  }, [selectedCamera]);

  const toggleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      (window as any).ipcRenderer.send('stop-recording-setup');
    } else {
      if (!selectedScreen) {
        alert("Please select a screen or window to record.");
        return;
      }
      (window as any).ipcRenderer.send('start-recording-setup', {
        screenId: selectedScreen,
        micId: selectedMic
      });
    }
  };

  const closeApp = () => {
    (window as any).ipcRenderer.send('close-app');
  };

  const openSettings = () => {
    (window as any).ipcRenderer.send('open-settings');
  };

  return (
    <div className="tool-deck-container" ref={containerRef}>
      <button className="deck-btn-close" onClick={closeApp} title="Close Orbit Screen"><X size={16} /></button>
      
      <div className="deck-divider"></div>

      <div className="deck-section">
        <button className={`source-btn ${sourceType === 'screen' ? 'active' : ''}`} onClick={() => setSourceType('screen')}>
          <Monitor size={20} />
          <span>Display</span>
        </button>
        <button className={`source-btn ${sourceType === 'window' ? 'active' : ''}`} onClick={() => setSourceType('window')}>
          <AppWindow size={20} />
          <span>Window</span>
        </button>
      </div>

      <div className="deck-divider"></div>

      <div className="deck-section">
        <label className="dropdown-label">
          {selectedCamera === 'none' ? <CameraOff size={18} /> : <Camera size={18} />}
          <select className="dropdown-btn native-select" value={selectedCamera} onChange={e => setSelectedCamera(e.target.value)}>
            <option value="none">No camera</option>
            {cameras.map(c => (
              <option key={c.deviceId} value={c.deviceId}>{c.label.split(' ')[0] || 'Camera'}</option>
            ))}
          </select>
        </label>
        
        <label className="dropdown-label">
          {selectedMic === 'none' ? <MicOff size={18} /> : <Mic size={18} />}
          <select className="dropdown-btn native-select" value={selectedMic} onChange={e => setSelectedMic(e.target.value)}>
            <option value="none">No microphone</option>
            {mics.map(m => (
              <option key={m.deviceId} value={m.deviceId}>{m.label.split(' ')[0] || 'Mic'}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="deck-divider"></div>

      <button className="settings-btn" onClick={openSettings} title="Settings">
        <Settings size={20} />
      </button>

      <button className={`record-btn ${isRecording ? 'recording' : ''}`} onClick={toggleRecording}>
        <Video size={16} />
        {isRecording ? 'Stop' : 'Record'}
      </button>
    </div>
  );
}
