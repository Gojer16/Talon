# Channel Troubleshooting Guide

## Quick Diagnosis

Run the test script:
```bash
./scripts/test-channels.sh
```

## Common Issues

### Telegram Not Working

#### Issue 1: Bot Token Missing
**Symptom**: Bot doesn't respond to messages

**Check**:
```bash
cat ~/.talon/.env | grep TELEGRAM_BOT_TOKEN
```

**Fix**:
1. Create a bot via [@BotFather](https://t.me/BotFather)
   - Open Telegram and search for @BotFather
   - Send: `/newbot`
   - Follow prompts to name your bot
   - Copy the token (looks like: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

2. Add to `~/.talon/.env`:
   ```bash
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
   ```

3. Restart Talon:
   ```bash
   talon restart
   ```

#### Issue 2: User Not Authorized
**Symptom**: Bot receives message but doesn't respond

**Check logs**:
```bash
# Look for "Ignoring message from unauthorized Telegram user"
```

**Fix**:
1. Get your Telegram user ID:
   - Message [@userinfobot](https://t.me/userinfobot)
   - It will reply with your ID (e.g., `123456789`)

2. Add to `~/.talon/config.json`:
   ```json
   "telegram": {
     "enabled": true,
     "botToken": "${TELEGRAM_BOT_TOKEN}",
     "allowedUsers": ["123456789"]
   }
   ```

3. Restart Talon

#### Issue 3: Polling Not Starting
**Symptom**: No "Telegram polling..." in logs

**Check logs**:
```bash
# Look for "Telegram enabled but no bot token provided"
```

**Fix**: Ensure both config.json AND .env are properly set (see Issue 1)

### WhatsApp Not Working

#### Issue 1: No Allowed Users
**Symptom**: WhatsApp connects but ignores messages

**Check**:
```bash
cat ~/.talon/config.json | grep -A 5 '"whatsapp"'
```

**Fix**:
1. Add your phone number to allowedUsers:
   ```json
   "whatsapp": {
     "enabled": true,
     "allowedUsers": ["584128449024"]
   }
   ```
   Format: Country code + number, no `+` (e.g., `584128449024` for Venezuela)

2. Restart Talon

#### Issue 2: QR Code Not Scanned
**Symptom**: "WhatsApp channel starting in background..." but no QR

**Check logs**:
```bash
# Look for "WhatsApp QR code received"
```

**Fix**:
1. Make sure dependencies are installed:
   ```bash
   npm install whatsapp-web.js qrcode-terminal
   ```

2. Restart Talon and watch for QR code

3. Scan with WhatsApp phone app:
   - Open WhatsApp on phone
   - Settings → Linked Devices → Link a Device
   - Scan the QR code in terminal

#### Issue 3: Session Corrupted
**Symptom**: WhatsApp keeps asking to scan QR

**Fix**:
```bash
# Delete corrupted session
rm -rf ~/.talon/auth/whatsapp

# Restart Talon
talon restart
```

## Debug Mode

Run Talon with verbose logging:
```bash
DEBUG=true npm start
```

Look for these log messages:

### Telegram Debug Flow
```
✅ "Telegram bot info fetched" - Bot token working
✅ "Telegram polling..." - Polling active
✅ "Telegram received updates" - Getting messages
✅ "Telegram message received" - Message detected
✅ "Telegram message passing authorization" - User authorized
✅ "Telegram message ingested successfully" - Message sent to agent
✅ "Telegram message sent" - Response delivered
```

### WhatsApp Debug Flow
```
✅ "WhatsApp channel starting..." - Starting
✅ "WhatsApp QR code received" - Waiting for scan
✅ "WhatsApp client ready" - Authenticated
✅ "WhatsApp message received" - Message detected
✅ "WhatsApp message passing authorization" - User authorized
✅ "WhatsApp message ingested" - Message sent to agent
✅ "WhatsApp message sent" - Response delivered
```

## Testing with curl (Telegram)

Test bot directly:
```bash
# Replace YOUR_BOT_TOKEN
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/getMe"

# Should return: {"ok":true,"result":{...}}
```

Get recent updates:
```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates"
```

Send yourself a test message:
```bash
# Replace YOUR_BOT_TOKEN and YOUR_CHAT_ID
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/sendMessage" \
  -d "chat_id=YOUR_CHAT_ID" \
  -d "text=Test message from curl"
```

## Configuration Reference

### ~/.talon/.env
```bash
# Required for Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# Required for WhatsApp (your phone number)
WHATSAPP_PHONE_NUMBER=584128449024
```

### ~/.talon/config.json
```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "${TELEGRAM_BOT_TOKEN}",
      "allowedUsers": ["123456789"],
      "allowedGroups": [],
      "groupActivation": "mention"
    },
    "whatsapp": {
      "enabled": true,
      "allowedUsers": ["584128449024"],
      "allowedGroups": [],
      "groupActivation": "mention"
    }
  }
}
```

## Still Not Working?

1. **Check Talon is running**:
   ```bash
   pgrep -f talon
   ```

2. **Check ports**:
   ```bash
   lsof -i :19789
   ```

3. **Restart everything**:
   ```bash
   talon stop
   talon start
   ```

4. **Check logs**:
   ```bash
   # Last 50 lines of Talon logs
   tail -n 50 ~/.talon/logs/talon.log
   ```

5. **Run integration test**:
   ```bash
   ./scripts/test-channels.sh
   ```

## Expected Behavior

### When Working Correctly:

**Telegram:**
1. You send message to bot
2. Within 1-2 seconds, bot responds
3. Logs show: "message received" → "ingested" → "agent loop" → "message sent"

**WhatsApp:**
1. You send message
2. Within 1-2 seconds, bot responds
3. Logs show same flow as Telegram
4. Typing indicator appears while agent thinks

### Response Times:
- **Telegram**: 1-3 seconds (depends on API)
- **WhatsApp**: 1-3 seconds (depends on connection)
- **CLI**: Instant
