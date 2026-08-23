import { ref } from 'vue';

const toasts = ref([]);
let toastId = 0;

export function useToast() {
  function showToast(message, type = 'info', duration = 3000) {
    const id = ++toastId;
    toasts.value.push({ id, message, type });
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }

  function removeToast(id) {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }

  return {
    toasts,
    showToast,
    removeToast,
    success: (msg, dur) => showToast(msg, 'success', dur),
    error: (msg, dur) => showToast(msg, 'danger', dur),
    info: (msg, dur) => showToast(msg, 'info', dur),
    warning: (msg, dur) => showToast(msg, 'warning', dur),
  };
}
