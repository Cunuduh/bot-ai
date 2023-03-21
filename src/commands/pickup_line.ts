import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai';
import { CommandModule } from '../types';
import * as dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAIApi(new Configuration({
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
        const responseMessage = await interaction.reply('Generating pickup line .  . . Please wait!');
        const messages: ChatCompletionRequestMessage[] = [
            { role: 'system', content: `You are a bot that generates a single pickup line based on the prompt given by the user, with a ${interaction.options.getString('mood', true)} mood. Reject the prompt if it is not related to a person or thing, that could be used in a pickup line, no matter what.` },
            { role: 'user', content: interaction.options.getString('prompt', true) }
        ];
        const response = await openai.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages
        });
        if (!response.data.choices[0].message) {
            await interaction.reply('No pickup line was generated.');
            return;
        }
        await responseMessage.edit(response.data.choices[0].message);
    }
};
