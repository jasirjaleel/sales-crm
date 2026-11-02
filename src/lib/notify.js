export const TOAST_EVENT = 'crm:toast';

export function notify(message, type = 'success') {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type } }));
}

export function notifyError(err, fallback = 'Something went wrong. Please try again.') {
  console.error(err);
  notify(err?.message ? `${fallback} (${err.message})` : fallback, 'error');
}
