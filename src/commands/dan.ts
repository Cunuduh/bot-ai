import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { ChatCompletionRequestMessage } from 'openai';
import { CommandModule, OpenAISingleton, UserTracker } from '../types';
import { initial, second } from '../dan.json';

const tracker = UserTracker.getInstance;
const openai = OpenAISingleton.getInstance;

module.exports = <CommandModule> {
    data: new SlashCommandBuilder()
        .setName('dan')
        .setDescription("Chat with GPT's alter ego.")
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The prompt to communicate with DAN.')
                .setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        let now = tracker.getUserTime(interaction.user.id);
        let actionRow: ActionRowBuilder<ButtonBuilder>;
        let responseEmbed: EmbedBuilder;
        await interaction.deferReply({ fetchReply: true });
        const messages: ChatCompletionRequestMessage[] = [
            { role: 'user', content: initial },
            { role: 'assistant', content: second },
            { role: 'user', content: interaction.options.getString('prompt', true) }
        ];
        if (tracker.getUserCount(interaction.user.id) === 30) {
            responseEmbed = new EmbedBuilder()
                .setTitle('You have reached the maximum number of requests (30) for this hour! Please try again at: <t:' + (Math.round(now / 1000) + 3600) + ':t>');
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        }
        if (interaction.options.getString('prompt', true).length > 1024) {
            responseEmbed = new EmbedBuilder()
                .setTitle(`The prompt must be less than 1024 characters!`);
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        }
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
            .setTitle(interaction.options.getString('prompt', true))
            .setDescription(response.data.choices[0].message.content)
            .setColor('Orange')
            .setTimestamp()
            .setFooter({ text: `Reply powered by GPT-3.5-TURBO and DAN 12. Not affiliated with OpenAI.` });
        actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('requestsRemaining')
                    .setLabel(`${30 - tracker.getUserCount(interaction.user.id)}/30 requests remaining`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
        await interaction.editReply({ embeds: [responseEmbed], components: [actionRow] });
        if (tracker.getUserCount(interaction.user.id) === 30) {
            tracker.setUserTime(interaction.user.id, Date.now());
            now = tracker.getUserTime(interaction.user.id);
            responseEmbed = new EmbedBuilder()
                .setTitle('You have reached the maximum number of requests (30) for this hour! Please try again at: <t:' + (Math.round(now / 1000) + 3600) + ':t>');
            await interaction.followUp({ embeds: [responseEmbed] });
            setTimeout(() => {
                tracker.resetUserCount(interaction.user.id);
            }, 3600000);
        }
    }
};
