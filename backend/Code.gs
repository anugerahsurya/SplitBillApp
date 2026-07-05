function getDb() {
  const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1PaOjQkh2bCJrOGl9hOD2sFPKz48yxuuljOODppx0mNI/edit';
  return SpreadsheetApp.openByUrl(SPREADSHEET_URL);
}

function setup() {
  const db = getDb();
  const sheets = ['Activities', 'Members', 'Transactions'];
  
  sheets.forEach(sheetName => {
    if (!db.getSheetByName(sheetName)) {
      db.insertSheet(sheetName);
    }
  });
  
  const activitiesSheet = db.getSheetByName('Activities');
  if (activitiesSheet.getLastRow() === 0) {
    activitiesSheet.appendRow(['id', 'name', 'status', 'created_at']);
  }
  
  const membersSheet = db.getSheetByName('Members');
  if (membersSheet.getLastRow() === 0) {
    membersSheet.appendRow(['id', 'activity_id', 'name', 'bank_account', 'bank_name']);
  }
  
  const transactionsSheet = db.getSheetByName('Transactions');
  if (transactionsSheet.getLastRow() === 0) {
    transactionsSheet.appendRow(['id', 'activity_id', 'paid_by_member_id', 'amount', 'involved_member_ids', 'created_at']);
  }
}

// Helper to convert sheet data to array of objects
function sheetToObjectArray(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const result = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    result.push(obj);
  }
  
  return result;
}

// Enable CORS
function setCorsHeaders(output) {
  return output.setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    const db = getDb();
    
    if (action === 'getActivity') {
      const activityId = e.parameter.id;
      
      const activities = sheetToObjectArray(db.getSheetByName('Activities'));
      const activity = activities.find(a => a.id === activityId);
      
      if (!activity) {
        return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ error: 'Activity not found' })));
      }
      
      const members = sheetToObjectArray(db.getSheetByName('Members')).filter(m => m.activity_id === activityId);
      const transactions = sheetToObjectArray(db.getSheetByName('Transactions')).filter(t => String(t.activity_id) === String(activityId));
      
      return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: {
          activity,
          members,
          transactions
        }
      })));
    }
    
    if (action === 'getAllActivities') {
      const activities = sheetToObjectArray(db.getSheetByName('Activities'));
      // sort by created_at desc
      activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: activities
      })));
    }
    
    return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ error: 'Invalid action' })));
    
  } catch (err) {
    return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ error: err.message })));
  }
}

function doPost(e) {
  try {
    let requestBody;
    try {
      requestBody = JSON.parse(e.postData.contents);
    } catch(err) {
      // Form-urlencoded support for testing
      requestBody = e.parameter;
    }
    
    const action = requestBody.action;
    const db = getDb();
    
    if (action === 'createActivity') {
      const id = generateId();
      const name = requestBody.name;
      const members = requestBody.members; // Array of {name, bank_account}
      const createdAt = new Date().toISOString();
      
      db.getSheetByName('Activities').appendRow([id, name, 'active', createdAt]);
      
      const membersSheet = db.getSheetByName('Members');
      members.forEach(member => {
        membersSheet.appendRow([generateId(), id, member.name, member.bank_account || '', member.bank_name || '']);
      });
      
      return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success: true, id: id })));
    }
    
    if (action === 'addTransaction') {
      const activityId = requestBody.activity_id;
      const paidBy = requestBody.paid_by_member_id;
      const amount = requestBody.amount;
      const involved = requestBody.involved_member_ids; // Array of IDs
      const createdAt = new Date().toISOString();
      
      const id = generateId();
      db.getSheetByName('Transactions').appendRow([id, activityId, paidBy, amount, involved.join(','), createdAt]);
      
      return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success: true, id: id })));
    }
    
    if (action === 'finishActivity') {
      const activityId = requestBody.activity_id;
      const sheet = db.getSheetByName('Activities');
      const data = sheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(activityId)) {
          sheet.getRange(i + 1, 3).setValue('finished');
          break;
        }
      }
      
      return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success: true })));
    }
    
    if (action === 'deleteActivity') {
      const activityId = requestBody.activity_id;
      
      let sheet = db.getSheetByName('Activities');
      let data = sheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][0]) === String(activityId)) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      
      sheet = db.getSheetByName('Members');
      data = sheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][1]) === String(activityId)) {
          sheet.deleteRow(i + 1);
        }
      }
      
      sheet = db.getSheetByName('Transactions');
      data = sheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][1]) === String(activityId)) {
          sheet.deleteRow(i + 1);
        }
      }
      
      return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success: true })));
    }

    if (action === 'editActivity') {
      const activityId = requestBody.activity_id;
      const newName = requestBody.name;
      const sheet = db.getSheetByName('Activities');
      const data = sheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(activityId)) {
          sheet.getRange(i + 1, 2).setValue(newName);
          break;
        }
      }
      return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success: true })));
    }

    if (action === 'deleteTransaction') {
      const transactionId = requestBody.transaction_id;
      const sheet = db.getSheetByName('Transactions');
      const data = sheet.getDataRange().getValues();
      
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][0]) === String(transactionId)) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success: true })));
    }

    if (action === 'editTransaction') {
      const transactionId = requestBody.transaction_id;
      const paidBy = requestBody.paid_by_member_id;
      const amount = requestBody.amount;
      const involved = requestBody.involved_member_ids;
      
      const sheet = db.getSheetByName('Transactions');
      const data = sheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(transactionId)) {
          sheet.getRange(i + 1, 3).setValue(paidBy);
          sheet.getRange(i + 1, 4).setValue(amount);
          sheet.getRange(i + 1, 5).setValue(involved.join(','));
          break;
        }
      }
      return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success: true })));
    }
    
    return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ error: 'Invalid action' })));
    
  } catch (err) {
    return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ error: err.message })));
  }
}

function generateId() {
  return Utilities.getUuid().split('-')[0];
}
