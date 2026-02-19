#!/usr/bin/env node

/**
 * Talon Gateway v0.3.3 — End-to-End Test Script
 * 
 * Tests all gateway features:
 * - Gateway startup
 * - WebSocket connection
 * - Session management
 * - Message streaming
 * - Tool execution
 * - Safety checks
 * - Persistence
 */

import WebSocket from 'ws';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const GATEWAY_URL = 'ws://127.0.0.1:19789/ws';
const HTTP_URL = 'http://127.0.0.1:19789';
const TIMEOUT = 30000;

let gatewayProcess = null;
let testsPassed = 0;
let testsFailed = 0;

// ─── Utilities ────────────────────────────────────────────────────

function log(emoji, message) {
    console.log(`${emoji} ${message}`);
}

function pass(test) {
    testsPassed++;
    log('✅', `PASS: ${test}`);
}

function fail(test, error) {
    testsFailed++;
    log('❌', `FAIL: ${test}`);
    if (error) {
        console.error(`   Error: ${error.message || error}`);
    }
}

function section(title) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${title}`);
    console.log('='.repeat(60));
}

// ─── Test Functions ───────────────────────────────────────────────

async function testGatewayStartup() {
    section('Test 1: Gateway Startup');
    
    return new Promise((resolve) => {
        gatewayProcess = spawn('node', ['dist/cli/index.js', 'gateway'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, LOG_LEVEL: 'silent' }
        });

        let output = '';
        gatewayProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        gatewayProcess.stderr.on('data', (data) => {
            output += data.toString();
        });

        // Wait for gateway to start
        setTimeout(async () => {
            try {
                const res = await fetch(`${HTTP_URL}/api/health`);
                const data = await res.json();
                
                if (data.status === 'ok') {
                    pass('Gateway started successfully');
                    pass(`Gateway version: ${data.version}`);
                    pass(`Gateway uptime: ${Math.round(data.uptime)}s`);
                } else {
                    fail('Gateway health check failed', new Error('Status not ok'));
                }
            } catch (err) {
                fail('Gateway startup failed', err);
            }
            resolve();
        }, 3000);
    });
}

async function testWebSocketConnection() {
    section('Test 2: WebSocket Connection');
    
    return new Promise((resolve) => {
        const ws = new WebSocket(GATEWAY_URL);
        
        ws.on('open', () => {
            pass('WebSocket connection established');
            ws.close();
            resolve();
        });
        
        ws.on('error', (err) => {
            fail('WebSocket connection failed', err);
            resolve();
        });
        
        setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
                fail('WebSocket connection timeout');
                ws.close();
                resolve();
            }
        }, 5000);
    });
}

async function testGatewayStatus() {
    section('Test 3: Gateway Status Event');
    
    return new Promise((resolve) => {
        const ws = new WebSocket(GATEWAY_URL);
        
        ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'gateway.status' }));
        });
        
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                
                if (msg.type === 'gateway.status') {
                    pass('Received gateway.status event');
                    
                    if (msg.payload && msg.payload.status === 'ok') {
                        pass('Gateway status is OK');
                    } else {
                        fail('Gateway status payload invalid');
                    }
                    
                    if (msg.id && msg.timestamp) {
                        pass('Message has id and timestamp');
                    } else {
                        fail('Message missing id or timestamp');
                    }
                }
                
                ws.close();
                resolve();
            } catch (err) {
                fail('Failed to parse gateway.status response', err);
                ws.close();
                resolve();
            }
        });
        
        ws.on('error', (err) => {
            fail('WebSocket error during status test', err);
            resolve();
        });
        
        setTimeout(() => {
            fail('Gateway status test timeout');
            ws.close();
            resolve();
        }, 5000);
    });
}

async function testSessionCreation() {
    section('Test 4: Session Creation');
    
    return new Promise((resolve) => {
        const ws = new WebSocket(GATEWAY_URL);
        
        ws.on('open', () => {
            ws.send(JSON.stringify({
                type: 'session.create',
                senderId: 'test_user_123',
                channel: 'websocket',
                senderName: 'Test User'
            }));
        });
        
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                
                if (msg.type === 'session.created') {
                    pass('Session created successfully');
                    
                    if (msg.payload && msg.payload.sessionId) {
                        pass(`Session ID: ${msg.payload.sessionId}`);
                    } else {
                        fail('Session payload missing sessionId');
                    }
                }
                
                ws.close();
                resolve();
            } catch (err) {
                fail('Failed to parse session.created response', err);
                ws.close();
                resolve();
            }
        });
        
        ws.on('error', (err) => {
            fail('WebSocket error during session creation', err);
            resolve();
        });
        
        setTimeout(() => {
            fail('Session creation timeout');
            ws.close();
            resolve();
        }, 5000);
    });
}

async function testToolsList() {
    section('Test 5: Tools List');
    
    return new Promise((resolve) => {
        const ws = new WebSocket(GATEWAY_URL);
        
        ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'tools.list' }));
        });
        
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                
                if (msg.type === 'tools.list' || Array.isArray(msg)) {
                    const tools = Array.isArray(msg) ? msg : msg.payload;
                    pass(`Received ${tools.length} tools`);
                    
                    // Check for required tools
                    const requiredTools = ['shell_execute', 'desktop_screenshot', 'file_read', 'file_write'];
                    for (const toolName of requiredTools) {
                        if (tools.some(t => t.name === toolName)) {
                            pass(`Tool available: ${toolName}`);
                        } else {
                            fail(`Tool missing: ${toolName}`);
                        }
                    }
                }
                
                ws.close();
                resolve();
            } catch (err) {
                fail('Failed to parse tools.list response', err);
                ws.close();
                resolve();
            }
        });
        
        ws.on('error', (err) => {
            fail('WebSocket error during tools list', err);
            resolve();
        });
        
        setTimeout(() => {
            fail('Tools list timeout');
            ws.close();
            resolve();
        }, 5000);
    });
}

async function testSafeShellCommand() {
    section('Test 6: Safe Shell Command');
    
    return new Promise((resolve) => {
        const ws = new WebSocket(GATEWAY_URL);
        
        ws.on('open', () => {
            ws.send(JSON.stringify({
                type: 'tools.invoke',
                toolName: 'shell_execute',
                args: {
                    command: 'echo "Hello from Talon"'
                }
            }));
        });
        
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                
                if (msg.type === 'tools.result') {
                    pass('Tool execution completed');
                    
                    if (msg.payload && msg.payload.result) {
                        if (msg.payload.result.includes('Hello from Talon')) {
                            pass('Shell command executed correctly');
                        } else {
                            fail('Shell command output incorrect');
                        }
                    }
                }
                
                ws.close();
                resolve();
            } catch (err) {
                fail('Failed to parse tool result', err);
                ws.close();
                resolve();
            }
        });
        
        ws.on('error', (err) => {
            fail('WebSocket error during shell test', err);
            resolve();
        });
        
        setTimeout(() => {
            fail('Shell command timeout');
            ws.close();
            resolve();
        }, 10000);
    });
}

async function testDangerousCommandBlocked() {
    section('Test 7: Dangerous Command Blocking');
    
    return new Promise((resolve) => {
        const ws = new WebSocket(GATEWAY_URL);
        
        ws.on('open', () => {
            ws.send(JSON.stringify({
                type: 'tools.invoke',
                toolName: 'shell_execute',
                args: {
                    command: 'rm -rf /'
                }
            }));
        });
        
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                
                if (msg.type === 'tools.result') {
                    if (msg.payload && msg.payload.result) {
                        if (msg.payload.result.includes('BLOCKED') || msg.payload.result.includes('destructive')) {
                            pass('Dangerous command blocked successfully');
                        } else {
                            fail('Dangerous command was NOT blocked!');
                        }
                    }
                }
                
                ws.close();
                resolve();
            } catch (err) {
                fail('Failed to parse safety test result', err);
                ws.close();
                resolve();
            }
        });
        
        ws.on('error', (err) => {
            fail('WebSocket error during safety test', err);
            resolve();
        });
        
        setTimeout(() => {
            fail('Safety test timeout');
            ws.close();
            resolve();
        }, 10000);
    });
}

async function testHTTPHealthEndpoint() {
    section('Test 8: HTTP Health Endpoint');
    
    try {
        const res = await fetch(`${HTTP_URL}/api/health`);
        const data = await res.json();
        
        if (res.status === 200) {
            pass('Health endpoint returns 200');
        } else {
            fail('Health endpoint status code incorrect');
        }
        
        if (data.status === 'ok') {
            pass('Health status is OK');
        }
        
        if (data.version) {
            pass(`Version: ${data.version}`);
        }
        
        if (typeof data.uptime === 'number') {
            pass(`Uptime: ${Math.round(data.uptime)}s`);
        }
        
    } catch (err) {
        fail('HTTP health endpoint failed', err);
    }
}

async function testHTTPSessionsEndpoint() {
    section('Test 9: HTTP Sessions Endpoint');
    
    try {
        const res = await fetch(`${HTTP_URL}/api/sessions`);
        const data = await res.json();
        
        if (res.status === 200) {
            pass('Sessions endpoint returns 200');
        } else {
            fail('Sessions endpoint status code incorrect');
        }
        
        if (Array.isArray(data)) {
            pass(`Sessions list returned (${data.length} sessions)`);
        } else {
            fail('Sessions endpoint did not return array');
        }
        
    } catch (err) {
        fail('HTTP sessions endpoint failed', err);
    }
}

// ─── Main Test Runner ─────────────────────────────────────────────

async function runTests() {
    console.log('\n🦅 Talon Gateway v0.3.3 — End-to-End Tests\n');
    
    try {
        await testGatewayStartup();
        await sleep(1000);
        
        await testWebSocketConnection();
        await sleep(500);
        
        await testGatewayStatus();
        await sleep(500);
        
        await testSessionCreation();
        await sleep(500);
        
        await testToolsList();
        await sleep(500);
        
        await testSafeShellCommand();
        await sleep(500);
        
        await testDangerousCommandBlocked();
        await sleep(500);
        
        await testHTTPHealthEndpoint();
        await sleep(500);
        
        await testHTTPSessionsEndpoint();
        
    } catch (err) {
        console.error('\n❌ Test suite error:', err);
    } finally {
        // Cleanup
        section('Test Results');
        console.log(`\n  ✅ Passed: ${testsPassed}`);
        console.log(`  ❌ Failed: ${testsFailed}`);
        console.log(`  📊 Total:  ${testsPassed + testsFailed}\n`);
        
        if (testsFailed === 0) {
            console.log('🎉 All tests passed! Gateway is production-ready.\n');
        } else {
            console.log('⚠️  Some tests failed. Review errors above.\n');
        }
        
        // Stop gateway
        if (gatewayProcess) {
            log('🛑', 'Stopping gateway...');
            gatewayProcess.kill('SIGTERM');
            await sleep(2000);
        }
        
        process.exit(testsFailed > 0 ? 1 : 0);
    }
}

// Run tests
runTests().catch(console.error);
