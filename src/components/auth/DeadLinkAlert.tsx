import { AlertTriangle } from 'lucide-react';
import { authErrorMessage } from '@/utils/auth/messages';

/**
 * What a link that cannot be used says, whether it carried no token or the API
 * refused it (`invalid_token`: expired, already used, or never issued). The
 * words are the same either way, and say nothing about which.
 */
export default function DeadLinkAlert() {
  return (
    <div className="auth-alert auth-alert-error" role="alert">
      <AlertTriangle size={16} aria-hidden="true" />
      <span>{authErrorMessage(400, 'invalid_token')}</span>
    </div>
  );
}
