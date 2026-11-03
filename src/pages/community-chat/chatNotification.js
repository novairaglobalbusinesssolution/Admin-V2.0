import Swal from 'sweetalert2';

// Ensure the custom CSS is injected into the document
if (typeof document !== 'undefined') {
  const styleId = 'novaira-chat-swal-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      .novaira-swal-popup {
        border-radius: 24px !important;
        padding: 26px 22px !important;
        font-family: inherit !important;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35) !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
      }
      .novaira-swal-title {
        font-size: 1.25rem !important;
        font-weight: 800 !important;
        letter-spacing: -0.02em !important;
        margin-bottom: 8px !important;
      }
      .novaira-swal-text {
        font-size: 0.92rem !important;
        line-height: 1.55 !important;
        opacity: 0.85 !important;
      }
      .novaira-swal-btn-primary {
        background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
        color: #ffffff !important;
        font-weight: 700 !important;
        font-size: 0.88rem !important;
        border-radius: 12px !important;
        padding: 10px 22px !important;
        border: none !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35) !important;
        margin: 0 6px !important;
      }
      .novaira-swal-btn-primary:hover {
        transform: translateY(-1px) !important;
        box-shadow: 0 6px 18px rgba(37, 99, 235, 0.45) !important;
      }
      .novaira-swal-btn-danger {
        background: linear-gradient(135deg, #ef4444, #dc2626) !important;
        color: #ffffff !important;
        font-weight: 700 !important;
        font-size: 0.88rem !important;
        border-radius: 12px !important;
        padding: 10px 22px !important;
        border: none !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35) !important;
        margin: 0 6px !important;
      }
      .novaira-swal-btn-danger:hover {
        transform: translateY(-1px) !important;
        box-shadow: 0 6px 18px rgba(239, 68, 68, 0.45) !important;
      }
      .novaira-swal-btn-cancel {
        background: rgba(148, 163, 184, 0.16) !important;
        color: #64748b !important;
        font-weight: 700 !important;
        font-size: 0.88rem !important;
        border-radius: 12px !important;
        padding: 10px 20px !important;
        border: none !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        margin: 0 6px !important;
      }
      .novaira-swal-btn-cancel:hover {
        background: rgba(148, 163, 184, 0.25) !important;
        color: #334155 !important;
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Premium SweetAlert Theme for Novaira Community Chat
 */
export const notifySuccess = (title, text = '', timer = 1600, isDark = false) => {
  return Swal.fire({
    title,
    text,
    icon: 'success',
    timer,
    showConfirmButton: false,
    background: isDark ? '#0f172a' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    iconColor: '#10b981',
    customClass: {
      popup: 'novaira-swal-popup',
      title: 'novaira-swal-title',
      htmlContainer: 'novaira-swal-text'
    }
  });
};

export const notifyError = (title, text = '', isDark = false) => {
  return Swal.fire({
    title,
    text,
    icon: 'error',
    confirmButtonText: 'Understood',
    buttonsStyling: false,
    background: isDark ? '#0f172a' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    iconColor: '#ef4444',
    customClass: {
      popup: 'novaira-swal-popup',
      title: 'novaira-swal-title',
      htmlContainer: 'novaira-swal-text',
      confirmButton: 'novaira-swal-btn-danger'
    }
  });
};

export const notifyConfirm = ({
  title,
  text,
  icon = 'warning',
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  isDestructive = false,
  isDark = false
}) => {
  return Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    buttonsStyling: false,
    background: isDark ? '#0f172a' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    iconColor: isDestructive ? '#ef4444' : '#3b82f6',
    customClass: {
      popup: 'novaira-swal-popup',
      title: 'novaira-swal-title',
      htmlContainer: 'novaira-swal-text',
      confirmButton: isDestructive ? 'novaira-swal-btn-danger' : 'novaira-swal-btn-primary',
      cancelButton: 'novaira-swal-btn-cancel'
    }
  });
};

export default {
  notifySuccess,
  notifyError,
  notifyConfirm
};
