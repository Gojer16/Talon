#!/usr/bin/env node

/**
 * Talon WebSocket Test Client
 * Simple CLI for testing gateway WebSocket protocol
 */

import WebSocket from 'ws';
import readline from 'readline';
import { nanoid } from 'nanoid';

const WS_URL = 'ws://127.0.0.1:19789/ws';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'talon-ws> '
});

let ws = null;
let currentSessionId = null;

// Helper to send message
function send(type, payload = {}) {
    const msg = {
        id: nanoid(),
        type,
        timestamp: Date.now(),
        payload
    };
    ws.send(JSON.stringify(msg));
    console.log(`→ Sent: ${type}`);
}

// Predefined commands
const commands = {
    // Gateway
    status: () => send('gateway.status'),
    
    // Sessions
    sessions: () => send('session.list'),
    create: () => {
        send('session.create', {
            senderId: 'ws-client',
            channel: 'websocket',
            senderName: 'WebSocket Client'
        });
    },
    send: (text) => {
        if (!currentSessionId) {
            console.log('✗ No session. Use "create" first.');
            return;
        }
        send('session.send_message', {
            sessionId: currentSessionId,
            text,
            senderName: 'WebSocket Client'
        });
    },
    reset: () => {
        if (!currentSessionId) {
            console.log('✗ No session. Use "create" first.');
            return;
        }
        send('session.reset', { sessionId: currentSessionId });
    },
    
    // Tools
    tools: () => send('tools.list'),
    invoke: (toolName, args) => send('tools.invoke', { toolName, args }),
    
    // Quick tool shortcuts
    echo: (text) => send('tools.invoke', {
        toolName: 'shell_execute',
        args: { command: `echo '${text}'` }
    }),
    ls: () => send('tools.invoke', {
        toolName: 'shell_execute',
        args: { command: 'ls -la' }
    }),
    pwd: () => send('tools.invoke', {
        toolName: 'shell_execute',
        args: { command: 'pwd' }
    }),
    screenshot: () => send('tools.invoke', {
        toolName: 'desktop_screenshot',
        args: {}
    }),
    'test-safety': () => send('tools.invoke', {
        toolName: 'shell_execute',
        args: { command: 'rm -rf /' }
    }),
};

function connect() {
    console.log(`Connecting to ${WS_URL}...`);
    
    ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
        console.log('✓ Connected to Talon Gateway\n');
        console.log('Gateway Commands:');
        console.log('  status          - Get gateway status');
        console.log('');
        console.log('Session Commands:');
        console.log('  sessions        - List all sessions');
        console.log('  create          - Create new session');
        console.log('  send <text>     - Send message to current session');
        console.log('  reset           - Reset current session');
        console.log('');
        console.log('Tool Commands:');
        console.log('  tools           - List available tools');
        console.log('  invoke <name> <json-args> - Invoke tool');
        console.log('');
        console.log('Quick Shortcuts:');
        console.log('  echo <text>     - Echo text via shell');
        console.log('  ls              - List files');
        console.log('  pwd             - Print working directory');
        console.log('  screenshot      - Take screenshot');
        console.log('  test-safety     - Test dangerous command blocking');
        console.log('');
        console.log('Other:');
        console.log('  raw <json>      - Send raw JSON');
        console.log('  quit            - Exit\n');
        rl.prompt();
    });
    
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            
            // Handle session.created to store sessionId
            if (msg.type === 'session.created') {
                currentSessionId = msg.payload.sessionId;
                console.log(`\n✓ Session created: ${currentSessionId}`);
            }
            
            // Pretty print response
            console.log(`\n← ${msg.type}:`);
            console.log(JSON.stringify(msg.payload, null, 2));
            console.log('');
            rl.prompt();
        } catch (err) {
            console.log('\n← Raw:', data.toString());
            rl.prompt();
        }
    });
    
    ws.on('error', (err) => {
        console.error('✗ WebSocket error:', err.message);
        process.exit(1);
    });
    
    ws.on('close', () => {
        console.log('\n✗ Connection closed');
        process.exit(0);
    });
}

rl.on('line', (line) => {
    const input = line.trim();
    
    if (!input) {
        rl.prompt();
        return;
    }
    
    if (input === 'quit' || input === 'exit') {
        ws.close();
        return;
    }
    
    let message;
    
    if (input.startsWith('raw ')) {
        try {
            message = JSON.parse(input.slice(4));
            ws.send(JSON.stringify({
                id: nanoid(),
                type: message.type,
                timestamp: Date.now(),
                payload: message.payload || {}
            }));
            console.log(`→ Sent: ${message.type}`);
        } catch (err) {
            console.log('✗ Invalid JSON');
        }
        rl.prompt();
        return;
    }
    
    if (input.startsWith('send ')) {
        commands.send(input.slice(5));
        rl.prompt();
        return;
    }
    
    if (input.startsWith('echo ')) {
        commands.echo(input.slice(5));
        rl.prompt();
        return;
    }
    
    if (input.startsWith('invoke ')) {
        const parts = input.slice(7).split(' ');
        const toolName = parts[0];
        const argsJson = parts.slice(1).join(' ');
        try {
            const args = argsJson ? JSON.parse(argsJson) : {};
            commands.invoke(toolName, args);
        } catch (err) {
            console.log('✗ Invalid JSON args');
        }
        rl.prompt();
        return;
    }
    
    if (commands[input]) {
        commands[input]();
    } else {
        console.log('✗ Unknown command. Type a command or "quit" to exit.');
    }
    
    rl.prompt();
});

rl.on('close', () => {
    if (ws) ws.close();
    process.exit(0);
});

connect();
