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
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageActionRowComponentBuilder, ModalActionRowComponentBuilder, ModalBuilder, ModalSubmitInteraction, TextInputBuilder, TextInputStyle } from "discord.js";
import { ChatCompletionRequestMessage } from 'openai';
import { Conversation, ModalModule, Filter, OpenAISingleton, UserTracker } from '../types';

const tracker = UserTracker.getInstance;
const openai = OpenAISingleton.getInstance;

module.exports = <ModalModule> {
    modal: new ModalBuilder()
        .setCustomId('m_useThisContext')
        .setTitle("Use previous context")
        .addComponents(
            new ActionRowBuilder<ModalActionRowComponentBuilder>()
                .addComponents(
                    new TextInputBuilder()
                        .setLabel('User message')
                        .setCustomId('useThisContextUserInput')
                        .setPlaceholder('User message...')
                        .setMinLength(1)
                        .setMaxLength(1024)
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                )
        ),
        async execute(interaction: ModalSubmitInteraction) {
            if (!interaction.message) return;
            const previous = interaction.message.id;
            const root = tracker.findRoot(previous);
            if (!root) {
                interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [new ActionRowBuilder<MessageActionRowComponentBuilder>()
                    .addComponents(
                        interaction.message.components[0].components[0] as unknown as ButtonBuilder,
                        new ButtonBuilder()
                            .setCustomId('useThisContext')
                            .setLabel('Started a new conversation, cannot reply')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    ) ] });
                await interaction.deferReply({ ephemeral: true });
                await interaction.editReply({ content: 'You started a new conversation and can no longer reply to this one.' });
                return;
            }
            const previousMessages = tracker.getCommandConversation(root);
            if (!previousMessages) return;
            let now = tracker.getUserTime(interaction.user.id);
            let actionRow: ActionRowBuilder<ButtonBuilder>;
            let responseEmbed: EmbedBuilder;
            const messages: ChatCompletionRequestMessage[] = [
                ...previousMessages.conversation,
                { role: 'user', content: interaction.fields.getTextInputValue('useThisContextUserInput') }
            ];
            if (!interaction.guildId) {
                responseEmbed = new EmbedBuilder()
                    .setTitle('This command can only be used in a server!');
                await interaction.reply({ embeds: [responseEmbed], ephemeral: true });
                return;
            }
            if (tracker.getUserCount(interaction.user.id) === 20) {
                responseEmbed = new EmbedBuilder()
                    .setTitle('You have reached the maximum number of requests (20) for this hour! Please try again at: <t:' + (Math.round(now / 1000) + 3600) + ':t>');
                await interaction.reply({ embeds: [responseEmbed], ephemeral: true });
                return;
            }
            await interaction.deferReply({ fetchReply: true });
            interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('requestsRemaining')
                        .setLabel(`${20 - tracker.getUserCount(interaction.user.id)}/20 requests remaining`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('useThisContext')
                        .setLabel('Already replied')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                ) ] });
            const response = await openai.config.createChatCompletion({
                model: 'gpt-3.5-turbo',
                messages,
                max_tokens: 1024
            }).catch(async (error) => {
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
            tracker.incrementUser(interaction.user.id);
            responseEmbed = new EmbedBuilder()
                .setTitle(interaction.fields.getTextInputValue('useThisContextUserInput'))
                .setDescription(Filter.clean(response.data.choices[0].message.content))
                .setColor('Blurple')
                .setTimestamp()
                .setFooter({ text: `Reply powered by GPT-3.5-TURBO.` });
            actionRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('requestsRemaining')
                        .setLabel(`${20 - tracker.getUserCount(interaction.user.id)}/20 requests remaining`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('useThisContext')
                        .setLabel('Reply')
                        .setStyle(ButtonStyle.Primary)
                );
            const res = await interaction.editReply({ embeds: [responseEmbed], components: [actionRow] });
            const messagesToSend: ChatCompletionRequestMessage[] = [
                ...messages,
                { role: 'assistant', content: response.data.choices[0].message.content }
            ];
            const conversation: Conversation = {
                conversation: messagesToSend,
                root: root,
                messageId: res.id,
                userId: interaction.user.id,
                guildId: interaction.guildId
            };
            tracker.updateCommandConversation(conversation.root, conversation);
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
}