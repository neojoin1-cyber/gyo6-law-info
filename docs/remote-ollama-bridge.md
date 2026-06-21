# Remote Ollama Bridge

This project can let the public Firebase endpoint use the office desktop's Ollama instance without exposing Ollama itself.

## Shape

1. Public users call `https://gyo6-law-info.web.app/api/policy`.
2. Firebase Functions runs the free policy engine first.
3. If `REMOTE_LOCAL_LLM_ENABLED=true`, Functions calls the office PC bridge at `REMOTE_LOCAL_LLM_BASE_URL`.
4. The bridge runs on the office PC, verifies a bearer token, calls local Ollama at `127.0.0.1:11434`, and returns an enriched policy result.
5. If the bridge is down, slow, or unauthenticated, Firebase returns the free policy-engine answer.

Do not publish Ollama's raw `11434` port. Publish only the bridge endpoint.

## Office PC

Add these values to `.env.local`:

```powershell
LOCAL_LLM_ENABLED=auto
LOCAL_LLM_BASE_URL=http://127.0.0.1:11434
LOCAL_LLM_MODEL=qwen3:4b-instruct
LOCAL_LLM_NORMALIZER_ENABLED=auto
LOCAL_LLM_NORMALIZER_MODE=auto
LOCAL_LLM_BRIDGE_PORT=8789
LOCAL_LLM_BRIDGE_TOKEN=<long-random-shared-token>
```

Start or repair the whole office-PC Ollama path:

```powershell
npm run ollama:stack:start
```

This checks or starts, in order:

1. local Ollama at `127.0.0.1:11434`
2. the GYO6 local bridge at `127.0.0.1:8789`
3. the Cloudflare Tunnel for `https://ollama-bridge.gyo6.kr`
4. a short warm-up request for `qwen3:4b-instruct`

Status only:

```powershell
npm run ollama:stack
```

Full external verification:

```powershell
npm run ollama:stack:verify
```

Register the stack to start after Windows login:

```powershell
npm run ollama:stack:install-startup
```

The installer first tries Windows Task Scheduler. If `schtasks` is unavailable or broken, it falls back to the current user's Startup folder with `GYO6-Ollama-Stack.cmd`.

The older bridge-only command is still available when you intentionally want only the local bridge without the Cloudflare tunnel:

```powershell
npm run ollama:bridge
```

Local authenticated health check:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8789/api/health -Headers @{ Authorization = "Bearer <long-random-shared-token>" }
```

## Tunnel

Use Cloudflare Tunnel or an equivalent authenticated tunnel to route a private hostname such as:

```text
https://ollama-bridge.gyo6.kr -> http://127.0.0.1:8789
```

Keep the bridge bound to `127.0.0.1` on the office PC. The tunnel should be the only public path.

For this deployment the named tunnel is:

```text
gyo6-ollama-bridge
```

If the PC was rebooted and public answers are stuck at "local AI pending", run:

```powershell
npm run ollama:stack:verify
```

The response should report `remoteBridge.ok=true` and `externalPolicy.remoteLocalLlm.ok=true`.

## Firebase Functions

Configure the public function runtime:

```powershell
firebase functions:secrets:set REMOTE_LOCAL_LLM_TOKEN
```

Then set non-secret runtime values for the function:

```text
REMOTE_LOCAL_LLM_ENABLED=true
REMOTE_LOCAL_LLM_BASE_URL=https://ollama-bridge.gyo6.kr
REMOTE_LOCAL_LLM_TIMEOUT_MS=24000
```

After deployment, test:

```powershell
$body = @{ question = "쌤 병까 서류 뭐 필요?" } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri https://gyo6-law-info.web.app/api/policy -Method Post -ContentType "application/json; charset=utf-8" -Body $body
```

The response should include `remoteLocalLlm.ok=true` when the bridge is used.

## Safety Notes

- The bridge accepts only `POST /api/policy/llm` and authenticated health checks.
- The bridge rejects bodies larger than 64 KB.
- The token must be long, random, and different from Firebase, Google, Cloudflare, and Ollama credentials.
- The public endpoint falls back to the free policy engine when the office PC is offline.
- Treat teacher/student questions as sensitive operational data. Do not log full question bodies in tunnel or bridge logs.
