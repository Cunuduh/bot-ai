import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { ChatCompletionRequestMessage } from 'openai';
import { CommandModule, OpenAISingleton } from '../types';

const openai = OpenAISingleton.getInstance;

module.exports = <CommandModule> {
    data: new SlashCommandBuilder()
        .setName('chat')
        .setDescription("Chat with GPT-4.")
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The prompt to communicate with GPT-4.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('system')
                .setDescription("The system message to alter the behaviour of GPT-4.")
                .setRequired(false)),
    async execute(interaction: ChatInputCommandInteraction) {
        let responseEmbed = new EmbedBuilder()
            .setTitle('Generating response . . . Please wait!');
        await interaction.deferReply({ fetchReply: true });
        const messages: ChatCompletionRequestMessage[] = [
            { role: 'user', content: interaction.options.getString('prompt', true) }
        ];
        if (interaction.options.getString('system', true)) {
            messages.unshift({ role: 'system', content: interaction.options.getString('system', true) });
        }
        if (interaction.options.getString('prompt', true).length > 256) {
            responseEmbed = new EmbedBuilder()
                .setTitle('The prompt must be less than 256 characters!');
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        }
        const response = await openai.config.createChatCompletion({
            model: 'gpt-4',
            messages,
            max_tokens: 256
        }).catch(async (error) => {
            console.error(error);
            responseEmbed = new EmbedBuilder()
                .setTitle('An error occurred while generating the pickup line!');
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        });
        if (!response) return;
        if (!response.data.choices[0].message) {
            responseEmbed = new EmbedBuilder()
                .setTitle('An error occurred while generating the pickup line!');
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        }
        responseEmbed = new EmbedBuilder()
            .setTitle(interaction.options.getString('prompt', true))
            .setDescription(response.data.choices[0].message.content)
            .setColor('Blurple')
            .setTimestamp()
            .setFooter({ text: 'Powered by OpenAI GPT-4' });
        await interaction.editReply({ embeds: [responseEmbed] });
    }
};
