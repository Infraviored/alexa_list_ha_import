# Alexa Shopping List Scraper (Cookie-only)
Scrapes your Amazon Alexa Shopping List page and adds items into Home Assistant’s Shopping List every 3 minutes.

- One-way sync (Amazon → Home Assistant)
- Region-aware (set the URL for your region)
- Cookie-based authentication ONLY

## Setup
1) Export cookies (Chromium-based browser + Cookie-Editor)
- Use Chrome/Edge/Brave
- Log into your region (e.g., `www.amazon.de`)
- Cookie-Editor → Export → JSON
- Copy JSON (single object `{}` or array `[]`)

2) Paste cookies in add-on config
- Paste JSON into `Cookies_JSON`
- Set `Amazon_Shopping_List_Page` to your region URL (see below)
- Set `HA_Webhook_URL` (webhook how-to below)
- Save, then Stop and Start the add-on

3) Provide Home Assistant webhook URL
See below.

## Region URLs
- US: `https://www.amazon.com/alexaquantum/sp/alexaShoppingList?ref_=list_d_wl_ys_list_1`
- IT: `https://www.amazon.it/alexaquantum/sp/alexaShoppingList?ref_=list_d_wl_ys_list_1`
- DE: `https://www.amazon.de/alexaquantum/sp/alexaShoppingList?ref_=list_d_wl_ys_list_1`

## Configuration
- `HA_Webhook_URL` (required)
- `Amazon_Shopping_List_Page` (required)
- `Cookies_JSON` (required)
- `Pooling_Interval` (default 180)
- `Delete_After_Download` (bool)
- `Debug_Log` (bool)

On startup, the add-on validates `HA_Webhook_URL` and cookies presence; errors are logged immediately if missing/invalid.

## How to get the Home Assistant Webhook URL:<BR>
1 - Import this blueprint: [Blueprint](/alexa_shopping_list_scraper%2FBlueprint_Import-Alexa-Shoppinglist.yaml)<BR>
[![Open your Home Assistant instance and show the blueprint import dialog with a specific blueprint pre-filled.](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A//github.com/Infraviored/alexa_list_ha_import/blob/main/alexa_shopping_list_scraper/Blueprint_Import-Alexa-Shoppinglist.yaml)<BR>
2 - Create a webhook trigger inside the blueprint<BR>
3 - Click on the copy symbol on the right to get the URL and save it (example: http://homeassistant.local:8123/api/webhook/-hA_THs-Yr5dfasnnkjfsdfsa)<BR>
4 - Select which Home Assistant shopping list should be used<BR>
7 - Click on Save and give a name to the Automation<BR>

### Extra - Clear Alexa Shopping List
Because this is a one way sync (from Amazon Shopping List to Home Assistant), I have an automation that clear Amazon Shopping list every night at midnight.
Here is the Automation in YAML:

```
description: ""
mode: single
trigger:
  - platform: time
    at: "00:00:00"
condition: []
action:
  - service: media_player.volume_set
    data:
      volume_level: 0.01
    target:
      entity_id: media_player.my_alexa
  - delay:
      hours: 0
      minutes: 0
      seconds: 3
      milliseconds: 0
  - service: media_player.play_media
    data:
      media_content_type: custom
      media_content_id: "clear my shopping list"
      enqueue: play
    target:
      entity_id: media_player.my_alexa
    enabled: true
  - delay:
      hours: 0
      minutes: 0
      seconds: 3
      milliseconds: 0
    enabled: true
  - service: media_player.play_media
    data:
      media_content_type: custom
      media_content_id: "yes"
      enqueue: play
    target:
      entity_id: media_player.my_alexa
    enabled: true
```

### Extra - Debug Option
Enable the option "Debug_Log"
It will generate verbose logs for several calls inside the script.
Once the Add-On completes a full cycle of running=> error=> running again, some screenshots of the process internally, can be found at http://homeassistant.local:8888 
