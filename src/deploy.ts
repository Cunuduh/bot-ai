import { REST, RESTPostAPIApplicationCommandsJSONBody, Routes } from 'discord.js';
import fs from 'node:fs';
import { CommandModule } from './types';
import * as dotenv from 'dotenv';
dotenv.config();

const clientId = process.env.CLIENT_ID;
const token = process.env.BOT_TOKEN;
if (!clientId || !token) {
    console.error('Missing CLIENT_ID or BOT_TOKEN environment variable.');
    process.exit(1);
}
const commands: RESTPostAPIApplicationCommandsJSONBody[] = [];
const commandFiles: string[] = fs.readdirSync('src/commands').filter(file => file.endsWith('.ts'));

commandFiles.forEach((file: string) => {
	const command: CommandModule = require(`./commands/${file}`);
	commands.push(command.data.toJSON());
});

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );
		console.log(`Successfully reloaded ${commands.length} application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
})();