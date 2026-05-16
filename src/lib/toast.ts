type ToastType = 'success' | 'error' | 'warning'

interface ToastData {
  message: string
  type: ToastType
}

let toastFn: ((data: ToastData) => void) | null = null

export function showToast(message: string, type: ToastType = 'success') {
  toastFn?.({ message, type })
}

export function setToastHandler(fn: (data: ToastData) => void) {
  toastFn = fn
}

export function clearToastHandler() {
  toastFn = null
}
