// PENTING: Ganti URL ini dengan URL Web App Google Apps Script yang Anda deploy
export const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwdJ8J5sIn8n_n2RBGchZYw9dEXRviZ0hT-i-6y1I4WdBUr5rEMwFd0lXHFi_g_Ti9w/exec';

export const api = {
  async getActivity(id) {
    const url = `${GAS_WEB_APP_URL}?action=getActivity&id=${id}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  },

  async createActivity(data) {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'createActivity',
        ...data
      }),
      // Apps Script requires text/plain for postData.contents to work reliably sometimes with CORS
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      }
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  },

  async addTransaction(data) {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'addTransaction',
        ...data
      }),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      }
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  },

  async finishActivity(activityId) {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'finishActivity',
        activity_id: activityId
      }),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      }
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  }
}
