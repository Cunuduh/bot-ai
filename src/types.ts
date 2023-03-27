import { Interaction, SlashCommandBuilder } from "discord.js";
import { Configuration, OpenAIApi } from "openai";
import * as dotenv from 'dotenv';
dotenv.config();

export interface CommandModule {
    data: SlashCommandBuilder;
    execute: (interaction: Interaction) => Promise<void>;
}
export class OpenAISingleton {
    private static _instance: OpenAISingleton;
    config: OpenAIApi;
    private constructor() {
        this.config = new OpenAIApi(new Configuration({
            organization: process.env.OPENAI_ORGANIZATION,
            apiKey: process.env.OPENAI_API_KEY
        }));
    }
    public static get getInstance() {
        return this._instance || (this._instance = new this());
    }
}
// Track how many times a user has used a command
export class UserTracker {
    private static _instance: UserTracker;
    private _users: Map<string, number>;
    private constructor() {
        this._users = new Map();
    }
    public static get getInstance() {
        return this._instance || (this._instance = new this());
    }
    public incrementUser(user: string) {
        if (this._users.has(user)) {
            const count = this._users.get(user);
            if (!count) return;
            this._users.set(user, count + 1);
        } else {
            this._users.set(user, 1);
        }
    }
    public getUserCount(user: string) {
        if (this._users.has(user)) {
            return this._users.get(user);
        } else {
            return this._users.set(user, 0);
        }
    }
    public resetUserCount(user: string) {
        if (this._users.has(user)) {
            this._users.set(user, 0);
        }
    }
}