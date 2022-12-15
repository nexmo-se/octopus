## Octopus API

Configuration will be at: /conf
Login using APP_ID and API_SECRET

This Service will check "from" number for fraud using various filters

Sample Curl:
```
curl --location --request POST 'https://<ENDPOINT>/octopus' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'from=FROMNUMBER' \
--data-urlencode 'api_key=APIKEY' \
--data-urlencode 'api_secret=APISECRET'
```

Will return 
```
{
    "allowed": true,
    "message": "<MESSAGE>"
}
```
If *NOT blocked*

Will return 
```
{
    "allowed": false,
    "message": "<MESSAGE>"
}
```
If *Blocked*

## This code uses the Neru Serverless Platform
As such, neru needs to be initialized to run this

Read up here: https://vonage-neru.herokuapp.com/neru/overview
