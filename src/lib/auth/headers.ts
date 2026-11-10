/**
 * Request headers used to pass the verified identity from the proxy to the
 * page and API handlers.
 *
 * The proxy validates the session once. It then forwards the resulting user
 * in these headers so the server components do not have to validate the same
 * token again. The proxy always strips any client-supplied value for these
 * headers before setting its own, so they cannot be spoofed.
 */
export const USER_ID_HEADER = 'x-coldfox-user-id';
export const USER_EMAIL_HEADER = 'x-coldfox-user-email';
export const USER_NAME_HEADER = 'x-coldfox-user-name';

export const USER_ID_HEADERS = [USER_ID_HEADER, USER_EMAIL_HEADER, USER_NAME_HEADER];
