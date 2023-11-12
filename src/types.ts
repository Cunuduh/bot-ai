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
import { Collection, Interaction, ModalBuilder, SlashCommandBuilder } from "discord.js";
import { OpenAI } from "openai";
import * as dotenv from 'dotenv';

dotenv.config();
export interface CommandModule {
    data: SlashCommandBuilder;
    execute: (interaction: Interaction) => Promise<void>;
}
export interface ModalModule {
    modal: ModalBuilder;
    execute: (interaction: Interaction) => Promise<void>;
}
export const ServerConfigs: Collection<string, OpenAI> = new Collection();
export interface Conversation {
    conversation: OpenAI.ChatCompletionMessageParam[];
    root: string;
    messageId: string;
    userId: string;
    guildId: string;
}
class UserData {
    image: number;
    text: number;
    constructor(image: number, text: number) {
        this.image = image;
        this.text = text;
    }
}

export class UserTracker {
    private static _instance: UserTracker;
    private _userCounts: Map<string, UserData>;
    private _userTimes: Map<string, UserData>;
    private _commandConversation: Collection<string, Conversation>;
    private constructor() {
        this._userCounts = new Map();
        this._userTimes = new Map();
        this._commandConversation = new Collection();
    }
    public static get getInstance() {
        return this._instance || (this._instance = new this());
    }
    public incrementUser(user: string, type: 'image' | 'text') {
        switch (type) {
            case 'text':
                if (this._userCounts.has(user)) {
                    const count = this._userCounts.get(user);
                    if (count === undefined) return;
                    this._userCounts.set(user, new UserData(count.image, count.text + 1));
                } else {
                    this._userCounts.set(user, new UserData(0, 1));
                }
                break;
            case 'image':
                if (this._userCounts.has(user)) {
                    const count = this._userCounts.get(user);
                    if (count === undefined) return;
                    this._userCounts.set(user, new UserData(count.image + 1, count.text));
                }
                else {
                    this._userCounts.set(user, new UserData(1, 0));
                }
                break;
        }
    }
    public getUserCount(user: string) {
        return this._userCounts.get(user) ?? new UserData(0, 0);
    }
    public resetUserCount(user: string) {
        if (this._userCounts.has(user)) {
            this._userCounts.set(user, new UserData(0, 0));
        }
    }
    public setUserTime(user: string, time: number, type: 'image' | 'text') {
        switch (type) {
            case 'text':
                this._userTimes.set(user, new UserData(0, time));
                break;
            case 'image':
                this._userTimes.set(user, new UserData(time, 0));
                break;
        }
    }
    public getUserTime(user: string) {
        return this._userTimes.get(user) ?? new UserData(0, 0);
    }
    public updateCommandConversation(root: string, conv: Conversation) {
        this._commandConversation.set(root, conv);
    }
    public getCommandConversation(messageId: string) {
        return this._commandConversation.get(messageId) ?? undefined;
    }
    public removeCommandConversation(userId: string, guildId: string) {
        this._commandConversation.filter((value) => value.userId === userId && value.guildId === guildId).forEach((value, key) => this._commandConversation.delete(key));
    }
    public findRoot(messageId: string) {
        return this._commandConversation.findKey((value) => value.messageId === messageId);
    }
}