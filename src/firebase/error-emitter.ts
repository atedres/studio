import { FirestorePermissionError } from './errors';

type PermissionErrorListener = (error: FirestorePermissionError) => void;

class ErrorEmitter {
  private listeners: PermissionErrorListener[] = [];

  emit(channel: 'permission-error', error: FirestorePermissionError) {
    if (channel === 'permission-error') {
      this.listeners.forEach(l => l(error));
    }
  }

  on(channel: 'permission-error', listener: PermissionErrorListener) {
    if (channel === 'permission-error') {
      this.listeners.push(listener);
    }
  }

  removeListener(channel: 'permission-error', listener: PermissionErrorListener) {
    if (channel === 'permission-error') {
      this.listeners = this.listeners.filter(l => l !== listener);
    }
  }
}

export const errorEmitter = new ErrorEmitter();
