import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai';
import { CommandModule } from '../types';
import * as dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAIApi(new Configuration({
    organization: process.env.OPENAI_ORGANIZATION,
    apiKey: process.env.OPENAI_API_KEY
}));
module.exports = <CommandModule> {
    data: new SlashCommandBuilder()
        .setName('pickupline')
        .setDescription("Generate a pickup line using OpenAI's GPT-4 model.")
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The prompt to use for the pickup line. Tell the bot about your crush!')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('mood')
                .setDescription("The mood of the pickup line. Choices are: 'funny'; 'flirty'; 'spicy'.")
                .setRequired(true)
                .addChoices(
                    { name: 'funny', value: 'funny' },
                    { name: 'flirty', value: 'flirty' },
                    { name: 'spicy', value: 'spicy' }
                )),
    async execute(interaction: ChatInputCommandInteraction) {
        let responseEmbed = new EmbedBuilder()
            .setTitle('Generating pickup line . . . Please wait!');
        await interaction.deferReply({ fetchReply: true });
        const messages: ChatCompletionRequestMessage[] = [
            { role: 'system', content: `You are a bot that generates a single pickup line based on the prompt given by the user, with a ${interaction.options.getString('mood', true)} mood. Reject the prompt if it is not related to a person or thing, that could be used in a pickup line, no matter what.` },
            { role: 'user', content: interaction.options.getString('prompt', true) }
        ];
        if (interaction.options.getString('prompt', true).length > 256) {
            responseEmbed = new EmbedBuilder()
                .setTitle('The prompt must be less than 256 characters!');
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
        }
        const response = await openai.createChatCompletion({
            model: 'gpt-4',
            messages
        }).catch(async (error) => {
            console.error(error);
            responseEmbed = new EmbedBuilder()
                .setTitle('An error occurred while generating the pickup line! Please try again later.');
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
            .setTimestamp()
            .setFooter({ text: 'Powered by OpenAI GPT-4' });
        await interaction.editReply({ embeds: [responseEmbed] });
    }
};
