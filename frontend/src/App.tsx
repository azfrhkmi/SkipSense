import React, { useEffect, useState } from 'react';
import { HomePage } from './pages/HomePage';
import { WorkoutPage } from './pages/WorkoutPage';
import { SummaryPage } from './pages/SummaryPage';
import { PushUpWorkoutPage } from './pages/PushUpWorkoutPage';
import { PushUpSummaryPage } from './pages/PushUpSummaryPage';
import { HistoryPage } from './pages/HistoryPage';
import { AuthPage } from './pages/AuthPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { WorkoutSessionData } from './types/workout';
import { AuthUser } from './types/auth';
import { AuthService } from './services/authService';
import { WorkoutService } from './workout/workoutService';
import { PushUpMode } from './exercises/pushup/pushUpTypes';
import { Zap } from 'lucide-react';
import './styles/theme.css';

type Screen =
  | 'HOME'
  | 'WORKOUT'
  | 'SUMMARY'
  | 'PUSHUP_WORKOUT'
  | 'PUSHUP_SUMMARY'
  | 'HISTORY'
  | 'ADMIN';

export const App: React.FC = () => {
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('HOME');
  const [completedSession, setCompletedSession] = useState<WorkoutSessionData | null>(null);
  const [pushUpMode, setPushUpMode] = useState<PushUpMode>('10');

  useEffect(() => {
    let mounted = true;
    AuthService.getMe()
      .then((res) => {
        if (!mounted) return;
        WorkoutService.setUserCacheScope(res.user.id);
        setCurrentUser(res.user);
      })
      .catch(() => {
        if (!mounted) return;
        WorkoutService.setUserCacheScope(null);
        setCurrentUser(null);
      })
      .finally(() => {
        if (mounted) setAuthChecked(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleAuthenticated = (user: AuthUser) => {
    WorkoutService.setUserCacheScope(user.id);
    setCurrentUser(user);
    setCurrentScreen('HOME');
  };

  const handleLogout = async () => {
    await AuthService.logout();
    WorkoutService.setUserCacheScope(null);
    setCurrentUser(null);
    setCompletedSession(null);
    setCurrentScreen('HOME');
  };

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

  const handleOpenAdmin = () => {
    if (currentUser?.role === 'admin') {
      setCurrentScreen('ADMIN');
    }
  };

  if (!authChecked) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#090B0D',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <div
          className="animate-pulse-subtle"
          style={{
            width: 52,
            height: 52,
            borderRadius: 15,
            backgroundColor: '#39E66B',
            color: '#090B0D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Zap size={28} strokeWidth={2.8} />
        </div>
        <div style={{ fontSize: 13, color: '#929BA3', fontWeight: 700 }}>
          Verifying secure session...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="skipsense-app">
      {currentScreen === 'HOME' && (
        <HomePage
          currentUser={currentUser}
          onUserUpdated={setCurrentUser}
          onLogout={handleLogout}
          onOpenAdmin={handleOpenAdmin}
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

      {currentScreen === 'ADMIN' && currentUser.role === 'admin' && (
        <AdminDashboardPage currentUser={currentUser} onBack={handleGoHome} />
      )}
    </div>
  );
};

export default App;
