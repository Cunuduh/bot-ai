const fs = require('node:fs');
const path = require('node:path');
import { Client, Collection, Events, Interaction } from 'discord.js';

const token = process.env.BOT_TOKEN;
const commands: Collection<string, any> = new Collection();
const commandPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandPath).filter((file: string) => file.endsWith('.ts'));
const client = new Client({ intents: [] });

commandFiles.forEach((file: string) => {
	const filePath = path.join(commandPath, file);
	const command = require(filePath);
	if ('data' in command && 'execute' in command) {
		commands.set(command.data.name, command);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
});

client.login(token);
console.log(client);

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isCommand()) return;
    const command = commands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});