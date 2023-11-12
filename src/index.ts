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
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, Collection, Events, GatewayIntentBits, Interaction, Message, Partials } from 'discord.js';
import { CommandModule, ModalModule, UserTracker } from './types';
import * as dotenv from 'dotenv';
dotenv.config();
const tracker = UserTracker.getInstance;

const token = process.env.BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds], partials: [Partials.Channel] });
const commands: Collection<string, CommandModule> = new Collection();
const commandFiles = fs.readdirSync('src/commands').filter((file: string) => file.endsWith('.ts'));
commandFiles.forEach((file: string) => {
	const command: CommandModule = require(`./commands/${file}`);
    commands.set(command.data.name, command);
});
const modals: Collection<string, ModalModule> = new Collection();
const modalFiles = fs.readdirSync('src/modals').filter((file: string) => file.endsWith('.ts'));
modalFiles.forEach((file: string) => {
    const modal: ModalModule = require(`./modals/${file}`);
    modals.set('m_' + toCamelCase(file.slice(0, -3)), modal);
});
function toCamelCase(str: string) {
    return str.replace(/([-_][a-z])/gi, ($1) => {
        return $1.toUpperCase()
            .replace('-', '')
            .replace('_', '');
    });
}
client.login(token);
console.log(client);

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isCommand()) return;
    const command: CommandModule | undefined = commands.get(interaction.commandName);
    if (!command) return;
        await command.execute(interaction).catch(async error => {
        console.error(error);
        if (!interaction.deferred) {
            await interaction.deferReply({ ephemeral: true });
            await interaction.editReply({ embeds: [{ title: 'There was an error while executing this command!' }] });
        } else if (!interaction.replied) {
            await interaction.editReply({ embeds: [{ title: 'There was an error while executing this command!' }] }).catch(error => {
                console.error(error);
            });
        }
    });
});
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'useThisContext') {
        const cantUseContextActionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('cannotReply')
                    .setLabel('Started a new conversation, cannot reply')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
        if (!interaction.message.interaction) {
            let msg: Message = interaction.message;
            while (msg.reference) {
                msg = await msg.fetchReference();
            }
            if (!msg.interaction) return;
            const userWhoSentTheMessage = msg.interaction.user.id;
            if (interaction.user.id !== userWhoSentTheMessage) {
                await interaction.reply({ content: 'You can\'t use this context!', ephemeral: true });
                return;
            }
            if (!tracker.findRoot(interaction.message.id)) {
                await interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [cantUseContextActionRow] });
                await interaction.reply({ content: 'Started a new conversation, cannot reply.', ephemeral: true });
                return;
            }
        } else if (interaction.user.id !== interaction.message.interaction.user.id) {
            await interaction.reply({ content: 'You can\'t use this context!', ephemeral: true });
            return;
        }
        if (!tracker.findRoot(interaction.message.id)) {
            await interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [cantUseContextActionRow] });
            await interaction.reply({ content: 'Started a new conversation, cannot reply.', ephemeral: true });
            return;
        }
        const modal: ModalModule | undefined = modals.get('m_useThisContext');
        if (!modal) return;
        await interaction.showModal(modal.modal);
    }
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isModalSubmit()) return;
    const modal: ModalModule | undefined = modals.get(interaction.customId);
    if (!modal) return;
        await modal.execute(interaction).catch(async error => {
        console.error(error);
        if (!interaction.deferred) {
            await interaction.deferReply({ ephemeral: true });
            await interaction.editReply({ embeds: [{ title: 'There was an error while executing this command!' }] });
        } else if (!interaction.replied) {
            await interaction.editReply({ embeds: [{ title: 'There was an error while executing this command!' }] }).catch(error => {
                console.error(error);
            });
        }
    });
});