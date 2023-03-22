import fs from 'node:fs';
import { Client, Collection, Events, Interaction } from 'discord.js';
import { CommandModule } from './types';
import * as dotenv from 'dotenv';
dotenv.config();

const token = process.env.BOT_TOKEN;
const client = new Client({ intents: [] });
const commands: Collection<string, CommandModule> = new Collection();
const commandFiles = fs.readdirSync('src/commands').filter((file: string) => file.endsWith('.ts'));

commandFiles.forEach((file: string) => {
	const command: CommandModule = require(`./commands/${file}`);
    commands.set(command.data.name, command);
});

client.login(token);
console.log(client);

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isCommand()) return;
    const command: CommandModule | undefined = commands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true, fetchReply: true });
    }
});