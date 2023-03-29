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
        if (!interaction.deferred) {
            await interaction.deferReply({ ephemeral: true });
            await interaction.editReply({ content: 'There was an error while executing this command!' });
        } else if (!interaction.replied) {
            await interaction.editReply({ content: 'There was an error while executing this command!' });
        }
    }
});