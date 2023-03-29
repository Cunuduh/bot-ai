/*
 * BotGPT, a Discord bot that uses OpenAI's GPT-3 and GPT-4 API to generate responses.
 * Copyright (c) 2023 Cunuduh
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
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