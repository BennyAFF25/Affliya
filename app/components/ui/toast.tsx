import toast from 'react-hot-toast';

export const nmToast = {
  success: (message: string) =>
    toast.success(message, {
      style: {
        background: '#0e1112',
        color: '#eaffff',
        border: '1px solid rgba(0,194,203,0.35)',
        boxShadow: '0 0 25px rgba(0,194,203,0.35)',
      },
      iconTheme: {
        primary: '#00C2CB',
        secondary: '#0e1112',
      },
    }),

  error: (message: string) =>
    toast.error(message, {
      style: {
        background: '#120c0c',
        color: '#ffecec',
        border: '1px solid rgba(255,80,80,0.4)',
      },
    }),

  info: (message: string) =>
    toast(message, {
      style: {
        background: '#0e1112',
        color: '#eaffff',
        border: '1px solid rgba(255,255,255,0.12)',
      },
    }),
};