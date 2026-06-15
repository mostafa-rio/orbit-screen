import { useState, useEffect } from 'react';
import Onboarding from './Onboarding';
import ToolDeck from './ToolDeck';
import './App.css';

function App() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const config = await (window as any).ipcRenderer.invoke('get-config');
        setOnboardingComplete(config.onboardingComplete);
        if (config.onboardingComplete) {
          // ToolDeck will now handle its own dynamic resizing
        }
      } catch (e) {
        console.error(e);
      }
    }
    init();
  }, []);

  if (onboardingComplete === null) {
    return null; // Loading state
  }

  return (
    <>
      {!onboardingComplete ? (
        <Onboarding onComplete={() => setOnboardingComplete(true)} />
      ) : (
        <ToolDeck />
      )}
    </>
  );
}

export default App;
