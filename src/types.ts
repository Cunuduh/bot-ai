/*
 * BotGPT, a Discord bot that uses OpenAI's GPT-3 and GPT-4 API to generate responses.
 * Copyright (c) 2023 Cunuduh
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
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
export class UserTracker {
    private static _instance: UserTracker;
    private _users: Map<string, number>;
    private _userTimes: Map<string, number>;
    private constructor() {
        this._users = new Map();
        this._userTimes = new Map();
    }
    public static get getInstance() {
        return this._instance || (this._instance = new this());
    }
    public incrementUser(user: string) {
        if (this._users.has(user)) {
            const count = this._users.get(user);
            if (count === undefined) return;
            this._users.set(user, count + 1);
        } else {
            this._users.set(user, 1);
        }
    }
    public getUserCount(user: string) {
        return this._users.get(user) ?? 0;
    }
    public resetUserCount(user: string) {
        if (this._users.has(user)) {
            this._users.set(user, 0);
        }
    }
    public setUserTime(user: string, time: number) {
        this._userTimes.set(user, time);
    }
    public getUserTime(user: string) {
        return this._userTimes.get(user) ?? 0;
    }
}