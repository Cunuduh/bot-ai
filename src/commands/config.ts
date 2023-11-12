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
import { OpenAI } from 'openai';
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { CommandModule, ServerConfigs } from '../types';

module.exports = <CommandModule> {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configure the OpenAI API.')
        .addStringOption(option =>
            option.setName('apikey')
                .setDescription('The OpenAI API key.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('proxy')
                .setDescription('The OpenAI proxy URL.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('organization')
                .setDescription('The OpenAI organization ID.')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction: ChatInputCommandInteraction) { 
        if (!interaction.guildId) return;
        const openai: OpenAI = ServerConfigs.get(interaction.guildId) ?? ServerConfigs.set(interaction.guildId, new OpenAI()).get(interaction.guildId)!;
        await interaction.deferReply({ fetchReply: true });
        const proxy = interaction.options.getString('proxy', false);
        const apikey = interaction.options.getString('apikey', true);
        const organization = interaction.options.getString('organization', false);
        if (!interaction.member) return;
        openai.baseURL = proxy ?? 'https://api.openai.com/v1';
        openai.apiKey = apikey;
        openai.organization = organization;
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('Updated OpenAI API config.')] });
    },
};