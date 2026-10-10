// URL Web App Google Apps Script. Bisa ditimpa lewat .env (VITE_GAS_URL)
// supaya ganti deployment tidak perlu ubah kode.
export const GAS_WEB_APP_URL =
  import.meta.env?.VITE_GAS_URL ||
  'https://script.google.com/macros/s/AKfycbx6sEpZZUB5QKij2KNSJLAaDkzUTBPi3iGzGoNw-haptFT6LIqvVm2ULqWG3_MzmSu6/exec';

const TIMEOUT_MS = 20000;

class ApiError extends Error {
  constructor(message, { invalidAction = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.invalidAction = invalidAction;
  }
}

async function call({ method = 'GET', query, body, signal }) {
  const url = query ? `${GAS_WEB_APP_URL}?${new URLSearchParams(query)}` : GAS_WEB_APP_URL;

  // Batas waktu sendiri: kalau Apps Script sedang dingin, permintaan bisa
  // menggantung lama dan tombol ikut terkunci selamanya tanpa ini.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      // Apps Script hanya membaca postData.contents dengan andal untuk text/plain,
      // dan text/plain juga menghindari preflight CORS.
      ...(body
        ? { body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' } }
        : {}),
    });

    if (!res.ok) throw new ApiError(`Server menjawab ${res.status}`);

    const data = await res.json();
    if (data?.error) throw new ApiError(data.error, { invalidAction: data.error === 'Invalid action' });
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

const post = (action, payload = {}, signal) => call({ method: 'POST', body: { action, ...payload }, signal });

export const api = {
  getActivity: (id, signal) => call({ query: { action: 'getActivity', id }, signal }),
  getAllActivities: (signal) => call({ query: { action: 'getAllActivities' }, signal }),

  createActivity: (data) => post('createActivity', data),
  finishActivity: (activity_id) => post('finishActivity', { activity_id }),
  deleteActivity: (activity_id) => post('deleteActivity', { activity_id }),
  editActivity: (activity_id, name) => post('editActivity', { activity_id, name }),

  addTransaction: (data) => post('addTransaction', data),
  editTransaction: (data) => post('editTransaction', data),
  deleteTransaction: (transaction_id) => post('deleteTransaction', { transaction_id }),

  /**
   * Simpan beberapa pengeluaran sekaligus. Mode "custom per orang" dulunya
   * mengirim satu permintaan per orang — 8 orang berarti 8 kali pulang-balik
   * ke Apps Script. Kalau backend sudah mendukung aksi batch, semuanya masuk
   * dalam satu permintaan; kalau belum (deployment lama), otomatis kembali ke
   * cara lama supaya tetap jalan tanpa perlu redeploy.
   */
  async addTransactions(activity_id, items) {
    try {
      const res = await post('addTransactions', { activity_id, items });
      if (Array.isArray(res?.ids)) return res;
      throw new ApiError('Respons batch tidak lengkap', { invalidAction: true });
    } catch (err) {
      if (!(err instanceof ApiError) || !err.invalidAction) throw err;

      const ids = [];
      for (const item of items) {
        const res = await post('addTransaction', { activity_id, ...item });
        ids.push(res.id);
      }
      return { success: true, ids, fallback: true };
    }
  },

  addMember: (data) => post('addMember', data),
  editMember: (data) => post('editMember', data),
  deleteMember: (member_id) => post('deleteMember', { member_id }),
};

export { ApiError };
