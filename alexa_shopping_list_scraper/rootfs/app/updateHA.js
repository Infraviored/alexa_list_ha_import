// fetchItems.js
require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

function getEnvVariable(key) {
    return process.env[key];
}

// URL or ID of the Home Assistant webhook
const rawWebhook = getEnvVariable('HA_Webhook_URL') || getEnvVariable('HA_WEBHOOK_URL');
const supervisorToken = process.env.SUPERVISOR_TOKEN;

function buildWebhookTarget(raw) {
  if (!raw || typeof raw !== 'string') return { url: null, headers: {} };
  const headers = { 'Content-Type': 'application/json' };
  
  // If it's a full external URL (https:// or http://), use it as-is
  // Webhooks don't require Bearer token authentication
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return { url: raw, headers };
  }
  
  // For local/internal URLs, prefer Supervisor endpoint when possible to bypass local_only/networking constraints
  try {
    const idMatch = raw.match(/\/api\/webhook\/([^/?#]+)/);
    if (supervisorToken && idMatch && idMatch[1]) {
      headers['Authorization'] = `Bearer ${supervisorToken}`;
      return { url: `http://supervisor/core/api/webhook/${idMatch[1]}`, headers };
    }
  } catch (_) {}
  
  // If just webhook ID is provided
  if (supervisorToken && /^[A-Za-z0-9_-]+$/.test(raw)) {
    headers['Authorization'] = `Bearer ${supervisorToken}`;
    return { url: `http://supervisor/core/api/webhook/${raw}`, headers };
  }
  
  // Fallback: use provided URL as-is
  return { url: raw, headers };
}

const { url: webhookUrl, headers: defaultHeaders } = buildWebhookTarget(rawWebhook);
if (!webhookUrl) {
  console.error('WebHook URL/ID not configured. Set HA_Webhook_URL in add-on options.');
}

// Read the JSON file asynchronously
fs.readFile('list_of_items.json', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading the file:', err);
    return;
  }

  // Parse the JSON data
  let items;
  try {
    items = JSON.parse(data);
  } catch (err) {
    console.error('Error parsing JSON:', err);
    return;
  }

  // Function to make a webhook call for each item
  const addItemToShoppingList = async (itemName) => {
    try {
      const response = await axios.post(webhookUrl, {
        action: "call_service",
        service: "shopping_list.add_item",
        name: itemName
      }, { headers: defaultHeaders, timeout: 15000 });
      const status = response.status;
      if (status >= 200 && status < 300) {
        console.log(`Added "${itemName}"`);
      } else {
        console.error(`Error adding item: ${itemName} HTTP ${status}`);
      }
    } catch (error) {
      const info = error.response ? { status: error.response.status, data: error.response.data } : { message: error.message };
      console.error(`Error adding item: ${itemName}`, info);
    }
  };

  // Iterate over each item and call the webhook
  items.forEach(item => {
    // Handle both object format {name: "...", completed: bool} and string format
    const itemName = typeof item === 'object' ? item.name : item;
    if (itemName) {
      addItemToShoppingList(itemName);
    }
  });
const filePath = 'list_of_items.json';
fs.unlink(filePath, (err) => {
  if (err) {
    console.error(`Error deleting the file: ${err.message}`);
    return;
  }
//  console.log(`Successfully deleted the file: ${filePath}`);
});
});
