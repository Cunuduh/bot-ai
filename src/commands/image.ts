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
import fs from 'fs';
import { OpenAI } from 'openai';
import { AttachmentBuilder, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { CommandModule, ServerConfigs } from '../types';


module.exports = <CommandModule> {
    data: new SlashCommandBuilder()
        .setName('image')
        .setDescription('Generate an image with DALL-E.')
        .addStringOption(option =>
            option.setName('model')
                .setDescription('The model to use for the image.')
                .setRequired(true)
                .addChoices(
                    { name: 'dall-e-2', value: 'dall-e-2'},
                    { name: 'dall-e-3', value: 'dall-e-3'}
                ))
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The prompt to use for the image.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('size')
                .setDescription('The size of the image.')
                .setRequired(true)
                .addChoices(
                    { name: '256x256', value: '256x256'},
                    { name: '512x512', value: '512x512'},
                    { name: '1024x1024', value: '1024x1024'},
                    { name: '1792x1024', value: '1792x1024'},
                    { name: '1024x1792', value: '1024x1792'}
                ))
        .addStringOption(option =>
            option.setName('quality')
                .setDescription('The quality of the image. Only applicable for DALL-E 3.')
                .setRequired(false)
                .addChoices(
                    { name: 'standard', value: 'standard'},
                    { name: 'hd', value: 'hd'}
                )),
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;
        const openai: OpenAI = ServerConfigs.get(interaction.guildId) ?? ServerConfigs.set(interaction.guildId, new OpenAI()).get(interaction.guildId)!;
        let responseEmbed: EmbedBuilder;
        await interaction.deferReply({ fetchReply: true });
        const quality = interaction.options.getString('quality', false) as OpenAI.ImageGenerateParams['quality'];
        const response = await openai.images.generate({
            model: interaction.options.getString('model', true),
            prompt: interaction.options.getString('prompt', true),
            quality: interaction.options.getString('model', true) === 'dall-e-3' ? quality : undefined,
            n: 1,
            size: interaction.options.getString('size', true) as OpenAI.ImageGenerateParams['size'],
            response_format: 'b64_json'
        }).catch(async error => {
            console.error(error);
            if (error instanceof OpenAI.APIError) {
                responseEmbed = new EmbedBuilder()
                    .setTitle(`An error occurred while generating the image! ${error.message}`)
            } else {
                responseEmbed = new EmbedBuilder()
                    .setTitle('An error occurred while generating the image!');
            }
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        });
        if (!response) return;
        if (!response.data[0].b64_json) {
            responseEmbed = new EmbedBuilder()
                .setTitle('An error occurred while generating the image!');
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        }
        const filename = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const tempDir = fs.mkdtempSync('tmp-');
        fs.writeFileSync(tempDir + `/${filename}.png`, Buffer.from(response.data[0].b64_json, 'base64'));
        const attachment = new AttachmentBuilder(`${tempDir}/${filename}.png`);
        responseEmbed = new EmbedBuilder()
            .setTitle(interaction.options.getString('prompt', true).slice(0, 255))
            .setImage(`attachment://${filename}.png`)
            .setColor('Purple')
            .setTimestamp()
        await interaction.editReply({ embeds: [responseEmbed], files: [attachment] });
        fs.rmSync(tempDir, { recursive: true });
    }
};
