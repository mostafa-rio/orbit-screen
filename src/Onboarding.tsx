import { useState, useEffect } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import './Onboarding.css';

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [screenAccess, setScreenAccess] = useState(false);

  const checkPermissions = async () => {
    try {
      const status = await (window as any).ipcRenderer.invoke('check-permissions');
      setScreenAccess(status.screenAccess);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkPermissions();
    const interval = setInterval(checkPermissions, 1000);
    return () => clearInterval(interval);
  }, []);

  const requestScreen = () => {
    (window as any).ipcRenderer.send('open-system-preferences');
  };

  const requestAccessibility = () => {
    (window as any).ipcRenderer.send('request-accessibility');
    // Also open the preferences pane to help them find it easily
    (window as any).ipcRenderer.send('open-accessibility-preferences');
  };

  const handleContinue = () => {
    if (screenAccess) {
      (window as any).ipcRenderer.send('complete-onboarding');
      onComplete();
    }
  };

  return (
    <div className="onboarding-container drag-region">
      <div className="onboarding-header">
        <div className="logo-circle" style={{ overflow: 'hidden', padding: 0, position: 'relative' }}>
           <img src="./orbit-logo.png" alt="Orbit Screen" style={{ width: '145%', height: '145%', objectFit: 'cover', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
        </div>
        <h1>Welcome to Orbit Screen!</h1>
        <p>Before you can start recording, we need to ask you for a few permissions.</p>
      </div>

      <div className="permissions-list no-drag-region">
        <div className="permission-item">
          <div className="perm-info">
            <h3>Screen Recording Permission</h3>
            <p>Orbit Screen needs to capture video of your screen. You might need to restart the app after granting it.</p>
          </div>
          {screenAccess ? (
            <div className="status-granted"><CheckCircle2 size={16} /> Screen Recording enabled</div>
          ) : (
            <button className="btn-request" onClick={requestScreen}>Allow Screen Recording</button>
          )}
        </div>

        <div className="permission-item" style={{ padding: '16px', background: 'rgba(37, 99, 235, 0.1)', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: '12px', alignItems: 'flex-start', marginTop: '10px' }}>
          <ShieldCheck style={{ color: '#3b82f6', marginTop: '2px', flexShrink: 0 }} size={24} />
          <div className="perm-info" style={{ marginLeft: '12px' }}>
            <h3 style={{ color: '#60a5fa' }}>100% On-Device & Private</h3>
            <p style={{ color: '#93c5fd' }}>Orbit Screen operates completely on your machine. There are no servers, no APIs, and absolutely no usage data or telemetry collection. Your recordings stay entirely yours.</p>
          </div>
        </div>
      </div>

      <div className="footer no-drag-region" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          className="btn-continue" 
          disabled={!screenAccess}
          onClick={handleContinue}
        >
          <CheckCircle2 size={18} /> Accept and Continue
        </button>
      </div>
    </div>
  );
}
