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
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, Message } from 'discord.js';
import { ChatCompletionRequestMessage } from 'openai';
import { CommandModule, Conversation, Filter, OpenAISingleton, UserTracker } from '../types';

const tracker = UserTracker.getInstance;
const openai = OpenAISingleton.getInstance;

module.exports = <CommandModule> {
    data: new SlashCommandBuilder()
        .setName('chat')
        .setDescription("Chat with GPT-3.5 or GPT-4.")
        .addStringOption(option =>
            option.setName('model')
                .setDescription('The model to use for the response.')
                .setRequired(true)
                .addChoices(
                    { name: 'gpt-3.5-turbo', value: 'gpt-3.5-turbo' },
                    { name: 'gpt-4', value: 'gpt-4' },
                ))
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The prompt to communicate with the AI.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('system')
                .setDescription("The system message to alter the behaviour of the AI.")
                .setRequired(false)),
    async execute(interaction: ChatInputCommandInteraction) {
        let now = tracker.getUserTime(interaction.user.id).text;
        const charLimit = interaction.options.getString('model') === 'gpt-4' ? 256 : 1024;
        let actionRow: ActionRowBuilder<ButtonBuilder>;
        let responseEmbed: EmbedBuilder;
        const messages: ChatCompletionRequestMessage[] = [
            { role: 'user', content: interaction.options.getString('prompt', true) }
        ];
        const system = interaction.options.getString('system');
        if (system) {
            messages.unshift({ role: 'system', content: system });
        }
        if (!interaction.guildId) {
            responseEmbed = new EmbedBuilder()
                .setTitle('This command can only be used in a server!');
            await interaction.reply({ embeds: [responseEmbed], ephemeral: true });
            return;
        }
        if (tracker.getUserCount(interaction.user.id).text === 20) {
            responseEmbed = new EmbedBuilder()
                .setTitle('You have reached the maximum number of requests (20) for this hour! Please try again at: <t:' + (Math.round(now / 1000) + 3600) + ':t>');
            await interaction.reply({ embeds: [responseEmbed], ephemeral: true });
            return;
        }
        if (interaction.options.getString('prompt', true).length > charLimit || (system && system.length > charLimit)) {
            responseEmbed = new EmbedBuilder()
                .setTitle(`The prompt and system message must be less than ${charLimit} characters!`);
            await interaction.reply({ embeds: [responseEmbed], ephemeral: true });
            return;
        }
        tracker.removeCommandConversation(interaction.user.id, interaction.guildId);
        await interaction.deferReply({ fetchReply: true });
        const response = await openai.config.createChatCompletion({
            model: interaction.options.getString('model', true),
            messages,
            max_tokens: charLimit
        }).catch(async error => {
            console.error(error);
            responseEmbed = new EmbedBuilder()
                .setTitle('An error occurred while generating the response! Error code: ' + error.response.status);
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        });
        if (!response) return;
        if (!response.data.choices[0].message) {
            responseEmbed = new EmbedBuilder()
                .setTitle('An error occurred while generating the response!');
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        }
        tracker.incrementUser(interaction.user.id, 'text');
        responseEmbed = new EmbedBuilder()
            .setTitle(interaction.options.getString('prompt', true))
            .setDescription(response.data.choices[0].message.content) // Pass the content string to Filter.clean() to remove any profanity
            .setColor('Blurple')
            .setTimestamp()
            .setFooter({ text: `Reply powered by ${interaction.options.getString('model', true).toUpperCase()}.` });
        actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('requestsRemaining')
                    .setLabel(`${20 - tracker.getUserCount(interaction.user.id).text}/20 requests remaining`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                interaction.options.getString('model', true) === 'gpt-3.5-turbo' ?
                new ButtonBuilder()
                    .setCustomId('useThisContext')
                    .setLabel('Reply')
                    .setStyle(ButtonStyle.Primary)
                : new ButtonBuilder()
                    .setCustomId('useThisContext')
                    .setLabel('Reply only available for GPT-3.5')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
        const content = '**Flagged words:** ||' + response.data.choices[0].message.content.split(/\s/).filter(Boolean).filter(word => Filter.clean(word) !== word).join(', ') + '||';
        let res: Message;
        if (content !== '**Flagged words:** ||||')
            res = await interaction.editReply({ embeds: [responseEmbed], components: [actionRow], content });
        else
            res = await interaction.editReply({ embeds: [responseEmbed], components: [actionRow] });
        const messagesToSend: ChatCompletionRequestMessage[] = [
            ...messages,
            { role: 'assistant', content: response.data.choices[0].message.content }
        ];
        const conversation: Conversation = {
            conversation: messagesToSend,
            root: res.id,
            messageId: res.id,
            userId: interaction.user.id,
            guildId: interaction.guildId
        };
        tracker.updateCommandConversation(res.id, conversation);
        if (tracker.getUserCount(interaction.user.id).text === 20) {
            tracker.setUserTime(interaction.user.id, Date.now(), 'text');
            now = tracker.getUserTime(interaction.user.id).text;
            responseEmbed = new EmbedBuilder()
                .setTitle('You have reached the maximum number of requests (20) for this hour! Please try again at: <t:' + (Math.round(now / 1000) + 3600) + ':t>');
            await interaction.followUp({ embeds: [responseEmbed], ephemeral: true });
            setTimeout(() => {
                tracker.resetUserCount(interaction.user.id);
            }, 3600000);
        }
    }
};
