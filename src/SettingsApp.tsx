import { useState, useEffect } from 'react';
import './index.css';

export default function SettingsApp() {
  const [defaultPath, setDefaultPath] = useState('');
  const [cameraShape, setCameraShape] = useState('circle');
  const [cameraRadius, setCameraRadius] = useState(24);
  const [borderEnabled, setBorderEnabled] = useState(true);
  const [borderColor, setBorderColor] = useState('#ffffff');

  useEffect(() => {
    (window as any).ipcRenderer.invoke('get-config').then((config: any) => {
      setDefaultPath(config.defaultSavePath || '');
      setCameraShape(config.cameraShape || 'circle');
      setCameraRadius(config.cameraRadius ?? 24);
      setBorderEnabled(config.cameraBorderEnabled ?? true);
      setBorderColor(config.cameraBorderColor || '#ffffff');
    });
  }, []);

  const selectPath = async () => {
    const p = await (window as any).ipcRenderer.invoke('select-default-path');
    if (p) setDefaultPath(p);
  };

  const updateShape = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const shape = e.target.value;
    setCameraShape(shape);
    (window as any).ipcRenderer.send('set-camera-shape', shape, cameraRadius);
  };

  const updateRadius = (e: React.ChangeEvent<HTMLInputElement>) => {
    const radius = parseInt(e.target.value);
    setCameraRadius(radius);
    (window as any).ipcRenderer.send('set-camera-shape', cameraShape, radius);
  };

  const updateBorderEnabled = (e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked;
    setBorderEnabled(enabled);
    (window as any).ipcRenderer.send('set-camera-border', enabled, borderColor);
  };

  const updateBorderColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setBorderColor(color);
    (window as any).ipcRenderer.send('set-camera-border', borderEnabled, color);
  };

  return (
    <div style={{ padding: '24px', background: '#0f0f11', height: '100vh', color: 'white', overflowY: 'auto' }}>
      <h2 style={{ marginBottom: '16px' }}>Settings</h2>
      
      <div style={{ background: '#1c1c1f', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '8px' }}>Recordings Save Location</h3>
        <p style={{ fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '12px' }}>Choose where your MP4 screen recordings will be saved by default.</p>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
           <input 
             type="text" 
             readOnly 
             value={defaultPath || 'Ask every time'} 
             style={{ flex: 1, padding: '8px', background: '#0f0f11', border: '1px solid #27272a', borderRadius: '8px', color: 'white', outline: 'none' }} 
           />
           <button onClick={selectPath} style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>
             Change
           </button>
        </div>
      </div>

      <div style={{ background: '#1c1c1f', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '8px' }}>Camera Shape</h3>
        <p style={{ fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '12px' }}>Select the shape of your camera overlay.</p>
        
        <select value={cameraShape} onChange={updateShape} style={{ width: '100%', padding: '8px', background: '#0f0f11', border: '1px solid #27272a', borderRadius: '8px', color: 'white', outline: 'none', marginBottom: cameraShape !== 'circle' ? '12px' : '0' }}>
          <option value="circle">Circle</option>
          <option value="square">Square</option>
          <option value="rectangle-h">Horizontal Rectangle</option>
          <option value="rectangle-v">Vertical Rectangle</option>
        </select>
        
        {cameraShape !== 'circle' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
            <span style={{ fontSize: '0.85rem' }}>Corner Radius: {cameraRadius}px</span>
            <input type="range" min="0" max="100" value={cameraRadius} onChange={updateRadius} style={{ flex: 1, cursor: 'pointer' }} />
          </div>
        )}
      </div>

      <div style={{ background: '#1c1c1f', padding: '16px', borderRadius: '12px' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '8px' }}>Camera Border</h3>
        <p style={{ fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '12px' }}>Customize the border around your camera.</p>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={borderEnabled} onChange={updateBorderEnabled} style={{ cursor: 'pointer' }} />
          <span>Show border</span>
        </label>

        {borderEnabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>Border color:</span>
            <input type="color" value={borderColor} onChange={updateBorderColor} style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: 0, width: '32px', height: '32px' }} />
          </div>
        )}
      </div>
    </div>
  );
}
