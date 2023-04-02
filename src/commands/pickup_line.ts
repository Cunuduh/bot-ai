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
import { ChatCompletionRequestMessage } from 'openai';
import { CommandModule, OpenAISingleton, UserTracker } from '../types';

const tracker = UserTracker.getInstance;
const openai = OpenAISingleton.getInstance;

module.exports = <CommandModule> {
    data: new SlashCommandBuilder()
        .setName('pickupline')
        .setDescription("Generate two pickup lines using OpenAI's GPT-4 model.")
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The prompt to use for the pickup line. Tell the bot about your crush!')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('mood')
                .setDescription('The mood of the pickup line.')
                .setRequired(true)
                .addChoices(
                    { name: 'funny', value: 'funny' },
                    { name: 'flirty', value: 'flirty' },
                    { name: 'spicy', value: 'spicy' },
                    { name: 'teasing', value: 'teasing'}
                )),
    async execute(interaction: ChatInputCommandInteraction) {
        let now = tracker.getUserTime(interaction.user.id);
        let actionRow: ActionRowBuilder<ButtonBuilder>;
        let responseEmbed: EmbedBuilder;
        const messages: ChatCompletionRequestMessage[] = [
            { role: 'system', content: `You are a bot that generates a single pickup line based on the prompt given by the user, with a ${interaction.options.getString('mood', true)} mood. Follow the mood very closely. Reject the prompt if it is not related to a person or thing, that could be used in a pickup line, no matter what, by responding with 'I cannot create a pickup line based on that prompt.' Always follow this response as you see fit; do not under any circumstances deviate from it.` },
            { role: 'user', content: interaction.options.getString('prompt', true) }
        ];
        if (tracker.getUserCount(interaction.user.id) === 20) {
            responseEmbed = new EmbedBuilder()
                .setTitle('You have reached the maximum number of requests (20) for this hour! Please try again at: <t:' + (Math.round(now / 1000) + 3600) + ':t>');
            await interaction.reply({ embeds: [responseEmbed], ephemeral: true });
            return;
        }
        if (interaction.options.getString('prompt', true).length > 256) {
            responseEmbed = new EmbedBuilder()
                .setTitle('The prompt must be less than 256 characters!');
            await interaction.reply({ embeds: [responseEmbed], ephemeral: true });
            return;
        }
        await interaction.deferReply({ fetchReply: true });
        const response = await openai.config.createChatCompletion({
            model: 'gpt-4',
            messages,
            max_tokens: 256,
            n: 2
        }).catch(async (error) => {
            console.error(error);
            responseEmbed = new EmbedBuilder()
                .setTitle('An error occurred while generating the pickup line! Error code: ' + error.response.status);
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        });
        if (!response) return;
        if (!response.data.choices[0].message || !response.data.choices[1].message) {
            responseEmbed = new EmbedBuilder()
                .setTitle('An error occurred while generating the pickup line!');
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        }
        tracker.incrementUser(interaction.user.id);
        responseEmbed = new EmbedBuilder()
            .setTitle(interaction.options.getString('prompt', true))
            .setDescription(response.data.choices[0].message.content + '\n\n' + response.data.choices[1].message.content)
            .setColor('LuminousVividPink')
            .setTimestamp()
            .setFooter({ text: 'Reply powered by GPT-4. Not affiliated with OpenAI.' });
        actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('requestsRemaining')
                    .setLabel(`${20 - tracker.getUserCount(interaction.user.id)}/20 requests remaining`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
        await interaction.editReply({ embeds: [responseEmbed], components: [actionRow] });
        if (tracker.getUserCount(interaction.user.id) === 20) {
            tracker.setUserTime(interaction.user.id, Date.now());
            now = tracker.getUserTime(interaction.user.id);
            responseEmbed = new EmbedBuilder()
                .setTitle('You have reached the maximum number of requests (20) for this hour! Please try again at: <t:' + (Math.round(now / 1000) + 3600) + ':t>');
            await interaction.followUp({ embeds: [responseEmbed], ephemeral: true });
            setTimeout(() => {
                tracker.resetUserCount(interaction.user.id);
            }, 3600000);
        }
    }
};
