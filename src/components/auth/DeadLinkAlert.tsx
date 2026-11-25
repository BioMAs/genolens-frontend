import AuthAlert from '@/components/auth/AuthAlert';
import { authErrorMessage } from '@/utils/auth/messages';

/**
 * What a link that cannot be used says, whether it carried no token or the API
 * refused it (`invalid_token`: expired, already used, or never issued). The
 * words are the same either way, and say nothing about which.
 */
export default function DeadLinkAlert() {
  return <AuthAlert tone="error">{authErrorMessage(400, 'invalid_token')}</AuthAlert>;
}
