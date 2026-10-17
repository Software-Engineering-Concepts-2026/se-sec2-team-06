import { getCurrentUser } from '../api/client.js';

let sessionUser = null;

export async function loadSession() {
  try {
    sessionUser = await getCurrentUser();
    return sessionUser;
  } catch (error) {
    sessionUser = null;
    if (error?.status === 401) {
      return null;
    }
    throw error;
  }
}

export function getSessionUser() {
  return sessionUser;
}
