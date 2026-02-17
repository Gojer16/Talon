// ─── WhatsApp Channel ─────────────────────────────────────────────
// WhatsApp integration using whatsapp-web.js
// Requires: npm install whatsapp-web.js qrcode-terminal

import { BaseChannel } from '../base.js';
import type { OutboundMessage } from '../../utils/types.js';
import { logger } from '../../utils/logger.js';

// Dynamic import for whatsapp-web.js to handle optional dependency
let Client: any;
let LocalAuth: any;
let QRCodeTerminal: any;

try {
    const wa = await import('whatsapp-web.js');
    Client = wa.Client;
    LocalAuth = wa.LocalAuth;
} catch {
    logger.warn('whatsapp-web.js not installed. Run: npm install whatsapp-web.js qrcode-terminal');
}

try {
    const qr = await import('qrcode-terminal');
    QRCodeTerminal = qr.default || qr;
} catch {
    // qrcode-terminal is optional
}

interface WhatsAppMessage {
    from: string;
    to: string;
    body: string;
    hasMedia: boolean;
    timestamp: number;
    deviceType: string;
    isGroupMsg: boolean;
    author?: string; // For groups: the actual sender
}

export class WhatsAppChannel extends BaseChannel {
    public readonly name = 'whatsapp';
    private client: any = null;
    private isReady = false;
    private qrCode: string | null = null;
    private authDir: string;

    constructor(config: any, eventBus: any, sessionManager: any, router: any) {
        super(config, eventBus, sessionManager, router);
        this.authDir = `${config.workspace.root}/whatsapp-auth`;
    }

    public async start(): Promise<void> {
        if (!this.config.channels.whatsapp?.enabled) {
            logger.info('WhatsApp channel disabled');
            return;
        }

        if (!Client) {
            logger.error('whatsapp-web.js not installed. Run: npm install whatsapp-web.js qrcode-terminal');
            console.log('\n❌ WhatsApp requires additional dependencies:');
            console.log('   npm install whatsapp-web.js qrcode-terminal\n');
            return;
        }

        logger.info('Starting WhatsApp channel...');
        logger.info('Scan the QR code with your phone to authenticate');

        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: this.authDir,
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process', // May help with Docker/containerization
                    '--disable-gpu',
                ],
            },
        });

        // QR Code event
        this.client.on('qr', (qr: string) => {
            this.qrCode = qr;
            logger.info('WhatsApp QR code received - scan with your phone');
            
            if (QRCodeTerminal) {
                console.log('\n📱 Scan this QR code with WhatsApp on your phone:\n');
                QRCodeTerminal.generate(qr, { small: true });
                console.log('\nWaiting for authentication...\n');
            } else {
                console.log('\n📱 QR Code:', qr);
                console.log('Install qrcode-terminal to see the QR code: npm install qrcode-terminal\n');
            }
        });

        // Ready event
        this.client.on('ready', () => {
            this.isReady = true;
            this.qrCode = null;
            logger.info('✅ WhatsApp client ready and authenticated');
            console.log('\n🟢 WhatsApp connected successfully!\n');
        });

        // Auth failure
        this.client.on('auth_failure', (msg: string) => {
            logger.error({ message: msg }, 'WhatsApp authentication failed');
            console.log('\n❌ WhatsApp authentication failed');
            console.log('   Delete the auth folder and try again:', this.authDir);
        });

        // Disconnected
        this.client.on('disconnected', (reason: string) => {
            this.isReady = false;
            logger.warn({ reason }, 'WhatsApp disconnected');
            console.log('\n🟡 WhatsApp disconnected:', reason);
            console.log('   Restart Talon to reconnect\n');
        });

        // Message received
        this.client.on('message_create', async (msg: any) => {
            // Ignore messages from self
            if (msg.fromMe) return;

            await this.handleMessage(msg);
        });

        // Initialize
        await this.client.initialize();
    }

    public async stop(): Promise<void> {
        if (this.client) {
            logger.info('Stopping WhatsApp client...');
            await this.client.destroy();
            this.isReady = false;
        }
    }

    public async send(sessionId: string, message: OutboundMessage): Promise<void> {
        if (!this.isReady || !this.client) {
            logger.error('WhatsApp not ready, cannot send message');
            return;
        }

        const session = this.sessionManager.getSession(sessionId);
        if (!session) {
            logger.error({ sessionId }, 'Session not found for WhatsApp message');
            return;
        }

        // The senderId should be the WhatsApp chat ID (e.g., "1234567890@c.us")
        const chatId = session.senderId;
        if (!chatId) {
            logger.error({ sessionId }, 'No chat ID found for session');
            return;
        }

        try {
            const text = this.stripMarkdown(message.text);
            await this.client.sendMessage(chatId, text);
            logger.info({ chatId, textLength: text.length }, 'WhatsApp message sent');
        } catch (err) {
            logger.error({ err, chatId }, 'Failed to send WhatsApp message');
        }
    }

    private async handleMessage(msg: any): Promise<void> {
        try {
            // Extract message info
            const from = msg.from; // e.g., "1234567890@c.us" or "1234567890@g.us" for groups
            const to = msg.to;
            const body = msg.body || '';
            const isGroup = from.endsWith('@g.us');
            
            // Get sender info
            const contact = await msg.getContact();
            const senderName = contact.pushname || contact.name || 'Unknown';
            const senderNumber = contact.number;

            // For groups, author is the actual sender
            let actualSender = senderName;
            if (isGroup && msg.author) {
                const authorContact = await this.client.getContactById(msg.author);
                actualSender = authorContact.pushname || authorContact.name || 'Unknown';
            }

            logger.info({
                from: senderNumber,
                name: actualSender,
                isGroup,
                textPreview: body.substring(0, 50),
            }, 'WhatsApp message received');

            // Check authorization
            const allowedUsers = this.config.channels.whatsapp?.allowedUsers || [];
            const allowedGroups = this.config.channels.whatsapp?.allowedGroups || [];

            if (isGroup) {
                // Group message
                const groupId = from.replace('@g.us', '');
                if (allowedGroups.length > 0 && !allowedGroups.includes(groupId)) {
                    logger.warn({ groupId }, 'Ignoring unauthorized WhatsApp group');
                    return;
                }

                // Check activation strategy
                const activation = this.config.channels.whatsapp?.groupActivation || 'mention';
                if (activation === 'mention') {
                    // In mention mode, only respond if mentioned or if it's a command
                    const botNumber = this.client.info?.wid?.user;
                    const isMentioned = body.includes(`@${botNumber}`) || body.includes('@Talon');
                    const isCommand = body.startsWith('/');
                    
                    if (!isMentioned && !isCommand) {
                        logger.debug('Ignoring group message without mention');
                        return;
                    }
                }
            } else {
                // Direct message
                if (allowedUsers.length > 0 && !allowedUsers.includes(senderNumber)) {
                    logger.warn({ senderNumber }, 'Ignoring unauthorized WhatsApp user');
                    return;
                }
            }

            // Clean the message body (remove mentions)
            let cleanBody = body;
            if (isGroup) {
                const botNumber = this.client.info?.wid?.user;
                cleanBody = body.replace(new RegExp(`@${botNumber}\\s*`, 'g'), '').trim();
            }

            // Ingest the message
            await this.ingestMessage(from, actualSender, cleanBody, {
                isGroup,
                groupId: isGroup ? from : undefined,
            });

        } catch (err) {
            logger.error({ err }, 'Error handling WhatsApp message');
        }
    }

    private stripMarkdown(text: string): string {
        return text
            .replace(/\*\*([^*]+)\*\*/g, '*$1*')  // Bold -> WhatsApp bold
            .replace(/__([^_]+)__/g, '_$1_')      // Underline
            .replace(/```[\s\S]*?```/g, (match) => {
                // Code blocks -> plain text
                return match.replace(/```/g, '').trim();
            })
            .replace(/`([^`]+)`/g, '`$1`')        // Inline code (WhatsApp supports this)
            .trim();
    }

    public getStatus(): { ready: boolean; qrCode: string | null } {
        return {
            ready: this.isReady,
            qrCode: this.qrCode,
        };
    }
}
