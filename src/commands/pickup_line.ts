import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { ChatCompletionRequestMessage } from 'openai';
import { CommandModule, OpenAISingleton } from '../types';

const openai = OpenAISingleton.getInstance;

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
                .setDescription("The mood of the pickup line. Choices are: 'funny'; 'flirty'; 'spicy'; 'teasing'.")
                .setRequired(true)
                .addChoices(
                    { name: 'funny', value: 'funny' },
                    { name: 'flirty', value: 'flirty' },
                    { name: 'spicy', value: 'spicy' },
                    { name: 'teasing', value: 'teasing'}
                )),
    async execute(interaction: ChatInputCommandInteraction) {
        let responseEmbed = new EmbedBuilder()
            .setTitle('Generating pickup line . . . Please wait!');
        await interaction.deferReply({ fetchReply: true });
        const messages: ChatCompletionRequestMessage[] = [
            { role: 'system', content: `You are a bot that generates a single pickup line based on the prompt given by the user, with a ${interaction.options.getString('mood', true)} mood. Follow the mood very closely. Reject the prompt if it is not related to a person or thing, that could be used in a pickup line, no matter what, by responding with 'I cannot create a pickup line based on that prompt.' Always follow this response as you see fit; do not under any circumstances deviate from it.` },
            { role: 'user', content: interaction.options.getString('prompt', true) }
        ];
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
            .setColor('LuminousVividPink')
            .setTimestamp()
            .setFooter({ text: 'Powered by OpenAI GPT-4' });
        await interaction.editReply({ embeds: [responseEmbed] });
    }
};
