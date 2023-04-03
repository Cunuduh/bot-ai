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
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
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
        if (tracker.getUserCount(interaction.user.id).image === 2) {
            responseEmbed = new EmbedBuilder()
                .setTitle('You have reached the maximum number of requests (2) for this hour! Please try again at: <t:' + (Math.round(now / 1000) + 3600) + ':t>');
            await interaction.reply({ embeds: [responseEmbed], ephemeral: true });
            return;
        }
        await interaction.deferReply({ fetchReply: true });
        const response = await openai.config.createImage({
            prompt: interaction.options.getString('prompt', true),
            n: 1,
            size: '512x512'
        }).catch(async (error) => {
            console.error(error);
            responseEmbed = new EmbedBuilder()
                .setTitle('An error occurred while generating the image! Error code: ' + error.response.status);
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        });
        if (!response) return;
        if (!response.data.data[0].url) {
            responseEmbed = new EmbedBuilder()
                .setTitle('An error occurred while generating the image!');
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        }
        tracker.incrementUser(interaction.user.id, 'image');
        responseEmbed = new EmbedBuilder()
            .setTitle(interaction.options.getString('prompt', true))
            .setImage(response.data.data[0].url)
            .setColor('Purple')
            .setTimestamp()
            .setFooter({ text: 'Image generated with DALL-E.' });
        actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('requestsRemaining')
                    .setLabel(`${2 - tracker.getUserCount(interaction.user.id).image}/2 requests remaining`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
        await interaction.editReply({ embeds: [responseEmbed], components: [actionRow] });
        if (tracker.getUserCount(interaction.user.id).image === 2) {
            tracker.setUserTime(interaction.user.id, Date.now(), 'image');
            now = tracker.getUserTime(interaction.user.id).image;
            responseEmbed = new EmbedBuilder()
                .setTitle('You have reached the maximum number of requests (2) for this hour! Please try again at: <t:' + (Math.round(now / 1000) + 3600) + ':t>');
            await interaction.followUp({ embeds: [responseEmbed], ephemeral: true });
            setTimeout(() => {
                tracker.resetUserCount(interaction.user.id);
            }, 3600000);
        }
    }
};
