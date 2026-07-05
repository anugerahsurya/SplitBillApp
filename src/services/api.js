// PENTING: Ganti URL ini dengan URL Web App Google Apps Script yang Anda deploy
export const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby3zfUlsSKGWfvt9bRqwmFScL2-sc_-oVDqf22fjYEdpZ07TmeeCVe2hQNclPVr4ydE/exec';

export const api = {
  async getActivity(id) {
    const url = `${GAS_WEB_APP_URL}?action=getActivity&id=${id}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  },

  async getAllActivities() {
    const url = `${GAS_WEB_APP_URL}?action=getAllActivities`;
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
  },

  async deleteActivity(activityId) {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteActivity', activity_id: activityId }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  },

  async editActivity(activityId, newName) {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'editActivity', activity_id: activityId, name: newName }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  },

  async deleteTransaction(transactionId) {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteTransaction', transaction_id: transactionId }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  },

  async editTransaction(data) {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'editTransaction',
        transaction_id: data.transaction_id,
        paid_by_member_id: data.paid_by_member_id,
        amount: data.amount,
        involved_member_ids: data.involved_member_ids
      }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  }
}
