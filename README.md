# Salesforce-style demo API for Genesys screen pops

This Node.js demo exposes a small Salesforce-shaped API that is suitable for a Genesys Cloud Data Action test. It uses an OAuth-style bearer token and returns a screen-pop URL for a phone number.

## Run locally

```powershell
Copy-Item .env.example .env
node server.js
```

The default server is `http://localhost:5080`. The demo credentials are in `.env.example`; change them before exposing the service publicly.

## Token request

`POST /services/oauth2/token` with `application/x-www-form-urlencoded`:

```text
grant_type=password
client_id=genesys-demo-client
client_secret=genesys-demo-secret
username=genesys@example.com
password=ChangeMe123!
```

The API also accepts `grant_type=client_credentials` with the client ID and secret.

## Genesys Data Action request

Configure an HTTP Data Action with:

1. Authentication: OAuth 2.0 or a first action that calls the token endpoint and passes `Authorization: Bearer {{access_token}}`.
2. Request: `GET {{baseUrl}}/services/data/v1.0/screenpop?phone={{contact.phoneNumber}}`
3. Header: `Authorization: Bearer <token>`.

The success response is:

```json
{
  "success": true,
  "contact": { "id": "003000000000001", "firstName": "Ada", "lastName": "Lovelace" },
  "screenPopUrl": "https://your-public-host/screenpop/003000000000001",
  "screenPop": { "url": "https://your-public-host/screenpop/003000000000001", "target": "screenpop" }
}
```

In Genesys, map `screenPopUrl` to the action output and use it as the screen-pop URL in the inbound call flow. For a local test, Genesys must be able to reach the API through a public HTTPS tunnel or deployed host; `localhost` is only reachable from your own machine.

## Test

```powershell
npm test
```

## Routes

- `GET /health`
- `POST /services/oauth2/token`
- `GET /services/data/v1.0/screenpop?phone=...` (authenticated)
- `GET /api/screenpop?phone=...` (authenticated alias)
- `GET /services/data/v1.0/sobjects/Contact/{id}` (authenticated)
- `GET /screenpop/{id}` (browser screen-pop page)

## GitHub

This workspace does not yet have a GitHub remote. After creating an empty GitHub repository, run:

```powershell
git init
git add .
git commit -m "Add Salesforce-style Genesys screen pop API"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

Do not commit `.env`; it is ignored by Git.
