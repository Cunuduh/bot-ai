import { REST, Routes } from 'discord.js';
import fs from 'node:fs';

const clientId = process.env.CLIENT_ID;
const token = process.env.BOT_TOKEN;
if (!clientId || !token) {
    console.error('Missing CLIENT_ID or BOT_TOKEN environment variable.');
    process.exit(1);
}
const commands: any[] = [];
const commandFiles = fs.readdirSync('src/commands').filter(file => file.endsWith('.ts'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	commands.push(command.data.toJSON());
}

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