import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { ChatCompletionRequestMessage } from 'openai';
import { CommandModule, OpenAISingleton, UserTracker } from '../types';

const tracker = UserTracker.getInstance;
const openai = OpenAISingleton.getInstance;
// TODO for me later: add a tiktok command to generate tiktok comments from a prompt
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
        let now = tracker.getUserTime(interaction.user.id);
        const userCount = tracker.getUserCount(interaction.user.id);
        const charLimit = interaction.options.getString('model') === 'gpt-4' ? 256 : 1024;
        let responseEmbed: EmbedBuilder;
        await interaction.deferReply({ fetchReply: true });
        const messages: ChatCompletionRequestMessage[] = [
            { role: 'user', content: interaction.options.getString('prompt', true) }
        ];
        const system = interaction.options.getString('system');
        if (system) {
            messages.unshift({ role: 'system', content: system });
        }
        if (userCount === 30) {
            responseEmbed = new EmbedBuilder()
                .setTitle('You have reached the maximum number of requests (30) for this hour! Please try again at: <t:' + (Math.round(now / 1000) + 3600) + ':t>');
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        }
        if (interaction.options.getString('prompt', true).length > charLimit || (system && system.length > charLimit)) {
            responseEmbed = new EmbedBuilder()
                .setTitle(`The prompt and system message must be less than ${charLimit} characters!`);
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        }
        const response = await openai.config.createChatCompletion({
            model: interaction.options.getString('model', true),
            messages,
            max_tokens: charLimit
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
        responseEmbed = new EmbedBuilder()
            .setTitle(interaction.options.getString('prompt', true))
            .setDescription(response.data.choices[0].message.content)
            .setColor('Blurple')
            .setTimestamp()
            .setFooter({ text: `Response powered by ${interaction.options.getString('model', true).toUpperCase()}. Not officially affiliated with OpenAI.` });
        await interaction.editReply({ embeds: [responseEmbed] });
        tracker.incrementUser(interaction.user.id);
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
