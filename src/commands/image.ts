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
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { CommandModule, OpenAISingleton, UserTracker } from '../types';

const tracker = UserTracker.getInstance;
const openai = OpenAISingleton.getInstance;

module.exports = <CommandModule> {
    data: new SlashCommandBuilder()
        .setName('image')
        .setDescription("Generate an image with DALL-E.")
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The prompt to use for the image.')
                .setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        let now = tracker.getUserTime(interaction.user.id).image;
        let actionRow: ActionRowBuilder<ButtonBuilder>;
        let responseEmbed: EmbedBuilder;
        if (tracker.getUserCount(interaction.user.id).image === 1) {
            responseEmbed = new EmbedBuilder()
                .setTitle('You have reached the maximum number of requests (1) for 2 hours! Please try again at: <t:' + (Math.round(now / 1000) + 7200) + ':t>');
            await interaction.reply({ embeds: [responseEmbed], ephemeral: true });
            return;
        }
        await interaction.deferReply({ fetchReply: true });
        const response = await openai.config.createImage({
            prompt: interaction.options.getString('prompt', true),
            n: 1,
            size: '256x256',
            response_format: 'b64_json'
        }).catch(async error => {
            console.error(error);
            responseEmbed = new EmbedBuilder()
                .setTitle('An error occurred while generating the image! Error code: ' + error.response.status);
            if (error.response.status === 400) {
                tracker.setUserTime(interaction.user.id, Date.now(), 'image');
                now = tracker.getUserTime(interaction.user.id).image;
                responseEmbed = new EmbedBuilder()
                    .setTitle('Possibly inappropriate content detected!');
                tracker.incrementUser(interaction.user.id, 'image');
                await interaction.editReply({ embeds: [responseEmbed], components: [
                    new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('requestsRemaining')
                            .setLabel(`${1 - tracker.getUserCount(interaction.user.id).image}/1 requests remaining`)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    )
                ] });
                await interaction.followUp({ embeds: [{ title: 'You have reached the maximum number of requests (1) for 2 hours! Please try again at: <t:' + (Math.round(now / 1000) + 7200) + ':t>' }], ephemeral: true });
                setTimeout(() => {
                    tracker.resetUserCount(interaction.user.id);
                }, 7200000);
                return;
            }
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        });
        if (!response) return;
        if (!response.data.data[0].b64_json) {
            responseEmbed = new EmbedBuilder()
                .setTitle('An error occurred while generating the image!');
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        }
        tracker.incrementUser(interaction.user.id, 'image');
        const filename = response.data.data[0].b64_json.slice(0, 127);
        const tempDir = fs.mkdtempSync('tmp-');
        fs.writeFileSync(tempDir + `/${filename}.png`, Buffer.from(response.data.data[0].b64_json, 'base64'));
        const attachment = new AttachmentBuilder(`${tempDir}/${filename}.png`);
        responseEmbed = new EmbedBuilder()
            .setTitle(interaction.options.getString('prompt', true))
            .setImage(`attachment://${filename}.png`)
            .setColor('Purple')
            .setTimestamp()
            .setFooter({ text: 'Image generated with DALL-E.' });
        actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('requestsRemaining')
                    .setLabel(`${1 - tracker.getUserCount(interaction.user.id).image}/1 requests remaining`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
        await interaction.editReply({ embeds: [responseEmbed], components: [actionRow], files: [attachment] });
        fs.rmSync(tempDir, { recursive: true });
        if (tracker.getUserCount(interaction.user.id).image === 1) {
            tracker.setUserTime(interaction.user.id, Date.now(), 'image');
            now = tracker.getUserTime(interaction.user.id).image;
            responseEmbed = new EmbedBuilder()
                .setTitle('You have reached the maximum number of requests (1) for 2 hours! Please try again at: <t:' + (Math.round(now / 1000) + 7200) + ':t>');
            await interaction.followUp({ embeds: [responseEmbed], ephemeral: true });
            setTimeout(() => {
                tracker.resetUserCount(interaction.user.id);
            }, 7200000);
        }
    }
};
