## Neru Vonage API Proxy with SMS Blacklist

Configuration will be at: /conf
Login using APP_ID and API_SECRET

SMS API needs to point to: /sms/json

Sample Curl:
```
curl --location --request POST 'https://<PROXY>/sms/json' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'from=Vonage APIs' \
--data-urlencode 'text=A text message sent using the Vonage SMS API' \
--data-urlencode 'to=<NUMBER>' \
--data-urlencode 'api_key=<KEY>' \
--data-urlencode 'api_secret=<KEY>'
```

Will return `403: Country in Blocked List` if using SMS API and “to” number is in country blacklist. Otherwise, this will act as a straight through proxy for https://rest.nexmo.com.

## This code uses the Neru Serverless Platform
As such, neru needs to be initialized to run this

Read up here: https://vonage-neru.herokuapp.com/neru/overview
