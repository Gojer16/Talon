// Type declarations for whatsapp-web.js (simplified)
declare module 'whatsapp-web.js' {
    export class Client {
        constructor(options: any);
        on(event: string, callback: (...args: any[]) => void): void;
        initialize(): Promise<void>;
        destroy(): Promise<void>;
        sendMessage(chatId: string, text: string): Promise<any>;
        getContactById(contactId: string): Promise<any>;
        info: {
            wid: {
                user: string;
            };
        };
    }

    export class LocalAuth {
        constructor(options: { dataPath: string });
    }
}
