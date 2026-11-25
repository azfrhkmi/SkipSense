import React, { useState } from 'react';
import { HomePage } from './pages/HomePage';
import { WorkoutPage } from './pages/WorkoutPage';
import { SummaryPage } from './pages/SummaryPage';
import { PushUpWorkoutPage } from './pages/PushUpWorkoutPage';
import { PushUpSummaryPage } from './pages/PushUpSummaryPage';
import { HistoryPage } from './pages/HistoryPage';
import { WorkoutSessionData } from './types/workout';
import { PushUpMode } from './exercises/pushup/pushUpTypes';
import './styles/theme.css';

type Screen = 'HOME' | 'WORKOUT' | 'SUMMARY' | 'PUSHUP_WORKOUT' | 'PUSHUP_SUMMARY' | 'HISTORY';

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('HOME');
  const [completedSession, setCompletedSession] = useState<WorkoutSessionData | null>(null);
  const [pushUpMode, setPushUpMode] = useState<PushUpMode>('10');

  // Skipping Navigation
  const handleStartSkipping = () => {
    setCurrentScreen('WORKOUT');
  };

  const handleFinishSkipping = (session: WorkoutSessionData) => {
    setCompletedSession(session);
    setCurrentScreen('SUMMARY');
  };

  // Push-Up Navigation
  const handleStartPushUp = (mode: PushUpMode) => {
    setPushUpMode(mode);
    setCurrentScreen('PUSHUP_WORKOUT');
  };

  const handleFinishPushUp = (session: WorkoutSessionData) => {
    setCompletedSession(session);
    setCurrentScreen('PUSHUP_SUMMARY');
  };

  const handlePushUpAgain = () => {
    setCurrentScreen('PUSHUP_WORKOUT');
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
        <HomePage
          onStartSkipping={handleStartSkipping}
          onStartPushUp={handleStartPushUp}
          onViewHistory={handleViewHistory}
        />
      )}

      {currentScreen === 'WORKOUT' && (
        <WorkoutPage
          onFinishWorkout={handleFinishSkipping}
          onExitWorkout={handleExitWorkout}
        />
      )}

      {currentScreen === 'SUMMARY' && completedSession && (
        <SummaryPage
          session={completedSession}
          onGoHome={handleGoHome}
          onWorkoutAgain={handleStartSkipping}
          onViewHistory={handleViewHistory}
        />
      )}

      {currentScreen === 'PUSHUP_WORKOUT' && (
        <PushUpWorkoutPage
          mode={pushUpMode}
          onFinishWorkout={handleFinishPushUp}
          onExitWorkout={handleExitWorkout}
        />
      )}

      {currentScreen === 'PUSHUP_SUMMARY' && completedSession && (
        <PushUpSummaryPage
          session={completedSession}
          onGoHome={handleGoHome}
          onWorkoutAgain={handlePushUpAgain}
          onViewHistory={handleViewHistory}
        />
      )}

      {currentScreen === 'HISTORY' && <HistoryPage onBack={handleGoHome} />}
    </div>
  );
};

export default App;
