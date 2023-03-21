import { Interaction, SlashCommandBuilder } from "discord.js";

export interface CommandModule {
    data: SlashCommandBuilder;
    execute: (interaction: Interaction) => Promise<void>;
}