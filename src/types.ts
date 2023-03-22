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