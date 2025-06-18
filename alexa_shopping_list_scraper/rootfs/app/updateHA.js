// fetchItems.js
require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

function getEnvVariable(key) {
    return process.env[key];
}

// URL of the Home Assistant webhook
const webhookUrl = getEnvVariable('HA_WEBHOOK_URL');

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
  const addItemToShoppingList = async (item) => {
    try {
      let JSONObject = { "action": "call_service", "service": "shopping_list.add_item", "name": item}
	  let Options = {
           method: "POST",
           headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
           },
           body: JSON.stringify(JSONObject)
      }	
	  const response = await fetch(webhookUrl, Options);
//          const otp = console.log(Options);
//      console.log(`Successfully added item: ${item}`, response.data);
    } catch (error) {
      console.error(`Error adding item: ${item}`, error.response ? error.response.data : error.message);
    }
  };

  // Iterate over each item and call the webhook
  items.forEach(item => {
    addItemToShoppingList(item);
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
