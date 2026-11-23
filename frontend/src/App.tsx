import React, { useState } from 'react';
import { HomePage } from './pages/HomePage';
import { WorkoutPage } from './pages/WorkoutPage';
import { SummaryPage } from './pages/SummaryPage';
import { HistoryPage } from './pages/HistoryPage';
import { WorkoutSessionData } from './types/workout';
import './styles/theme.css';

type Screen = 'HOME' | 'WORKOUT' | 'SUMMARY' | 'HISTORY';

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('HOME');
  const [completedSession, setCompletedSession] = useState<WorkoutSessionData | null>(null);

  const handleStartWorkout = () => {
    setCurrentScreen('WORKOUT');
  };

  const handleFinishWorkout = (session: WorkoutSessionData) => {
    setCompletedSession(session);
    setCurrentScreen('SUMMARY');
  };

  const handleExitWorkout = () => {
    setCurrentScreen('HOME');
  };

  const handleGoHome = () => {
    setCompletedSession(null);
    setCurrentScreen('HOME');
  };

  const handleViewHistory = () => {
    setCurrentScreen('HISTORY');
  };

  return (
    <div className="skipsense-app">
      {currentScreen === 'HOME' && (
        <HomePage onStartWorkout={handleStartWorkout} onViewHistory={handleViewHistory} />
      )}

      {currentScreen === 'WORKOUT' && (
        <WorkoutPage onFinishWorkout={handleFinishWorkout} onExitWorkout={handleExitWorkout} />
      )}

      {currentScreen === 'SUMMARY' && completedSession && (
        <SummaryPage
          session={completedSession}
          onGoHome={handleGoHome}
          onViewHistory={handleViewHistory}
        />
      )}

      {currentScreen === 'HISTORY' && <HistoryPage onBack={handleGoHome} />}
    </div>
  );
};

export default App;
