## Octopus API

Configuration will be at: /conf
Login using APP_ID and API_SECRET

The code is very POC, as such it is not very clean at the moment. You can skin the EJS files

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

## Notes
- You can run it in Neru debug with caveats
- In Debug mode, the Login Authentication does not work and you will default to user octopus
- Use "octo" as api_key when sending request to /octopus when in debug mode. API Secret does not matter. Only works in Debug
- Also, in neru debug, the database will sometimes fail since debug IPs might not have been all added.

## This code uses the Neru Serverless Platform
As such, neru needs to be initialized to run this

Read up here: https://vonage-neru.herokuapp.com/neru/overview
