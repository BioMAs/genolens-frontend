/**
 * Contact addresses shown in the UI. One place, so two screens can no longer
 * send users to two different mailboxes (the /suspended page used to say
 * support@genolens.com while the read-only banner said support@scilicium.com).
 *
 * SUPPORT_EMAIL matches the address the backend puts in its own account-state
 * and license errors (app/api/deps/account_state.py, app/api/deps/license.py).
 * SALES_EMAIL matches `SALES_EMAIL` in backend/app/core/config.py.
 */
export const SUPPORT_EMAIL = 'support@scilicium.com';
export const SALES_EMAIL = 'contact@scilicium.com';
