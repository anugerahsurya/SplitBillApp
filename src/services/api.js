// PENTING: Ganti URL ini dengan URL Web App Google Apps Script yang Anda deploy
export const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx6sEpZZUB5QKij2KNSJLAaDkzUTBPi3iGzGoNw-haptFT6LIqvVm2ULqWG3_MzmSu6/exec";

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
        involved_member_ids: data.involved_member_ids,
        item_name: data.item_name
      }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  },

  async addMember(data) {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'addMember',
        activity_id: data.activity_id,
        name: data.name,
        bank_name: data.bank_name,
        bank_account: data.bank_account
      }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  },

  async editMember(data) {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'editMember',
        member_id: data.member_id,
        name: data.name,
        bank_name: data.bank_name,
        bank_account: data.bank_account
      }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  },

  async deleteMember(memberId) {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteMember', member_id: memberId }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  }
}
