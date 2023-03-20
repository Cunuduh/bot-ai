import { ChatInputCommandInteraction, CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai';
const openai = new OpenAIApi(new Configuration({

    apiKey: process.env.OPENAI_API_KEY
}));
module.exports = {
    data: new SlashCommandBuilder()
        .setName('pickup_line')
        .setDescription('Generate a pickup line using OpenAI\'s GPT-4 model.')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The prompt to use for the pickup line. Tell the bot about your crush!')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('mood')
                .setDescription('The mood of the pickup line. Choices are: \'funny\'; \'flirty\'; \'spicy\'.')
                .setRequired(true)
                .addChoices(
                    { name: 'Funny', value: 'funny' },
                    { name: 'Flirty', value: 'flirty' },
                    { name: 'Spicy', value: 'spicy' }
                )),
    async execute(interaction: ChatInputCommandInteraction) {
        const messages: ChatCompletionRequestMessage[] = [
            { role: "system", content: `You are a bot that generates a single pickup line based on the prompt given by the user, with a ${interaction.options.getString('mood', true)}. Reject the prompt if it is not a pickup line.` },
            { role: "user", content: interaction.options.getString('prompt', true) }
        ];
        const response = await openai.createChatCompletion({
            model: 'gpt-4',
            messages
        });
        if (!response.data.choices[0].message) {
            await interaction.reply('No pickup line was generated.');
            return;
        }
        await interaction.reply(response.data.choices[0].message.content);
    }
};
