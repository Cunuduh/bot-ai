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
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Message, ModalActionRowComponentBuilder, ModalBuilder, ModalSubmitInteraction, TextInputBuilder, TextInputStyle } from "discord.js";
import { APIError, OpenAI } from 'openai';
import { Conversation, ModalModule, ServerConfigs, UserTracker } from '../types';

const tracker = UserTracker.getInstance;

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
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true),
                ),
            new ActionRowBuilder<ModalActionRowComponentBuilder>()
                .addComponents(
                    new TextInputBuilder()
                        .setLabel('Image URL')
                        .setCustomId('useThisContextImageInput')
                        .setPlaceholder('Image URL, one for each line...')
                        .setMinLength(1)
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(false)
                )
        ),
        async execute(interaction: ModalSubmitInteraction) {
            if (!interaction.message) return;
            if (!interaction.guildId) return;
            const openai: OpenAI = ServerConfigs.get(interaction.guildId) ?? ServerConfigs.set(interaction.guildId, new OpenAI()).get(interaction.guildId)!;
            const previous = interaction.message.id;
            const root = tracker.findRoot(previous);
            const prevModel = interaction.message.embeds[0].footer?.text ?? "";
            if (!root) {
                interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        interaction.message.components[0].components[0] as unknown as ButtonBuilder,
                        new ButtonBuilder()
                            .setCustomId('useThisContext')
                            .setLabel('Started a new conversation, cannot reply')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    ) 
                ] });
                await interaction.deferReply({ ephemeral: true });
                await interaction.editReply({ content: 'You started a new conversation and can no longer reply to this one.' });
                return;
            }
            const previousMessages = tracker.getCommandConversation(root);
            if (!previousMessages) return;
            let actionRow: ActionRowBuilder<ButtonBuilder>;
            let responseEmbed: EmbedBuilder;
            let messages: OpenAI.ChatCompletionMessageParam[] = [
                ...previousMessages.conversation,
                { role: 'user', content: interaction.fields.getTextInputValue('useThisContextUserInput') }
            ];
            if (interaction.fields.getTextInputValue('useThisContextImageInput')) {
                const imageUrls = interaction.fields.getTextInputValue('useThisContextImageInput')!.split('\n').map(url => {
                    return { "type": "image_url", "image_url": { "url": url, "detail": "auto" } };
                }) satisfies OpenAI.ChatCompletionContentPartImage[];
                messages = [
                    ...previousMessages.conversation,
                    { role: 'user', content: [
                        { "type": "text", "text": interaction.fields.getTextInputValue('useThisContextUserInput') },
                        ...imageUrls
                    ]
                    },
                ];
            }
            if (!interaction.guildId) {
                responseEmbed = new EmbedBuilder()
                    .setTitle('This command can only be used in a server!');
                await interaction.reply({ embeds: [responseEmbed], ephemeral: true });
                return;
            }
            await interaction.deferReply({ fetchReply: true });
            interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('alreadyReplied')
                        .setLabel('Already replied')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                ) ] });
            const response = await openai.chat.completions.create({
                model: prevModel,
                messages,
                max_tokens: Infinity
            }).catch(async error => {
                console.error(error);
                if (error instanceof APIError) {
                    responseEmbed = new EmbedBuilder()
                        .setTitle(`An error occurred while generating the response! ${error.message}`);
                } else {
                    responseEmbed = new EmbedBuilder()
                        .setTitle(`An error occurred while generating the response!`);
                }
                await interaction.editReply({ embeds: [responseEmbed] });
                return;
            });
            if (!response) return;
            if (!response.choices[0].message) {
                responseEmbed = new EmbedBuilder()
                    .setTitle('An error occurred while generating the response!');
                await interaction.editReply({ embeds: [responseEmbed] });
                return;
            }
            tracker.incrementUser(interaction.user.id, 'text');
            responseEmbed = new EmbedBuilder()
                .setTitle(interaction.fields.getTextInputValue('useThisContextUserInput').slice(0, 255))
                .setDescription(response.choices[0].message.content || null) 
                .setColor('Blurple')
                .setTimestamp()
                .setFooter({ text: prevModel })
            actionRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('useThisContext')
                        .setLabel('Reply')
                        .setStyle(ButtonStyle.Primary)
                );
            const text = response.choices[0].message.content || "";
            let res: Message = await interaction.editReply({ embeds: [responseEmbed], components: [actionRow] });
            const messagesToSend: OpenAI.ChatCompletionMessageParam[] = [
                ...messages,
                { role: 'assistant', content: text }
            ];
            const conversation: Conversation = {
                conversation: messagesToSend,
                root: root,
                messageId: res.id,
                userId: interaction.user.id,
                guildId: interaction.guildId
            };
            tracker.updateCommandConversation(conversation.root, conversation);
        }
}