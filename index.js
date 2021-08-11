const { getModule, getAllModules, React, constants } = require('powercord/webpack');
const ChannelContextMenu = getAllModules((m) => m.default && m.default.displayName == 'ChannelListVoiceChannelContextMenu', false)[0];
const { getVoiceStatesForChannel } = getModule(['getVoiceStatesForChannel'], false);
const DiscordPermissions = getModule(['Permissions'], false).Permissions;
const { getVoiceChannelId } = getModule(['getVoiceChannelId'], false);
const { inject, uninject } = require('powercord/injector');
const { patch } = getModule(m => typeof m == 'object' && m.patch, false);
const Menu = getModule(['MenuGroup', 'MenuItem'], false);
const Permissions = getModule(['getHighestRole'], false);
const { getChannel } = getModule(['getChannel'], false);
const { getGuild } = getModule(['getGuild'], false);
const { Plugin } = require('powercord/entities');
const { sleep } = require('powercord/util');

module.exports = class VoiceChatMoveAll extends Plugin {
   async startPlugin() {
      inject('vc-move-all', ChannelContextMenu, 'default', (args, res) => {
         let channel = args[0].channel;
         if (!channel || !channel.guild_id || !this.canMoveAll(channel)) return res;
         let currentChannel = this.getVoiceChannel();
         if (!currentChannel || currentChannel.members.length < 2) return res;

         let item = React.createElement(Menu.MenuItem, {
            action: async () => {
               for (const member of currentChannel.members) {
                  await patch({
                     url: constants.Endpoints.GUILD_MEMBER(channel.guild_id, member),
                     body: {
                        channel_id: channel.id
                     }
                  }).catch(async (e) => {
                     await sleep(e.body.retry_after * 1000);
                     currentChannel.members.unshift(member);
                  });
               }
            },
            id: 'move-all-vc',
            label: 'Move All'
         });

         let element = React.createElement(Menu.MenuGroup, null, item);
         res.props.children.push(element);
         return res;
      });
      ChannelContextMenu.default.displayName = 'ChannelListVoiceChannelContextMenu';
   }

   pluginWillUnload() {
      uninject('vc-move-all');
   }

   getVoiceUserIds(channel) {
      if (!channel) return null;
      return Object.keys(getVoiceStatesForChannel(channel));
   }

   canMoveAll(channel) {
      let instance = this.getVoiceChannel();

      if (
         instance?.channel.id !== channel.id &&
         instance?.channel.guild_id === channel.guild_id &&
         (Permissions.can(DiscordPermissions.ADMINISTRATOR, getGuild(channel.guild_id)) ||
         (this.canJoinAndMove(channel) && (channel.userLimit == 0 || channel.userLimit - instance.count >= 0)))
      ) return true;

      return false;
   }

   canJoinAndMove(channel) {
      return Permissions.can(DiscordPermissions.CONNECT, channel) && Permissions.can(DiscordPermissions.MOVE_MEMBERS, channel);
   }

   getVoiceChannel() {
      let channel = getChannel(getVoiceChannelId());
      let members = this.getVoiceUserIds(channel?.id);
      if (channel && members) return { channel, members, count: members.length };
      return null;
   }
};
