import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.firebase';
import ModulePicker from './ModulePicker';

/**
 * Sits globally in AppRoutes. When a user signs in via a /meet/:sessionId page,
 * the meet page stores the session details in sessionStorage before triggering
 * Google auth. After auth succeeds and the user lands in the app, this component
 * picks up those values and shows the ModulePicker so they can choose where to
 * house the group meet.
 */
const PendingMeetHandler: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [pending, setPending] = useState<{
    sessionId: string;
    title: string;
    organizerName: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;

    const sessionId = sessionStorage.getItem('pendingMeetSessionId');
    const title = sessionStorage.getItem('pendingMeetTitle') ?? '';
    const organizerName = sessionStorage.getItem('pendingMeetOrganizerName') ?? 'Someone';

    if (sessionId) {
      setPending({ sessionId, title, organizerName });
    }
  }, [user, location.pathname]);

  const handleDone = () => {
    sessionStorage.removeItem('pendingMeetSessionId');
    sessionStorage.removeItem('pendingMeetTitle');
    sessionStorage.removeItem('pendingMeetOrganizerName');
    setPending(null);
  };

  if (!user || !pending) return null;

  return (
    <ModulePicker
      open={true}
      sessionId={pending.sessionId}
      sessionTitle={pending.title}
      organizerName={pending.organizerName}
      onDone={handleDone}
    />
  );
};

export default PendingMeetHandler;
