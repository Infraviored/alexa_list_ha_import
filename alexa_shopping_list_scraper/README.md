# Amazon Shopping List Scraper
** This project is based on (https://github.com/jtbnz/amazon_shopping_list/) by https://github.com/jtbnz **

The project scrapes the Amazon Shopping List page and add the items to the Home Assistant Shopping List (todo list) every 3 minutes.
* This is a one-way sync only from Amazon List to Home Assistant and it only adds item to Home Assistant. It does not remove items from Home Assistant (even if removed from Amazon Shopping List)
* This project was crerated using the Amazon USA pages. If you are using amazon in a different location, change the URLs in the Configuration Section.

### Important<BR>
This add-on now uses cookie-based authentication. Export your Amazon cookies as JSON and paste them into the add-on options. You still need the Home Assistant Webhook URL.

### Export your Amazon cookies as JSON<BR>
1 - In your normal browser, log into Amazon for your region and open the Alexa Shopping List page. Solve any CAPTCHA if shown.<BR>
   - Germany: https://www.amazon.de/alexaquantum/sp/alexaShoppingList?ref_=list_d_wl_ys_list_1<BR>
   - United States: https://www.amazon.com/alexaquantum/sp/alexaShoppingList?ref_=list_d_wl_ys_list_1<BR>
2 - Use a cookie editor extension (e.g. "Cookie-Editor") and export cookies as JSON for the current site (.amazon.de or .amazon.com).<BR>
3 - Copy the exported JSON and paste it into the add-on option "Cookies_JSON". The add-on writes it to /data/cookies.json and reuses it each run.<BR>
4 - If the session expires, re-export after logging in again.

### How to get the Home Assistant Webhook URL:<BR>
1 - Import this blueprint: [Blueprint](/alexa_shopping_list_scraper%2FBlueprint_Import-Alexa-Shoppinglist.yaml)<BR>
[![Open your Home Assistant instance and show the blueprint import dialog with a specific blueprint pre-filled.](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A//github.com/Infraviored/alexa_list_ha_import/blob/main/alexa_shopping_list_scraper/Blueprint_Import-Alexa-Shoppinglist.yaml)<BR>
2 - Create a webhook trigger inside the blueprint<BR>
3 - Click on the copy symbol on the right to get the URL and save it (example: http://homeassistant.local:8123/api/webhook/-hA_THs-Yr5dfasnnkjfsdfsa)<BR>
4 - Select which Home Assistant shopping list should be used<BR>
7 - Click on Save and give a name to the Automation<BR>

Once you have the information above, you can install the AddOn and go to the Configuration Tab.<BR>
In the Configuration add the following information:<BR>

* Cookies_JSON: <PASTE_YOUR_EXPORTED_COOKIES_JSON_HERE> \ # JSON array of cookies exported from your browser for Amazon.<BR><BR>
* HA_Webhook_URL: <HOME_ASSISTANT_WEBHOOK_URL> \ # your Home Assistant Webhook URL. More instructions <b>[here](#how-to-get-the-Home-Assistant-Webhook-URL)</b><BR><BR>
* Delete_After_Download: True/False \ # This option, when enabled, will delete the pulled items from the Amazon Shopping List<BR><BR>
* Pooling_Interval: <Numebr_Of_Seconds> \ # How often in seconds the script will try to get collect items from the Amazon Shopping List (recommended greater or equal to 180 seconds) - IF set to 0, the AddOn will start, run and stop.

### Region URLs
* Amazon_Shopping_List_Page:
```
e.g. United States:
"https://www.amazon.com/alexaquantum/sp/alexaShoppingList?ref_=list_d_wl_ys_list_1"
e.g. Italy:
"https://www.amazon.it/alexaquantum/sp/alexaShoppingList?ref_=list_d_wl_ys_list_1"
e.g. Germany:
"https://www.amazon.de/alexaquantum/sp/alexaShoppingList?ref_=list_d_wl_ys_list_1"
```

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
