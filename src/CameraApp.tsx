import { useEffect, useRef, useState } from 'react';
import './Camera.css';

export default function CameraApp() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shapeClass, setShapeClass] = useState('shape-circle');
  const [borderEnabled, setBorderEnabled] = useState(true);
  const [borderColor, setBorderColor] = useState('#ffffff');
  const [cameraRadius, setCameraRadius] = useState(24);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cameraId = params.get('cameraId');
    const shape = params.get('shape') || 'circle';
    const initBorderEnabled = params.get('borderEnabled') !== 'false';
    const initBorderColor = params.get('borderColor') || '#ffffff';
    const initRadius = parseInt(params.get('radius') || '24');
    
    setShapeClass(`shape-${shape}`);
    setBorderEnabled(initBorderEnabled);
    setBorderColor(initBorderColor);
    setCameraRadius(initRadius);

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: cameraId ? { exact: cameraId } : undefined,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera", err);
      }
    }

    initCamera();

    const handleShapeUpdate = (_event: any, newShape: string, newRadius?: number) => {
      setShapeClass(`shape-${newShape}`);
      if (newRadius !== undefined) setCameraRadius(newRadius);
    };
    
    const handleBorderUpdate = (_event: any, enabled: boolean, color: string) => {
      setBorderEnabled(enabled);
      setBorderColor(color);
    };
    
    if ((window as any).ipcRenderer) {
      (window as any).ipcRenderer.on('update-shape', handleShapeUpdate);
      (window as any).ipcRenderer.on('update-border', handleBorderUpdate);
    }
    
    return () => {
      if ((window as any).ipcRenderer) {
        (window as any).ipcRenderer.off('update-shape', handleShapeUpdate);
        (window as any).ipcRenderer.off('update-border', handleBorderUpdate);
      }
    };
  }, []);

  const shapeStyle: React.CSSProperties = {
    border: borderEnabled ? `4px solid ${borderColor}` : 'none',
  };
  
  if (shapeClass !== 'shape-circle') {
    shapeStyle.borderRadius = `${cameraRadius}px`;
  }

  return (
    <div 
      className={`camera-container ${shapeClass}`} 
      style={shapeStyle}
    >
      <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
    </div>
  );
}
