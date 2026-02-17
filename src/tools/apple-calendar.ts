import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

function escapeAppleScript(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export const appleCalendarTools = [
    {
        name: 'apple_calendar_create_event',
        description: 'Create an event in Apple Calendar (macOS only)',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Event title' },
                startDate: { type: 'string', description: 'Start date/time in format "YYYY-MM-DD HH:MM"' },
                endDate: { type: 'string', description: 'End date/time in format "YYYY-MM-DD HH:MM" (optional, defaults to 1 hour after start)' },
                location: { type: 'string', description: 'Event location (optional)' },
                notes: { type: 'string', description: 'Event notes/description (optional)' },
                calendar: { type: 'string', description: 'Calendar name (default: "Talon")' },
            },
            required: ['title', 'startDate'],
        },
        async execute(args: Record<string, unknown>): Promise<string> {
            if (process.platform !== 'darwin') {
                return 'Error: Apple Calendar is only available on macOS';
            }

            const title = escapeAppleScript(args.title as string);
            const startDate = args.startDate as string;
            const calendarName = escapeAppleScript((args.calendar as string) || 'Talon');
            
            // Calculate end date (1 hour after start if not provided)
            let endDate = args.endDate as string | undefined;
            if (!endDate) {
                const start = new Date(startDate);
                start.setHours(start.getHours() + 1);
                endDate = start.toISOString().slice(0, 16).replace('T', ' ');
            }

            let script = `tell application "Calendar"
    if not (exists calendar "${calendarName}") then
        make new calendar with properties {name:"${calendarName}"}
    end if
    set targetCalendar to calendar "${calendarName}"
    set startDateTime to date "${startDate}"
    set endDateTime to date "${endDate}"
    set newEvent to make new event at end of events of targetCalendar with properties {summary:"${title}", start date:startDateTime, end date:endDateTime}`;

            if (args.location) {
                const location = escapeAppleScript(args.location as string);
                script += `\n    set location of newEvent to "${location}"`;
            }

            if (args.notes) {
                const notes = escapeAppleScript(args.notes as string);
                script += `\n    set description of newEvent to "${notes}"`;
            }

            script += '\nend tell';

            try {
                await execAsync(`osascript -e '${script}'`);
                logger.info({ title, startDate, calendar: calendarName }, 'Calendar event created');
                return `Event created: "${args.title}" on ${startDate} (calendar: ${calendarName})`;
            } catch (error) {
                logger.error({ error }, 'Failed to create calendar event');
                return `Error: ${(error as Error).message}`;
            }
        },
    },
    {
        name: 'apple_calendar_list_events',
        description: 'List upcoming events from Apple Calendar (macOS only)',
        parameters: {
            type: 'object',
            properties: {
                calendar: { type: 'string', description: 'Calendar name (default: all calendars)' },
                days: { type: 'number', description: 'Number of days to look ahead (default: 7)' },
            },
        },
        async execute(args: Record<string, unknown>): Promise<string> {
            if (process.platform !== 'darwin') {
                return 'Error: Apple Calendar is only available on macOS';
            }

            const days = (args.days as number) || 7;
            const calendarFilter = args.calendar ? `calendar "${escapeAppleScript(args.calendar as string)}"` : 'calendars';

            const script = `tell application "Calendar"
    set startDate to current date
    set endDate to startDate + (${days} * days)
    set eventList to {}
    repeat with anEvent in (every event of ${calendarFilter} whose start date ≥ startDate and start date ≤ endDate)
        set eventTitle to summary of anEvent
        set eventStart to start date of anEvent as text
        set eventLocation to location of anEvent
        if eventLocation is missing value then
            set eventLocation to ""
        end if
        set eventInfo to eventTitle & " | " & eventStart
        if eventLocation is not "" then
            set eventInfo to eventInfo & " | " & eventLocation
        end if
        set end of eventList to eventInfo
    end repeat
    if (count of eventList) = 0 then
        return "No upcoming events"
    else
        return eventList as text
    end if
end tell`;

            try {
                const { stdout } = await execAsync(`osascript -e '${script}'`);
                return stdout.trim() || 'No upcoming events';
            } catch (error) {
                logger.error({ error }, 'Failed to list calendar events');
                return `Error: ${(error as Error).message}`;
            }
        },
    },
    {
        name: 'apple_calendar_delete_event',
        description: 'Delete an event from Apple Calendar by title (macOS only)',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Event title to delete' },
                calendar: { type: 'string', description: 'Calendar name (default: "Talon")' },
            },
            required: ['title'],
        },
        async execute(args: Record<string, unknown>): Promise<string> {
            if (process.platform !== 'darwin') {
                return 'Error: Apple Calendar is only available on macOS';
            }

            const title = escapeAppleScript(args.title as string);
            const calendarName = escapeAppleScript((args.calendar as string) || 'Talon');

            const script = `tell application "Calendar"
    if not (exists calendar "${calendarName}") then
        return "Calendar not found"
    end if
    set targetCalendar to calendar "${calendarName}"
    set found to false
    repeat with anEvent in events of targetCalendar
        if summary of anEvent is "${title}" then
            delete anEvent
            set found to true
            exit repeat
        end if
    end repeat
    if found then
        return "Deleted"
    else
        return "Not found"
    end if
end tell`;

            try {
                const { stdout } = await execAsync(`osascript -e '${script}'`);
                if (stdout.trim() === 'Deleted') {
                    logger.info({ title, calendar: calendarName }, 'Calendar event deleted');
                    return `Event deleted: "${args.title}"`;
                } else {
                    return `Event not found: "${args.title}" in calendar "${calendarName}"`;
                }
            } catch (error) {
                logger.error({ error }, 'Failed to delete calendar event');
                return `Error: ${(error as Error).message}`;
            }
        },
    },
];
