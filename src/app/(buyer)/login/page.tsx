'use client';

import { useRouter } from 'next/navigation';
import { AuthModal } from '../../_components/AuthModal';
import { BuyerScreen } from '../_ui/buyer-ui';

// actuality-reminders: a reminder opened while signed out comes back to its list after sign-in. Only this one
// same-site path is accepted, so the parameter cannot send anyone elsewhere.
const REMINDER_RETURN = '/seller?actuality=1';

function afterLogin() {
  return new URLSearchParams(window.location.search).get('next') === REMINDER_RETURN ? REMINDER_RETURN : '/';
}

export default function LoginPage() {
  const router = useRouter();

  return (
    // The sign-in sheet over an empty buyer screen (buyer-screens-mockup).
    <BuyerScreen section="more" overlay={<AuthModal open onClose={() => router.replace('/')} onAuthenticated={() => router.replace(afterLogin())} />}>
      <main className="body" aria-hidden="true" />
    </BuyerScreen>
  );
}
