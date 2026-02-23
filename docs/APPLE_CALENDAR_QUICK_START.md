# Apple Calendar Tool - Quick Start Guide

## 🚀 What's New

The Apple Calendar integration has been completely rebuilt with:
- **Flexible date parsing** - Use natural language like "tomorrow at 3pm"
- **Structured JSON responses** - Full metadata and error details
- **Recurring events** - Daily, weekly, monthly patterns
- **Better error handling** - Clear error codes and recovery steps
- **Event verification** - Returns event UIDs to confirm creation

---

## 📅 Creating Events

### Basic Event
```javascript
apple_calendar_create_event({
    title: "Team Meeting",
    startDate: "2026-02-25 14:00"
})
```

### Natural Language Dates
```javascript
apple_calendar_create_event({
    title: "Lunch with Client",
    startDate: "tomorrow at 12:30pm"
})

apple_calendar_create_event({
    title: "Weekly Review",
    startDate: "next Friday at 4pm"
})
```

### With Location and Notes
```javascript
apple_calendar_create_event({
    title: "Product Demo",
    startDate: "2026-03-01 15:00",
    location: "Conference Room B",
    notes: "Bring laptop and presentation slides"
})
```

### Recurring Events
```javascript
// Weekly standup for 10 weeks
apple_calendar_create_event({
    title: "Team Standup",
    startDate: "next Monday at 9am",
    recurrence: {
        type: "weekly",
        count: 10
    }
})

// Daily reminder until end of month
apple_calendar_create_event({
    title: "Daily Check-in",
    startDate: "tomorrow at 8am",
    recurrence: {
        type: "daily",
        endDate: "2026-02-28"
    }
})
```

---

## 📋 Listing Events

```javascript
// List next 7 days from all calendars
apple_calendar_list_events({
    days: 7
})

// List next 30 days from specific calendar
apple_calendar_list_events({
    calendar: "Work",
    days: 30
})
```

**Response:**
```json
{
    "success": true,
    "message": "Found 3 upcoming event(s)",
    "events": [
        {
            "id": "E621F8F0-...",
            "title": "Team Meeting",
            "startDate": "Monday, February 24, 2026 at 2:00:00 PM",
            "location": "Office"
        }
    ]
}
```

---

## 🗑️ Deleting Events

```javascript
apple_calendar_delete_event({
    title: "Team Meeting",
    calendar: "Talon"
})
```

---

## 🎯 Supported Date Formats

| Format | Example | Description |
|--------|---------|-------------|
| ISO 8601 | `2026-02-25 14:00` | Standard format |
| ISO with T | `2026-02-25T14:00` | Alternative ISO |
| Tomorrow | `tomorrow at 3pm` | Relative date |
| Today | `today at 9am` | Today with time |
| Next week | `next week` | 7 days ahead |
| Weekday | `next Monday` | Next occurrence |
| Weekday + time | `Friday at 5:30pm` | Specific weekday |
| Month day | `Feb 25` | Month abbreviation |
| Month day + time | `March 15 at 10am` | Full month name |

---

## ⚠️ Error Handling

### Permission Denied
If you see this error:
```json
{
    "success": false,
    "error": {
        "code": "PERMISSION_DENIED",
        "recovery": [
            "Open System Settings",
            "Go to Privacy & Security → Automation",
            "Find Terminal (or your terminal app)",
            "Enable the Calendar checkbox",
            "Restart your terminal and try again"
        ]
    }
}
```

**Fix:** Follow the recovery steps to grant Calendar access.

### Invalid Date
```json
{
    "success": false,
    "error": {
        "code": "INVALID_START_DATE",
        "message": "Unable to parse date: \"xyz\". Try formats like..."
    }
}
```

**Fix:** Use one of the supported date formats above.

### Event Not Found
```json
{
    "success": false,
    "error": {
        "code": "EVENT_NOT_FOUND",
        "message": "No event with title \"Meeting\" found..."
    }
}
```

**Fix:** Check the event title and calendar name are correct.

---

## 🧪 Testing

Run the test suite:
```bash
# All calendar tests
npm test -- apple-calendar

# Date parser tests
npm test -- date-parser

# Edge case evaluation
npm test -- apple-calendar-edge

# Integration tests (requires macOS + Calendar access)
npm test -- apple-calendar-real
```

---

## 📊 Response Structure

Every tool returns structured JSON:

```typescript
{
    success: boolean;           // Operation succeeded?
    message: string;            // Human-readable message
    eventId?: string;           // Event UID (for verification)
    calendar?: string;          // Calendar name
    startDate?: string;         // ISO 8601 start date
    endDate?: string;           // ISO 8601 end date
    recurrence?: {...};         // Recurrence details
    error?: {
        code: string;           // Error code
        message: string;        // Error details
        recovery?: string[];    // Fix steps
    };
    metadata: {
        duration_ms: number;    // Execution time
        timestamp: string;      // When executed
        parsedDates?: {...};    // Date parsing details
    };
}
```

---

## 💡 Tips

1. **Use natural language** - "tomorrow at 3pm" is easier than "2026-02-23 15:00"
2. **Check event IDs** - Save the `eventId` from responses to verify events were created
3. **Test with Talon calendar** - Use `calendar: "Talon"` to keep test events separate
4. **Handle errors gracefully** - Always check `success` field before using data
5. **Use recurrence wisely** - Specify either `count` or `endDate`, not both

---

## 🐛 Troubleshooting

**Q: Events aren't showing up in Calendar app**
- Check the response `eventId` - if present, event was created
- Verify you're looking at the correct calendar (default is "Talon")
- Check Calendar app permissions in System Settings

**Q: "Permission denied" error**
- Follow the recovery steps in the error message
- Restart your terminal after granting permissions
- Try running `osascript -e 'tell application "Calendar" to get name of calendars'` to test

**Q: Date parsing fails**
- Check the error message for suggestions
- Use ISO format `YYYY-MM-DD HH:MM` if unsure
- Avoid ambiguous formats like "3/4" (use "March 4" or "2026-03-04")

**Q: Tests timeout**
- Integration tests require real Calendar access
- Increase timeout: `it('test', async () => {...}, 20000)` (20 seconds)
- Skip integration tests if Calendar access unavailable

---

## 📚 More Information

- Full implementation details: `docs/APPLE_CALENDAR_IMPLEMENTATION.md`
- Source code: `src/tools/apple-calendar.ts`
- Date parser: `src/tools/utils/date-parser.ts`
- Tests: `tests/unit/apple-calendar-tools.test.ts`

---

**Ready to use!** Try creating your first event with natural language dates. 🎉
