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
import { OpenAI, APIError } from 'openai';
import { CommandModule, Conversation, ServerConfigs, UserTracker } from '../types';

const tracker = UserTracker.getInstance;

module.exports = <CommandModule> {
    data: new SlashCommandBuilder()
        .setName('chat')
        .setDescription("Chat with a GPT model.")
        .addStringOption(option =>
            option.setName('model')
                .setDescription('The model to use for the response.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The prompt to communicate with the AI.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('imageurl')
                .setDescription('The image URL to send to the AI if it has vision. Delimit multiple image links with a comma.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('system')
                .setDescription("The system message to alter the behaviour of the AI.")
                .setRequired(false)),
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;
        const openai: OpenAI = ServerConfigs.get(interaction.guildId) ?? ServerConfigs.set(interaction.guildId, new OpenAI()).get(interaction.guildId)!;
        let actionRow: ActionRowBuilder<ButtonBuilder>;
        let responseEmbed: EmbedBuilder;
        let messages: OpenAI.ChatCompletionMessageParam[] = [
            { role: 'user', content: interaction.options.getString('prompt', true) }
        ];
        if (interaction.options.getString('imageurl', false)) {
            const imageUrls = interaction.options.getString('imageurl', false)!.split(',').map(url => {
                return { "type": "image_url", "image_url": { "url": url, "detail": "auto" } };
            }) satisfies OpenAI.ChatCompletionContentPartImage[];
            messages = [
                { role: 'user', content: [
                    { "type": "text", "text": interaction.options.getString('prompt', true) },
                    ...imageUrls
                ]
                },
            ];
        }
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
        await interaction.deferReply({ fetchReply: true });
        const response = await openai.chat.completions.create({
            model: interaction.options.getString('model', true),
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
        responseEmbed = new EmbedBuilder()
            .setTitle(interaction.options.getString('prompt', true).slice(0, 255))
            .setDescription(response.choices[0].message.content || null) 
            .setColor('Blurple')
            .setTimestamp()
            .setFooter({ text: interaction.options.getString('model', true) })
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
            root: res.id,
            messageId: res.id,
            userId: interaction.user.id,
            guildId: interaction.guildId
        };
        tracker.updateCommandConversation(conversation.root, conversation);
    }
};
