# Amazon Shopping List Scraper
** This project is based on (https://github.com/jtbnz/amazon_shopping_list/) by https://github.com/jtbnz **

The project scrapes the Amazon Shopping List page and add the items to the Home Assistant Shopping List (todo list) every 3 minutes.
* This is a one-way sync only from Amazon List to Home Assistant and it only adds item to Home Assistant. It does not remove items from Home Assistant (even if removed from Amazon Shopping List)
* This project was crerated using the Amazon USA pages. If you are using amazon in a different location, change the URLs in the Configuration Section.

### Important - Do not skip this step<BR>
You will need the Amazon Email and Password that you use to Login, the OTP Secret Key and the Home Assistant Webhook URL.
Please find the instructions on how to get the OTP Secret Key and the Home Assistant Webhook URL:

### How to get your OTP App Secret from Amazon:<BR>
### If you don't have 2-step verification enable:<BR>
1 - Login to Amazon https://www.amazon.com/<BR>
2 - Go to Your Account => Login & Security and click on "Turn On" under 2-step verification<BR>
3 - Select the Authentication App<BR>
4 - Click on "Can't scan the barcode" and save the Key (13 sets of 4 characters each)<BR>
5 - Remove the spaces of the Key (you will have something like this "ASDMASDFMSKDMKSFMKLASDDADABB6JNRNF7WFEHQW23H238R7843") and save it as <YOUR_OTP_APP_SECRET><BR>
6 - Open your Authenticator App (i.e. [Google Authenticator](https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2&hl=en_US)), scan the QR Code and paste the 6 digits to validate the code

### If you already have 2-step verification enable:<BR>
1 - Login to Amazon https://www.amazon.com/<BR>
2 - Go to Your Account => Login & Security and click on "Manage" under 2-step verification<BR>
3 - Under Authenticator App, click on Add New App<BR>
4 - Click on "Can't scan the barcode" and save the Key (13 sets of 4 characters each)<BR>
5 - Remove the spaces of the Key (you will have something like this "ASDMASDFMSKDMKSFMKLASDDADABB6JNRNF7WFEHQW23H238R7843") and save it as <YOUR_OTP_APP_SECRET><BR>
6 - Open your Authenticator App (i.e. [Google Authenticator](https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2&hl=en_US)), scan the QR Code and paste the 6 digits to validate the code

### How to get the Home Assistant Webhook URL:<BR>
1 - Import this blueprint: [Blueprint](/alexa_shopping_list_scraper%2FBlueprint_Import-Alexa-Shoppinglist.yaml)<BR>
[![Open your Home Assistant instance and show the add blueprint dialog.](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A//github.com/thiagobruch/HA_Addons/blob/main/alexa_shopping_list_scraper/Blueprint_Import-Alexa-Shoppinglist.yaml)<BR>
2 - Create a webhook trigger inside the blueprint<BR>
3 - Click on the copy symbol on the right to get the URL and save it (example: http://homeassistant.local:8123/api/webhook/-hA_THs-Yr5dfasnnkjfsdfsa)<BR>
4 - Select which Home Assistant shopping list should be used<BR>
7 - Click on Save and give a name to the Automation<BR>

Once you have the information above, you can install the AddOn and go to the Configuration Tab.<BR>
In the Configuration add the following information:<BR>

* Amazon_Login: <YOUR_AMAZON_EMAIL> \ # your email address used to login at amazon in this format email@email.com<BR><BR>
* Amazon_Pass: <YOUR_AMAZON_PASSORD> \ # your password used to login at amazon in this format mypassword1234 (passwords with # are not supported)<BR><BR>
* Amazon_Secret: <YOUR_OTP_APP_SECRET> \ # your OTP App Secret in this format myotpsecrete1234. More instructions <B>[here](#How-to-get-your-OTP-App-Secret-from-Amazon)</B><BR><BR>
* HA_Webhook_URL: <HOME_ASSISTANT_WEBHOOK_URL> \ # your Home Assistant Webhook URL. More instructions <b>[here](#how-to-get-the-Home-Assistant-Webhook-URL)</b><BR><BR>
* Delete_After_Download: True/False \ # This option, when enabled, will delete the pulled items from the Amazon Shopping List<BR><BR>
* Pooling_Interval: <Numebr_Of_Seconds> \ # How often in seconds the script will try to get collect items from the Amazon Shopping List (recommended greater or equal to 180 seconds)

### * If you are not in the US and use Amazon in a different country, change the URLs below:
* Amazon_Sign_in_URL: Amazon URL to sign. You'll need to find the URL for your country:
```
e.g. United States: 
"https://www.amazon.com/ap/signin?openid.pape.max_auth_age=3600&openid.return_to=https%3A%2F%2Fwww.amazon.com%2Falexaquantum%2Fsp%2FalexaShoppingList%3Fref_%3Dlist_d_wl_ys_list_1&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=amzn_alexa_quantum_us&openid.mode=checkid_setup&language=en_US&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0"
e.g. Italy:
"https://www.amazon.it/ap/signin?openid.pape.max_auth_age=0&openid.return_to=https%3A%2F%2Fwww.amazon.it%2Fref%3Dnav_signin&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=itflex&openid.mode=checkid_setup&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0"
e.g. Germany:
"https://www.amazon.de/ap/signin?openid.pape.max_auth_age=3600&openid.return_to=https%3A%2F%2Fwww.amazon.de%2Falexaquantum%2Fsp%2FalexaShoppingList%3Fref_%3Dlist_d_wl_ys_list_1&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=amzn_alexa_quantum_de&openid.mode=checkid_setup&language=de_DE&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0"
```
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

### Extra - Debug Option
Enable the option "Debug_Log"
It will generate verbose logs for several calls inside the script.
Once the Add-On completes a full cycle of running=> error=> running again, some screenshots of the process internally, can be found at http://homeassistant.local:8888 
