Configuration is at: /conf (removed auth for now, creating a passport based custom auth)
SMS API needs to point to: /sms/json
Sample Curl:
```
curl --location --request POST 'https://<PROXY>/sms/json' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'from=Vonage APIs' \
--data-urlencode 'text=A text message sent using the Vonage SMS API' \
--data-urlencode 'to=6598629555' \
--data-urlencode 'api_key=3b8791fd' \
--data-urlencode 'api_secret=M1laUW5wECACPeg3'
```
Will return 403: Country in Blocked List if using sms API and “to” number is in country blacklist. Otherwise, this will act as a straight through proxy for https://rest.nexmo.com.