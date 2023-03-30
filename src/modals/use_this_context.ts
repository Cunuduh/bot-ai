import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalActionRowComponentBuilder, ModalBuilder, ModalSubmitInteraction, TextInputBuilder, TextInputStyle } from "discord.js";
import { ChatCompletionRequestMessage } from 'openai';
import { Conversation, ModalModule, OpenAISingleton, UserTracker } from '../types';

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
                interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('requestsRemaining')
                            .setLabel(`${20 - tracker.getUserCount(interaction.user.id)}/20 requests remaining`)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('useThisContext')
                            .setLabel('Started a new conversation, cannot reply')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    ) ] });
                return;
            }
            const previousMessages = tracker.getCommandConversation(root);
            if (!previousMessages) return;
            let now = tracker.getUserTime(interaction.user.id);
            let actionRow: ActionRowBuilder<ButtonBuilder>;
            let responseEmbed: EmbedBuilder;
            await interaction.deferReply({ fetchReply: true });
            const messages: ChatCompletionRequestMessage[] = [
                ...previousMessages.conversation,
                { role: 'user', content: interaction.fields.getTextInputValue('useThisContextUserInput') }
            ];
            if (tracker.getUserCount(interaction.user.id) === 20) {
                responseEmbed = new EmbedBuilder()
                    .setTitle('You have reached the maximum number of requests (20) for this hour! Please try again at: <t:' + (Math.round(now / 1000) + 3600) + ':t>');
                await interaction.editReply({ embeds: [responseEmbed] });
                return;
            }
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
                .setDescription(response.data.choices[0].message.content)
                .setColor('Blurple')
                .setTimestamp()
                .setFooter({ text: `Reply powered by GPT-3.5-TURBO. Not affiliated with OpenAI.` });
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
                userId: interaction.user.id
            };
            tracker.updateCommandConversation(conversation.root, conversation);
            if (tracker.getUserCount(interaction.user.id) === 20) {
                tracker.setUserTime(interaction.user.id, Date.now());
                now = tracker.getUserTime(interaction.user.id);
                responseEmbed = new EmbedBuilder()
                    .setTitle('You have reached the maximum number of requests (20) for this hour! Please try again at: <t:' + (Math.round(now / 1000) + 3600) + ':t>');
                await interaction.followUp({ embeds: [responseEmbed] });
                setTimeout(() => {
                    tracker.resetUserCount(interaction.user.id);
                }, 3600000);
            }
        }
}