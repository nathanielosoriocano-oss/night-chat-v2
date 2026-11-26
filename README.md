# Night Chat V2 — foundation build

Node.js 20+ / Express / Socket.IO application.

## Included in this build
- Account registration and login using scrypt password hashes
- Persistent JSON data file for users, group membership, and message history
- Owner-only group creation (owner username is reserved as `natosorio8`)
- Group passwords and separate group histories
- Member accounts, profile fields, light/dark theme preference
- Real-time text and image messages (images limited to 5 MB in the browser)
- Presence list and an initial WebRTC audio/video signaling implementation

## Run locally

```bash
npm install
```

Set a private first-time owner setup key in your terminal before starting the server:

PowerShell:
```powershell
$env:OWNER_SETUP_KEY="use-a-long-random-private-value"
npm start
```

macOS/Linux:
```bash
OWNER_SETUP_KEY="use-a-long-random-private-value" npm start
```

Open http://localhost:3000. First-time setup requires the setup key and a separate owner password (12+ characters). The owner username is fixed to `natosorio8`. Do not share either secret.

After creating the owner account, create a group and share its exact group name and group password with invited members. Members register using the group name and group password, plus their own usernames and account passwords. Group names must be unique. Angel can register as `angelosorio`.

## Deployment requirements and limitations

- Deploy to a public Node host with HTTPS. Localhost is only for local testing; different networks need a public deployment.
- Set `OWNER_SETUP_KEY` as a private server environment variable for first-time owner setup. Do not put it in source control. After owner creation, remove the variable from the deployment environment.
- The JSON file store is suitable only as a small single-instance prototype. Use a persistent disk and backups, or migrate to PostgreSQL before relying on it for real accounts and important history. Multiple server instances are not supported by this store.
- Image data is stored in the JSON data file, so production should use dedicated object storage and upload validation.
- The calling interface is an initial WebRTC prototype, not a production-ready calling service. Reliable calls across restrictive networks require a configured TURN service, and peer selection, incoming-call state, call recovery, and broader cross-browser testing remain to be completed. HTTPS and microphone/camera permission are required.
- No private direct messages, admin delegation, owner member-management UI, group deletion/password rotation UI, or production database migration is included yet.
- Use a reputable hosting provider and do not publish personal information in group names, profile fields, or images.
